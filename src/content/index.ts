import type { TranslateMessage, TranslateResponse, TranslationItem } from "../shared/types";
import "./styles.css";

const ROOT_ID = "social-translator-toolbar";
const TRANSLATION_CLASS = "ytpt-translation";
let currentUrl = "";

initialize();

function initialize(): void {
  injectToolbar();
  observeRouteChanges();
  observeDom();
}

function injectToolbar(): void {
  if (document.getElementById(ROOT_ID) || !isSupportedPage()) {
    return;
  }

  const toolbar = document.createElement("div");
  toolbar.id = ROOT_ID;
  toolbar.innerHTML = `
    <div class="ytpt-actions">
      ${renderButtons()}
    </div>
    <div class="ytpt-status" aria-live="polite">准备就绪</div>
  `;

  toolbar.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
    if (!button) {
      return;
    }
    void handleAction(button.dataset.action ?? "");
  });

  document.documentElement.append(toolbar);
}

function renderButtons(): string {
  if (isYouTubeWatchPage()) {
    return `
      <button type="button" data-action="description">翻译简介</button>
      <button type="button" data-action="comments">翻译评论</button>
      <button type="button" data-action="captions">翻译字幕</button>
    `;
  }

  if (isInstagramPage()) {
    return `<button type="button" data-action="instagram-visible">翻译当前 Ins 文本</button>`;
  }

  return `<button type="button" data-action="x-visible">翻译当前 X 文本</button>`;
}

