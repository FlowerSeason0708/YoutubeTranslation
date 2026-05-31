import type { TranslateMessage, TranslateResponse, TranslationItem } from "../shared/types";
import "./styles.css";

const ROOT_ID = "yt-page-translator-toolbar";
const TRANSLATION_CLASS = "ytpt-translation";
let currentUrl = "";

initialize();

function initialize(): void {
  injectToolbar();
  observeRouteChanges();
}

function injectToolbar(): void {
  if (document.getElementById(ROOT_ID) || !isWatchPage()) {
    return;
  }

  const host = document.querySelector("#below") ?? document.querySelector("#primary");
  if (!host) {
    window.setTimeout(injectToolbar, 500);
    return;
  }

  const toolbar = document.createElement("div");
  toolbar.id = ROOT_ID;
  toolbar.innerHTML = `
    <div class="ytpt-actions">
      <button type="button" data-action="description">翻译简介</button>
      <button type="button" data-action="comments">翻译评论</button>
      <button type="button" data-action="captions">翻译字幕</button>
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

  host.prepend(toolbar);
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

async function handleAction(action: string): Promise<void> {
  try {
    if (!isWatchPage()) {
      setStatus("仅支持 YouTube 视频页。");
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
    setStatus(error instanceof Error ? error.message : "翻译失败。");
  }
}

function collectTargets(action: string): Array<{ item: TranslationItem; element: HTMLElement }> {
  if (action === "description") {
    return collectDescription();
  }
  if (action === "comments") {
    return collectComments();
  }
  if (action === "captions") {
    return collectCaptions();
  }
  return [];
}

function collectDescription(): Array<{ item: TranslationItem; element: HTMLElement }> {
  const selectors = ["#description-inline-expander", "ytd-text-inline-expander", "#description"];
  const element = selectors
    .map((selector) => document.querySelector<HTMLElement>(selector))
    .find((candidate) => candidate && candidate.innerText.trim().length > 0);

  if (!element || hasTranslation(element)) {
    return [];
  }

  return [{ item: { id: "description", text: element.innerText.trim() }, element }];
}

function collectComments(): Array<{ item: TranslationItem; element: HTMLElement }> {
  const comments = Array.from(
    document.querySelectorAll<HTMLElement>("ytd-comment-thread-renderer #content-text")
  );

  return comments
    .filter((element) => !hasTranslation(element) && element.innerText.trim().length > 0)
    .slice(0, 30)
    .map((element, index) => ({
      item: {
        id: `comment-${index}`,
        text: element.innerText.trim()
      },
      element
    }));
}

function collectCaptions(): Array<{ item: TranslationItem; element: HTMLElement }> {
  const captions = Array.from(document.querySelectorAll<HTMLElement>(".ytp-caption-segment"));
  const unique = new Map<string, HTMLElement>();

  for (const caption of captions) {
    const text = caption.innerText.trim();
    if (text && !unique.has(text) && !hasTranslation(caption)) {
      unique.set(text, caption);
    }
  }

  return Array.from(unique.entries()).map(([text, element], index) => ({
    item: { id: `caption-${index}`, text },
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

function isWatchPage(): boolean {
  return location.hostname === "www.youtube.com" && location.pathname === "/watch";
}
