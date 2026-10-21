import argparse, time
from pathlib import Path
import torch
from model import TinyGPT

p = argparse.ArgumentParser()
p.add_argument("--data", default="data/train.txt")
p.add_argument("--steps", type=int, default=300)
p.add_argument("--batch-size", type=int, default=4)
p.add_argument("--block-size", type=int, default=96)
p.add_argument("--eval-every", type=int, default=100)
a = p.parse_args()
torch.manual_seed(1337)
device = "cuda" if torch.cuda.is_available() else "cpu"
path = Path(a.data)
if not path.exists(): raise SystemExit(f"Missing {path}")
raw = path.read_text(encoding="utf-8")
tokens = torch.tensor(list(raw.encode("utf-8")), dtype=torch.long)
if len(tokens) < a.block_size * 3: raise SystemExit("Add more text to the training corpus first.")
split = int(len(tokens)*0.9)
train_data, val_data = tokens[:split], tokens[split:]
if len(val_data) <= a.block_size + 1: val_data = train_data
def batch(src):
    starts = torch.randint(0, len(src)-a.block_size-1, (a.batch_size,))
    x = torch.stack([src[i:i+a.block_size] for i in starts]).to(device)
    y = torch.stack([src[i+1:i+a.block_size+1] for i in starts]).to(device)
    return x, y
model = TinyGPT(block_size=a.block_size).to(device)
opt = torch.optim.AdamW(model.parameters(), lr=3e-4)
print(f"Device={device}; parameters={sum(x.numel() for x in model.parameters()):,}; bytes={len(tokens):,}")
print("Training from random initialization; no pretrained model/API is used.")
started = time.time()
for step in range(1, a.steps+1):
    xb, yb = batch(train_data)
    _, loss = model(xb, yb)
    opt.zero_grad(set_to_none=True); loss.backward()
    torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0); opt.step()
    if step == 1 or step % a.eval_every == 0 or step == a.steps:
        print(f"step {step}/{a.steps} loss={loss.item():.3f} elapsed={time.time()-started:.1f}s")
out = Path("checkpoints/ani_tiny.pt"); out.parent.mkdir(parents=True, exist_ok=True)
torch.save({"model_state": model.cpu().state_dict(),
            "config": {"vocab_size":256,"block_size":a.block_size,"n_embd":96,"n_head":4,"n_layer":3,"dropout":0.1},
            "steps":a.steps,"training_bytes":len(tokens)}, out)
print(f"Saved your learned weights: {out.resolve()}")
