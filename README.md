# ANI AI — Your AI. Your Space.

A static, futuristic AI chat web app designed for GitHub Pages.

## Files

- `index.html` — app structure
- `style.css` — UI, responsive layout and animations
- `script.js` — chats, localStorage, API integration, markdown, settings and import/export

## Real AI API

ANI AI does **not** contain a fake hardcoded AI response system.

GitHub Pages can host the interface, but it cannot safely hide a private API key. In **Settings**, enter:

1. An OpenAI-compatible chat-completions endpoint
2. Your own API key
3. The model name supported by that provider

The app sends a standard request shaped like:

```json
{
  "model": "YOUR_MODEL",
  "messages": [
    {"role": "user", "content": "Hello"}
  ],
  "temperature": 0.7
}
```

The provider must return an OpenAI-compatible response containing:

`choices[0].message.content`

### Important security note

The API key is stored in this browser's `localStorage` because this is a static GitHub Pages app. Anyone with access to that browser profile could inspect it. Never put your personal production/server secret into public source code.

For a public multi-user deployment, use a backend/proxy you control and keep the provider secret on the server.

## GitHub Pages

Upload `index.html`, `style.css`, and `script.js` to a GitHub repository.

Then:

**Repository → Settings → Pages → Deploy from a branch → main → / (root) → Save**

Wait for the Pages build to finish.

## No build system

ANI AI intentionally uses:

- No Node.js
- No npm
- No bundler
- No framework
- No required external CDN

It can run as a plain static website.
