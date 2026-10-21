# ANI Scratch AI (from-scratch prototype)

This is a small decoder-only Transformer with **randomly initialized weights**. It does not call an AI API and does not load pretrained or fine-tuned model weights. It learns to predict the next UTF-8 byte from your corpus, supporting English, বাংলা and हिन्दी.

## Run on Windows
1. Install Python 3.11 or 3.12 from https://www.python.org/downloads/windows/ and enable Add Python to PATH.
2. Double-click `setup.bat` and wait.
3. Double-click `train_model.bat`. It trains 300 steps and saves `checkpoints/ani_tiny.pt`.
4. Double-click `talk_to_ai.bat` to chat. Type `/exit` to quit.

Or use Command Prompt inside this folder:
```bat
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python train.py --steps 300
python chat.py
```

## Important
This is an educational prototype, not a ChatGPT-level assistant. The included corpus is tiny, so its replies may be repetitive or nonsensical. A large ChatGPT-level model cannot realistically be trained on a typical 16 GB RAM integrated-graphics PC; it requires very large, legally sourced datasets and substantial GPU compute. Add high-quality balanced English/Bengali/Hindi text you have permission to use, then evaluate and scale gradually. The saved checkpoint is your own trained weights.
