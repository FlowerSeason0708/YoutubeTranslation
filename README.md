# Social Page Translator

Chrome/Edge Manifest V3 extension for translating visible page text on YouTube, Instagram, and X/Twitter into Simplified Chinese.

## Setup

```powershell
npm install
npm run build
```

Load the generated `dist` folder in Chrome or Edge:

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable developer mode.
3. Choose **Load unpacked**.
4. Select `C:\Users\王烨\Documents\YoutubeTranslation\dist`.

## Configuration

Open the extension settings and configure:

- Provider: `MiMo` or `OpenAI`
- API Key
- Model
- Target language

MiMo defaults to `mimo-v2.5` and calls `https://api.mimo-v2.com/v1/chat/completions`, with `https://api.xiaomimimo.com/v1/chat/completions` as a network fallback.
OpenAI defaults to `gpt-5.4-mini` and calls `https://api.openai.com/v1/responses`.

## Current Scope

- Supports YouTube watch pages, Instagram pages, and X/Twitter pages.
- Translates manually by clicking the injected toolbar buttons.
- YouTube: descriptions, loaded comments, and visible captions.
- Instagram: visible post captions and comments in the current page.
- X/Twitter: visible tweet text in the current page.
- Does not transcribe audio or OCR text embedded inside images.
