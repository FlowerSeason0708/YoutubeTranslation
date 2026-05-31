export type ProviderName = "openai" | "mimo";

export interface TranslatorSettings {
  provider: ProviderName;
  apiKey: string;
  model: string;
  targetLanguage: string;
  showOriginal: boolean;
}

export interface TranslationItem {
  id: string;
  text: string;
}

export interface TranslationResult {
  id: string;
  text: string;
}

export interface TranslateMessage {
  type: "translate";
  items: TranslationItem[];
}

export interface TranslateResponse {
  ok: boolean;
  translations?: TranslationResult[];
  error?: string;
}

export const DEFAULT_SETTINGS: TranslatorSettings = {
  provider: "mimo",
  apiKey: "",
  model: "mimo-v2.5",
  targetLanguage: "中文简体",
  showOriginal: true
};

export const SETTINGS_KEY = "youtubeTranslatorSettings";
