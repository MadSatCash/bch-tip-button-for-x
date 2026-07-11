"use strict";

const INSERT_MESSAGE = "bch-tip-insert-reply";

async function insertReplyInMainWorld(text, targetToken) {
  const isVisible = (element) => {
    if (!(element instanceof HTMLElement)) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  };

  const normalize = (value) => String(value || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const selector = '[data-testid^="tweetTextarea_"][contenteditable="true"]';
  const editorText = (candidate) => candidate?.innerText || candidate?.textContent || "";
  const editor = [...document.querySelectorAll(selector)].find((candidate) =>
    isVisible(candidate) && candidate.getAttribute("data-bch-tip-target") === targetToken
  ) || null;

  if (!editor) return { ok: false, reason: "editor-not-found", actual: "" };

  const before = editorText(editor);
  if (normalize(before)) return { ok: false, reason: "editor-not-empty", actual: before };

  editor.focus();

  const clipboardData = new DataTransfer();
  clipboardData.setData("text/plain", text);
  const pasteEvent = new ClipboardEvent("paste", {
    bubbles: true,
    cancelable: true,
    composed: true,
    clipboardData
  });

  editor.dispatchEvent(pasteEvent);
  let actual = "";
  for (let attempt = 0; attempt < 15; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    actual = editorText(editor);
    if (normalize(actual) === normalize(text)) break;
  }

  return {
    ok: normalize(actual) === normalize(text),
    handled: pasteEvent.defaultPrevented,
    actual
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== INSERT_MESSAGE) return false;

  const tabId = sender.tab?.id;
  if (!Number.isInteger(tabId)
      || typeof message.text !== "string"
      || !message.text.trim()
      || typeof message.targetToken !== "string"
      || !message.targetToken
      || message.targetToken.length > 100) {
    sendResponse({ ok: false, reason: "invalid-request", actual: "" });
    return false;
  }

  chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: insertReplyInMainWorld,
    args: [message.text, message.targetToken]
  }).then((results) => {
    sendResponse(results?.[0]?.result || { ok: false, reason: "no-result", actual: "" });
  }).catch((error) => {
    sendResponse({ ok: false, reason: "script-error", error: error?.message || String(error), actual: "" });
  });

  return true;
});
