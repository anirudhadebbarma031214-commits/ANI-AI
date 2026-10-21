from pathlib import Path
import torch
from model import TinyGPT
path = Path("checkpoints/ani_tiny.pt")
if not path.exists(): raise SystemExit("Train first: python train.py --steps 300")
device = "cuda" if torch.cuda.is_available() else "cpu"
ckpt = torch.load(path, map_location=device, weights_only=False)
model = TinyGPT(**ckpt["config"]).to(device)
model.load_state_dict(ckpt["model_state"]); model.eval()
print("ANI Scratch AI (local model). Type /exit to quit.")
while True:
    try: prompt = input("\nYou: ")
    except (EOFError, KeyboardInterrupt): print(); break
    if prompt.strip().lower() in {"/exit","/quit"}: break
    prefix = ("\nUser: "+prompt+"\nAI: ").encode("utf-8")
    idx = torch.tensor([list(prefix)], dtype=torch.long, device=device)
    out = model.generate(idx, max_new_tokens=180)[0].tolist()
    text = bytes(out).decode("utf-8", errors="replace")
    answer = text[len(prefix.decode("utf-8", errors="replace")):]
    for marker in ("\nUser:", "\nYou:"):
        if marker in answer: answer = answer.split(marker)[0]
    print("ANI: "+answer.strip())
