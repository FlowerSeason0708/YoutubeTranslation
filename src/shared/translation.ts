import type { TranslationItem, TranslationResult } from "./types";

interface PromptInput {
  targetLanguage: string;
  items: TranslationItem[];
}

export function buildTranslationPrompt({ targetLanguage, items }: PromptInput): string {
  const payload = items.map((item) => ({
    id: item.id,
    text: item.text
  }));

  return [
    `Translate each text item into ${targetLanguage}.`,
    "Return JSON only as an array of objects with exactly these fields: id, text.",
    "Do not add explanations, markdown fences, or extra keys.",
    "Preserve links, timestamps, usernames, emoji, line breaks, and the original tone.",
    `Items: ${JSON.stringify(payload)}`
  ].join("\n");
}

export function parseTranslatedItems(rawText: string, expectedIds: string[]): TranslationResult[] {
  const cleaned = stripJsonFence(rawText.trim());
  const parsed = JSON.parse(cleaned) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Translation response was not a JSON array.");
  }

  const translations = parsed.map((entry) => {
    if (!isTranslationResult(entry)) {
      throw new Error("Translation response contained an invalid item.");
    }
    return entry;
  });

  const seen = new Set(translations.map((entry) => entry.id));
  const missing = expectedIds.filter((id) => !seen.has(id));
  if (missing.length > 0) {
    throw new Error(`Missing translation for ids: ${missing.join(", ")}`);
  }

  return translations;
}

function stripJsonFence(value: string): string {
  const fence = value.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fence ? fence[1].trim() : value;
}

function isTranslationResult(value: unknown): value is TranslationResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === "string" && typeof candidate.text === "string";
}
