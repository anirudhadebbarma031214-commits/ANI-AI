"""Quick CPU-friendly check that the from-scratch model can run."""
import torch
from model import TinyGPT

def main():
    torch.manual_seed(7)
    model = TinyGPT(block_size=32, n_embd=32, n_head=4, n_layer=1)
    sample = torch.randint(0, 256, (2, 16), dtype=torch.long)
    logits, loss = model(sample, sample)
    assert logits.shape == (2, 16, 256), f"Unexpected logits shape: {logits.shape}"
    assert loss is not None and torch.isfinite(loss), f"Invalid loss: {loss}"
    loss.backward()
    print("PASS: forward pass, finite loss, and backward pass.")
    print("Random initialization only; no pretrained model is loaded.")

if __name__ == "__main__":
    main()
