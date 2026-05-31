import { createProvider } from "./providers";
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  type TranslateMessage,
  type TranslateResponse,
  type TranslatorSettings
} from "../shared/types";

chrome.runtime.onMessage.addListener((message: TranslateMessage, _sender, sendResponse) => {
  if (message.type !== "translate") {
    return false;
  }

  handleTranslate(message)
    .then(sendResponse)
    .catch((error: unknown) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Unknown translation error."
      } satisfies TranslateResponse);
    });

  return true;
});

async function handleTranslate(message: TranslateMessage): Promise<TranslateResponse> {
  const settings = await loadSettings();
  const provider = createProvider(settings);
  const translations = await provider.translate(message.items);
  return { ok: true, translations };
}

async function loadSettings(): Promise<TranslatorSettings> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  return {
    ...DEFAULT_SETTINGS,
    ...(result[SETTINGS_KEY] as Partial<TranslatorSettings> | undefined)
  };
}
