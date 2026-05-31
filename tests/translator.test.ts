import { describe, expect, test } from "vitest";
import { buildTranslationPrompt, parseTranslatedItems } from "../src/shared/translation";
import { createProvider } from "../src/background/providers";

describe("translation helpers", () => {
  test("buildTranslationPrompt preserves item ids and asks for JSON only", () => {
    const prompt = buildTranslationPrompt({
      targetLanguage: "中文简体",
      items: [
        { id: "description", text: "A useful video" },
        { id: "comment-1", text: "Thanks for sharing!" }
      ]
    });

    expect(prompt).toContain('"id":"description"');
    expect(prompt).toContain('"id":"comment-1"');
    expect(prompt).toContain("中文简体");
    expect(prompt).toContain("JSON");
  });

  test("parseTranslatedItems rejects missing ids", () => {
    expect(() =>
      parseTranslatedItems('[{"id":"a","text":"甲"}]', ["a", "b"])
    ).toThrow(/missing translation/i);
  });
});

describe("providers", () => {
  test("MiMo provider calls OpenAI-compatible chat completions", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetcher: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify([{ id: "x", text: "你好" }])
              }
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };

    const provider = createProvider(
      {
        provider: "mimo",
        apiKey: "secret",
        model: "mimo-v2.5",
        targetLanguage: "中文简体",
        showOriginal: true
      },
      fetcher
    );

    const result = await provider.translate([{ id: "x", text: "Hello" }]);

    expect(calls[0].url).toBe("https://api.mimo-v2.com/v1/chat/completions");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers).toMatchObject({
      Authorization: "Bearer secret"
    });
    expect(result).toEqual([{ id: "x", text: "你好" }]);
  });

  test("MiMo provider retries with Xiaomi fallback host after network failure", async () => {
    const urls: string[] = [];
    const fetcher: typeof fetch = async (url) => {
      urls.push(String(url));
      if (urls.length === 1) {
        throw new TypeError("Failed to fetch");
      }

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify([{ id: "x", text: "你好" }])
              }
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };

    const provider = createProvider(
      {
        provider: "mimo",
        apiKey: "secret",
        model: "mimo-v2.5",
        targetLanguage: "中文简体",
        showOriginal: true
      },
      fetcher
    );

    const result = await provider.translate([{ id: "x", text: "Hello" }]);

    expect(urls).toEqual([
      "https://api.mimo-v2.com/v1/chat/completions",
      "https://api.xiaomimimo.com/v1/chat/completions"
    ]);
    expect(result).toEqual([{ id: "x", text: "你好" }]);
  });

  test("OpenAI provider calls responses API", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetcher: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(
        JSON.stringify({
          output_text: JSON.stringify([{ id: "x", text: "你好" }])
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };

    const provider = createProvider(
      {
        provider: "openai",
        apiKey: "secret",
        model: "gpt-5.4-mini",
        targetLanguage: "中文简体",
        showOriginal: true
      },
      fetcher
    );

    const result = await provider.translate([{ id: "x", text: "Hello" }]);

    expect(calls[0].url).toBe("https://api.openai.com/v1/responses");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers).toMatchObject({
      Authorization: "Bearer secret"
    });
    expect(result).toEqual([{ id: "x", text: "你好" }]);
  });
});
