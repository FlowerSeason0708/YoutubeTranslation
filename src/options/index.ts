import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  type ProviderName,
  type TranslatorSettings
} from "../shared/types";
import "./styles.css";

const form = document.querySelector<HTMLFormElement>("#settings-form");
const provider = document.querySelector<HTMLSelectElement>("#provider");
const apiKey = document.querySelector<HTMLInputElement>("#apiKey");
const model = document.querySelector<HTMLInputElement>("#model");
const targetLanguage = document.querySelector<HTMLInputElement>("#targetLanguage");
const showOriginal = document.querySelector<HTMLInputElement>("#showOriginal");
const status = document.querySelector<HTMLElement>("#status");

void load();

provider?.addEventListener("change", () => {
  if (!model || !provider) {
    return;
  }
  model.value = provider.value === "mimo" ? "mimo-v2.5" : "gpt-5.4-mini";
});

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  void save();
});

async function load(): Promise<void> {
  const result = await chrome.storage.local.get(SETTINGS_KEY);
  const settings = {
    ...DEFAULT_SETTINGS,
    ...(result[SETTINGS_KEY] as Partial<TranslatorSettings> | undefined)
  };

  if (provider) provider.value = settings.provider;
  if (apiKey) apiKey.value = settings.apiKey;
  if (model) model.value = settings.model;
  if (targetLanguage) targetLanguage.value = settings.targetLanguage;
  if (showOriginal) showOriginal.checked = settings.showOriginal;
}

async function save(): Promise<void> {
  const settings: TranslatorSettings = {
    provider: (provider?.value ?? DEFAULT_SETTINGS.provider) as ProviderName,
    apiKey: apiKey?.value.trim() ?? "",
    model: model?.value.trim() || DEFAULT_SETTINGS.model,
    targetLanguage: targetLanguage?.value.trim() || DEFAULT_SETTINGS.targetLanguage,
    showOriginal: showOriginal?.checked ?? true
  };

  await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
  if (status) {
    status.textContent = "已保存。";
  }
}
