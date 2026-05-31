import { DEFAULT_SETTINGS, SETTINGS_KEY, type TranslatorSettings } from "../shared/types";
import "./styles.css";

const summary = document.querySelector<HTMLElement>("#summary");
const button = document.querySelector<HTMLButtonElement>("#open-options");

void loadSummary();

button?.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

async function loadSummary(): Promise<void> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const settings = {
    ...DEFAULT_SETTINGS,
    ...(result[SETTINGS_KEY] as Partial<TranslatorSettings> | undefined)
  };

  if (summary) {
    summary.textContent = `${settings.provider.toUpperCase()} · ${settings.model} · ${settings.targetLanguage}`;
  }
}
