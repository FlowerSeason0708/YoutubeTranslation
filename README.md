# YouTube Page Translator

Chrome/Edge Manifest V3 extension for translating YouTube video descriptions, loaded comments, and visible YouTube captions into Simplified Chinese.

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

MiMo defaults to `mimo-v2.5` and calls `https://api.mimo-v2.com/v1/chat/completions`.
OpenAI defaults to `gpt-5.4-mini` and calls `https://api.openai.com/v1/responses`.

## Current Scope

- Supports YouTube watch pages only.
- Translates manually by clicking the injected toolbar buttons.
- Does not transcribe audio. Caption translation depends on YouTube captions already being available on the page.
