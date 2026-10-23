# ANI Scratch AI — train your own tiny language model

This folder contains an educational decoder-only Transformer written with PyTorch. Its parameters are **randomly initialized**. It does not call an AI API and does not load pretrained or fine-tuned model weights. It predicts the next UTF-8 byte, so English, বাংলা, and हिन्दी text can be represented without downloading a tokenizer.

## Quick start on Windows

1. Install Python 3.11 or 3.12 from https://www.python.org/downloads/windows/. During setup, enable **Add Python to PATH**.
2. Open this folder in File Explorer: `ANI-AI\scratch_ai`.
3. Double-click `setup.bat` and wait for installation to finish. Internet is needed once to download PyTorch; there is no paid cloud service.
4. Double-click `train_model.bat`. This trains the model on `data\train.txt` and saves your weights to `checkpoints\ani_tiny.pt`.
5. Double-click `talk_to_ai.bat` to chat locally. Type `/exit` to quit.

Or open Command Prompt in this folder and run:

```bat
py -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
python smoke_test.py
python train.py --steps 300
python chat.py
```

## Train on your own text

Edit `data/train.txt` and add text you wrote, public-domain material, or material whose license permits machine-learning use. Keep a balanced mix of English, Bengali, and Hindi. Do not include passwords, private conversations, or personal records.

For a quick experiment, use `python train.py --steps 300`. For a longer experiment, try `python train.py --steps 2000` after confirming your PC has enough free memory. More steps do not automatically make a model knowledgeable; data quality and quantity matter greatly.

## What “from scratch” means here

- The Transformer is implemented in `model.py`.
- The vocabulary is the 256 possible UTF-8 byte values.
- Weights are initialized randomly in the model code.
- `train.py` learns from the local text file and saves the resulting checkpoint.
- `chat.py` loads that checkpoint and generates text on your computer.
- No pretrained model, fine-tuning, API key, paid GPU, or cloud inference is used.

## Important limitations

This is a tiny educational prototype, not a ChatGPT-level assistant. The included corpus is only a starter sample; expect repetitive, inaccurate, or malformed answers. Byte-level generation can occasionally produce imperfect Unicode text. A capable multilingual assistant needs much larger, carefully licensed datasets, extensive evaluation, and substantially more compute. Start small, test, and improve gradually.

The trained checkpoint is generated locally and intentionally excluded from Git commits because it is a training artifact, not source code.
