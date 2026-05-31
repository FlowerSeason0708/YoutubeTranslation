import { buildTranslationPrompt, parseTranslatedItems } from "../shared/translation";
import type { TranslationItem, TranslationResult, TranslatorSettings } from "../shared/types";

export interface TranslatorProvider {
  translate(items: TranslationItem[]): Promise<TranslationResult[]>;
}

type Fetcher = typeof fetch;
const defaultFetcher: Fetcher = (input, init) => fetch(input, init);

export function createProvider(settings: TranslatorSettings, fetcher: Fetcher = defaultFetcher): TranslatorProvider {
  if (!settings.apiKey.trim()) {
    throw new Error("API key is not configured.");
  }

  if (settings.provider === "openai") {
    return new OpenAIResponsesProvider(settings, fetcher);
  }

  return new MiMoChatProvider(settings, fetcher);
}

class OpenAIResponsesProvider implements TranslatorProvider {
  constructor(
    private readonly settings: TranslatorSettings,
    private readonly fetcher: Fetcher
  ) {}

  async translate(items: TranslationItem[]): Promise<TranslationResult[]> {
    const prompt = buildTranslationPrompt({
      targetLanguage: this.settings.targetLanguage,
      items
    });

    const response = await this.fetcher("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.settings.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.settings.model,
        input: prompt
      })
    });

    const json = await parseApiResponse(response);
    const text = extractOpenAIText(json);
    return parseTranslatedItems(text, items.map((item) => item.id));
  }
}

class MiMoChatProvider implements TranslatorProvider {
  private readonly endpoints = [
    "https://api.mimo-v2.com/v1/chat/completions",
    "https://api.xiaomimimo.com/v1/chat/completions"
  ];

  constructor(
    private readonly settings: TranslatorSettings,
    private readonly fetcher: Fetcher
  ) {}

  async translate(items: TranslationItem[]): Promise<TranslationResult[]> {
    const prompt = buildTranslationPrompt({
      targetLanguage: this.settings.targetLanguage,
      items
    });

    const response = await this.fetchWithFallback({
      model: this.settings.model,
      messages: [
        {
          role: "system",
          content: "You are a precise translation engine."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.2
    });

    const json = await parseApiResponse(response);
    const text = extractChatText(json);
    return parseTranslatedItems(text, items.map((item) => item.id));
  }

  private async fetchWithFallback(body: unknown): Promise<Response> {
    let lastError: unknown;

    for (const endpoint of this.endpoints) {
      try {
        return await this.fetcher(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.settings.apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        });
      } catch (error) {
        lastError = error;
      }
    }

    throw normalizeNetworkError(lastError);
  }
}

async function parseApiResponse(response: Response): Promise<unknown> {
  const json = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message = extractApiError(json) ?? `API request failed with status ${response.status}.`;
    throw new Error(message);
  }

  return json;
}

function extractOpenAIText(json: unknown): string {
  if (typeof json !== "object" || json === null) {
    throw new Error("OpenAI response was empty.");
  }

  const outputText = (json as Record<string, unknown>).output_text;
  if (typeof outputText === "string") {
    return outputText;
  }

  throw new Error("OpenAI response did not include output_text.");
}

function extractChatText(json: unknown): string {
  const choices = (json as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
  const content = choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("Chat completion response did not include message content.");
  }
  return content;
}

function extractApiError(json: unknown): string | undefined {
  const error = (json as { error?: { message?: unknown } } | null)?.error;
  return typeof error?.message === "string" ? error.message : undefined;
}

function normalizeNetworkError(error: unknown): Error {
  if (error instanceof Error && error.message.includes("Failed to fetch")) {
    return new Error("网络连接失败：无法连接翻译 API。MiMo 默认域名在当前网络下可能不可用，请检查网络/代理，或切换到 OpenAI Provider。");
  }
  return error instanceof Error ? error : new Error("Network request failed.");
}