function observeRouteChanges(): void {
  currentUrl = location.href;
  const observer = new MutationObserver(() => {
    if (location.href === currentUrl) {
      return;
    }
    currentUrl = location.href;
    resetTranslations();
    window.setTimeout(injectToolbar, 500);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function observeDom(): void {
  const observer = new MutationObserver(() => {
    if (!document.getElementById(ROOT_ID) && isSupportedPage()) {
      injectToolbar();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

async function handleAction(action: string): Promise<void> {
  try {
    if (!isSupportedPage()) {
      setStatus("当前网站暂不支持。");
      return;
    }

    const targets = collectTargets(action);
    if (targets.length === 0) {
      setStatus(action === "captions" ? "未检测到可翻译字幕。" : "没有找到可翻译文本。");
      return;
    }

    setStatus(`正在翻译 ${targets.length} 段文本...`);
    const response = await sendTranslate(targets.map(({ item }) => item));
    if (!response.ok || !response.translations) {
      setStatus(response.error ?? "翻译失败。");
      return;
    }

    const byId = new Map(response.translations.map((item) => [item.id, item.text]));
    for (const target of targets) {
      const text = byId.get(target.item.id);
      if (text) {
        renderTranslation(target.element, text);
      }
    }
    setStatus(`已翻译 ${response.translations.length} 段文本。`);
  } catch (error) {
    setStatus(formatError(error));
  }
}

function collectTargets(action: string): Array<{ item: TranslationItem; element: HTMLElement }> {
  if (action === "description") {
    return collectDescription();
  }
  if (action === "comments") {
    return collectYouTubeComments();
  }
  if (action === "captions") {
    return collectCaptions();
  }
  if (action === "instagram-visible") {
    return collectInstagramText();
  }
  if (action === "x-visible") {
    return collectXText();
  }
  return [];
}

function collectDescription(): Array<{ item: TranslationItem; element: HTMLElement }> {
  const selectors = [
    "#description-inline-expander",
    "ytd-text-inline-expander",
    "#description",
    "ytd-watch-metadata #description"
  ];
  const element = selectors
    .map((selector) => document.querySelector<HTMLElement>(selector))
    .find((candidate) => candidate && getElementText(candidate).length > 0);

  if (!element || hasTranslation(element)) {
    return [];
  }

  return [{ item: { id: "description", text: getElementText(element) }, element }];
}

function collectYouTubeComments(): Array<{ item: TranslationItem; element: HTMLElement }> {
  const comments = uniqueElements([
    ...document.querySelectorAll<HTMLElement>("ytd-comment-thread-renderer #content-text"),
    ...document.querySelectorAll<HTMLElement>("ytd-comment-view-model #content-text"),
    ...document.querySelectorAll<HTMLElement>("ytd-comment-view-model yt-attributed-string#content-text"),
    ...document.querySelectorAll<HTMLElement>("#comments #content-text"),
    ...document.querySelectorAll<HTMLElement>("ytd-engagement-panel-section-list-renderer #content-text")
  ]);

  return toTranslationTargets(comments, "youtube-comment", 50);
}

function collectCaptions(): Array<{ item: TranslationItem; element: HTMLElement }> {
  const captions = Array.from(document.querySelectorAll<HTMLElement>(".ytp-caption-segment"));
  const unique = new Map<string, HTMLElement>();

  for (const caption of captions) {
    const text = getElementText(caption);
    if (text && !unique.has(text) && !hasTranslation(caption)) {
      unique.set(text, caption);
    }
  }

  return Array.from(unique.entries()).map(([text, element], index) => ({
    item: { id: `caption-${index}`, text },
    element
  }));
}

function collectInstagramText(): Array<{ item: TranslationItem; element: HTMLElement }> {
  const candidates = uniqueElements([
    ...document.querySelectorAll<HTMLElement>("article h1"),
    ...document.querySelectorAll<HTMLElement>("article span[dir='auto']"),
    ...document.querySelectorAll<HTMLElement>("main article ul span[dir='auto']"),
    ...document.querySelectorAll<HTMLElement>("main article div[role='button'] span[dir='auto']")
  ]).filter((element) => !isInsideToolbar(element));

  return toTranslationTargets(candidates, "instagram-text", 60);
}

function collectXText(): Array<{ item: TranslationItem; element: HTMLElement }> {
  const candidates = uniqueElements([
    ...document.querySelectorAll<HTMLElement>("article [data-testid='tweetText']"),
    ...document.querySelectorAll<HTMLElement>("article div[lang]"),
    ...document.querySelectorAll<HTMLElement>("[data-testid='cellInnerDiv'] [data-testid='tweetText']")
  ]).filter((element) => !isInsideToolbar(element));

  return toTranslationTargets(candidates, "x-text", 60);
}

function toTranslationTargets(
  elements: HTMLElement[],
  prefix: string,
  limit: number
): Array<{ item: TranslationItem; element: HTMLElement }> {
  return elements
    .filter((element) => isVisible(element))
    .filter((element) => !hasTranslation(element))
    .map((element) => ({ element, text: getElementText(element) }))
    .filter(({ text }) => shouldTranslateText(text))
    .slice(0, limit)
    .map(({ element, text }, index) => ({
      item: {
        id: `${prefix}-${index}`,
        text
      },
      element
    }));
}

function renderTranslation(anchor: HTMLElement, text: string): void {
  if (hasTranslation(anchor)) {
    return;
  }

  const translation = document.createElement("div");
  translation.className = TRANSLATION_CLASS;
  translation.textContent = text;
  anchor.insertAdjacentElement("afterend", translation);
}

function hasTranslation(element: HTMLElement): boolean {
  return element.nextElementSibling?.classList.contains(TRANSLATION_CLASS) ?? false;
}

function uniqueElements(elements: HTMLElement[]): HTMLElement[] {
  return Array.from(new Set(elements));
}

function getElementText(element: HTMLElement): string {
  return (element.innerText || element.textContent || "").trim();
}

function shouldTranslateText(text: string): boolean {
  if (text.length < 2) {
    return false;
  }
  const ignored = new Set(["更多", "回复", "关注", "查看全部", "显示更多", "Show more"]);
  return !ignored.has(text);
}

function isVisible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function isInsideToolbar(element: HTMLElement): boolean {
  return Boolean(element.closest(`#${ROOT_ID}`));
}

function resetTranslations(): void {
  document.getElementById(ROOT_ID)?.remove();
  document.querySelectorAll(`.${TRANSLATION_CLASS}`).forEach((node) => node.remove());
}

function setStatus(message: string): void {
  const status = document.querySelector<HTMLElement>(`#${ROOT_ID} .ytpt-status`);
  if (status) {
    status.textContent = message;
  }
}

function sendTranslate(items: TranslationItem[]): Promise<TranslateResponse> {
  return chrome.runtime.sendMessage({ type: "translate", items } satisfies TranslateMessage);
}

function formatError(error: unknown): string {
  const message = error instanceof Error ? error.message : "翻译失败。";
  if (message.includes("Extension context invalidated")) {
    return "扩展刚更新过，请刷新当前页面后重试。";
  }
  return message;
}

function isSupportedPage(): boolean {
  return isYouTubeWatchPage() || isInstagramPage() || isXPage();
}

function isYouTubeWatchPage(): boolean {
  return location.hostname === "www.youtube.com" && location.pathname === "/watch";
}

function isInstagramPage(): boolean {
  return location.hostname === "www.instagram.com" || location.hostname === "instagram.com";
}

function isXPage(): boolean {
  return ["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(location.hostname);
}
