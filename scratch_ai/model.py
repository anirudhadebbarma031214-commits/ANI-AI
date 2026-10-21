"""Tiny decoder-only Transformer: all weights start randomly initialized."""
import torch
import torch.nn as nn
import torch.nn.functional as F

class Head(nn.Module):
    def __init__(self, n_embd, head_size, block_size, dropout):
        super().__init__()
        self.key = nn.Linear(n_embd, head_size, bias=False)
        self.query = nn.Linear(n_embd, head_size, bias=False)
        self.value = nn.Linear(n_embd, head_size, bias=False)
        self.register_buffer("tril", torch.tril(torch.ones(block_size, block_size)))
        self.drop = nn.Dropout(dropout)
    def forward(self, x):
        t = x.size(1)
        k, q = self.key(x), self.query(x)
        w = q @ k.transpose(-2, -1) * (k.size(-1) ** -0.5)
        w = w.masked_fill(self.tril[:t, :t] == 0, float("-inf"))
        return self.drop(F.softmax(w, dim=-1)) @ self.value(x)

class MultiHead(nn.Module):
    def __init__(self, n_embd, n_head, block_size, dropout):
        super().__init__()
        self.heads = nn.ModuleList([Head(n_embd, n_embd // n_head, block_size, dropout) for _ in range(n_head)])
        self.proj = nn.Linear(n_embd, n_embd)
        self.drop = nn.Dropout(dropout)
    def forward(self, x):
        return self.drop(self.proj(torch.cat([h(x) for h in self.heads], dim=-1)))

class FeedForward(nn.Module):
    def __init__(self, n_embd, dropout):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(n_embd, 4*n_embd), nn.GELU(),
                                 nn.Linear(4*n_embd, n_embd), nn.Dropout(dropout))
    def forward(self, x): return self.net(x)

class Block(nn.Module):
    def __init__(self, n_embd, n_head, block_size, dropout):
        super().__init__()
        self.attn = MultiHead(n_embd, n_head, block_size, dropout)
        self.ff = FeedForward(n_embd, dropout)
        self.ln1, self.ln2 = nn.LayerNorm(n_embd), nn.LayerNorm(n_embd)
    def forward(self, x):
        x = x + self.attn(self.ln1(x))
        return x + self.ff(self.ln2(x))

class TinyGPT(nn.Module):
    # Byte-level vocabulary: UTF-8 bytes 0..255, supports English, বাংলা, हिन्दी.
    def __init__(self, vocab_size=256, block_size=128, n_embd=96, n_head=4, n_layer=3, dropout=0.1):
        super().__init__()
        assert n_embd % n_head == 0
        self.block_size = block_size
        self.tok = nn.Embedding(vocab_size, n_embd)
        self.pos = nn.Embedding(block_size, n_embd)
        self.blocks = nn.Sequential(*[Block(n_embd, n_head, block_size, dropout) for _ in range(n_layer)])
        self.ln = nn.LayerNorm(n_embd)
        self.head = nn.Linear(n_embd, vocab_size)
        self.apply(self.init_weights)
    @staticmethod
    def init_weights(m):
        if isinstance(m, (nn.Linear, nn.Embedding)):
            nn.init.normal_(m.weight, mean=0.0, std=0.02)
            if isinstance(m, nn.Linear) and m.bias is not None: nn.init.zeros_(m.bias)
    def forward(self, idx, targets=None):
        idx = idx[:, -self.block_size:]
        t = idx.size(1)
        x = self.tok(idx) + self.pos(torch.arange(t, device=idx.device))
        logits = self.head(self.ln(self.blocks(x)))
        loss = None
        if targets is not None:
            targets = targets[:, -t:]
            loss = F.cross_entropy(logits.reshape(-1, 256), targets.reshape(-1))
        return logits, loss
    @torch.no_grad()
    def generate(self, idx, max_new_tokens=180, temperature=0.8, top_k=40):
        self.eval()
        for _ in range(max_new_tokens):
            logits, _ = self(idx[:, -self.block_size:])
            logits = logits[:, -1, :] / max(temperature, 1e-4)
            vals, _ = torch.topk(logits, min(top_k, logits.size(-1)))
            logits[logits < vals[:, [-1]]] = -float("inf")
            idx = torch.cat([idx, torch.multinomial(F.softmax(logits, dim=-1), 1)], dim=1)
        return idx
