(() => {
  "use strict";

  const Core = globalThis.BCHTipCore;
  if (!Core) return;

  const SELECTORS = {
    tweet: 'article[data-testid="tweet"]',
    reply: '[data-testid="reply"]',
    actionGroup: 'div[role="group"]',
    composer: '[data-testid^="tweetTextarea_"][contenteditable="true"]',
    submit: '[data-testid="tweetButton"], [data-testid="tweetButtonInline"]'
  };
  const VERIFY_KEY = "bch-tip-pending-verification";

  const COPY = {
    en: {
      buttonTitle: (username) => `Send BCH to @${username}`,
      buttonAria: (username) => `Send a BCH tip to @${username}`,
      buttonLabel: "Tip",
      modalTitle: "Send BCH tip",
      close: "Close",
      recipient: (username) => `To @${username}`,
      amount: "Amount",
      amountAria: "BCH amount",
      preview: "Reply that will be posted",
      invalidAmount: "Invalid amount",
      lowAmount: "The bot may reject amounts below 0.0001 BCH.",
      notice: "The reply will be posted automatically in this tab.",
      cancel: "Cancel",
      confirm: "Send tip",
      language: "Language",
      opening: "Opening the reply…",
      writing: "Writing the reply…",
      posting: "Posting the tip…",
      posted: "Tip posted.",
      refreshing: "Tip posted. Updating the conversation…",
      missingReply: "I couldn't find X's Reply button for this post.",
      missingComposer: "X didn't open the reply composer.",
      writeRejected: "X didn't accept the automatic text entry.",
      textNotReady: "The reply text could not be verified.",
      composerNotEmpty: "The reply editor was not empty. Nothing was posted.",
      submitDisabled: "X didn't enable the Reply button.",
      submitNotConfirmed: "X didn't confirm that the reply was sent.",
      manualReview: "Automatic posting stopped. Review the open reply in X.",
      uncertain: "X did not confirm a new reply. Check the conversation before allowing another tip.",
      allowRetry: "I've checked — allow retry",
      checking: "Checking the conversation…",
      genericError: "The tip could not be posted."
    },
    es: {
      buttonTitle: (username) => `Enviar BCH a @${username}`,
      buttonAria: (username) => `Enviar propina BCH a @${username}`,
      buttonLabel: "Propina",
      modalTitle: "Enviar propina BCH",
      close: "Cerrar",
      recipient: (username) => `Para @${username}`,
      amount: "Monto",
      amountAria: "Monto en BCH",
      preview: "Respuesta que se publicará",
      invalidAmount: "Monto inválido",
      lowAmount: "El bot podría rechazar montos menores a 0.0001 BCH.",
      notice: "La respuesta se publicará automáticamente en esta pestaña.",
      cancel: "Cancelar",
      confirm: "Enviar propina",
      language: "Idioma",
      opening: "Abriendo la respuesta…",
      writing: "Escribiendo la respuesta…",
      posting: "Publicando la propina…",
      posted: "Propina publicada.",
      refreshing: "Propina publicada. Actualizando la conversación…",
      missingReply: "No pude encontrar el botón Responder de este post.",
      missingComposer: "X no abrió el cuadro de respuesta.",
      writeRejected: "X no aceptó la escritura automática.",
      textNotReady: "No se pudo verificar el texto de la respuesta.",
      composerNotEmpty: "El cuadro de respuesta no estaba vacío. No se publicó nada.",
      submitDisabled: "X no habilitó el botón Responder.",
      submitNotConfirmed: "X no confirmó que la respuesta se haya enviado.",
      manualReview: "La publicación automática se detuvo. Revisá la respuesta abierta en X.",
      uncertain: "X no confirmó una respuesta nueva. Revisá la conversación antes de permitir otra propina.",
      allowRetry: "Ya revisé — permitir reintento",
      checking: "Verificando la conversación…",
      genericError: "No se pudo publicar la propina."
    }
  };

  let settings = Core.withDefaults();
  let activeModal = null;
  let activeModalContext = null;
  let activeToast = null;
  let busy = false;

  const storageGet = (keys) => new Promise((resolve) => chrome.storage.sync.get(keys, resolve));
  const storageSet = (items) => new Promise((resolve) => chrome.storage.sync.set(items, resolve));

  function strings(language = settings.language) {
    return COPY[Core.normalizeLanguage(language)];
  }

  async function loadSettings() {
    settings = Core.withDefaults(await storageGet(Object.keys(Core.DEFAULTS)));
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    const languageChanged = Boolean(changes.language);
    const next = { ...settings };
    for (const [key, change] of Object.entries(changes)) next[key] = change.newValue;
    settings = Core.withDefaults(next);
    updateInjectedButtons();

    if (languageChanged && activeModal && activeModalContext && !busy) {
      const context = activeModalContext;
      const currentAmount = activeModal.shadowRoot?.querySelector(".amount")?.value || null;
      openTipModal({ ...context, initialAmount: currentAmount });
    }
  });

  function visible(element) {
    if (!(element instanceof HTMLElement)) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitFor(getter, { timeout = 6000, interval = 100 } = {}) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const result = getter();
      if (result) return result;
      await sleep(interval);
    }
    return null;
  }

  function findTweetIdentity(article) {
    const links = [...article.querySelectorAll('a[href*="/status/"]')];
    for (const link of links) {
      const parsed = Core.parseStatusPath(link.getAttribute("href") || link.href);
      if (parsed) return parsed;
    }
    return null;
  }

  function findArticleByStatusId(statusId) {
    return [...document.querySelectorAll(SELECTORS.tweet)].find((article) =>
      findTweetIdentity(article)?.statusId === statusId
    ) || null;
  }

  function findActionGroup(article) {
    const reply = article.querySelector(SELECTORS.reply);
    if (reply) {
      const group = reply.closest(SELECTORS.actionGroup);
      if (group) return group;
    }

    return [...article.querySelectorAll(SELECTORS.actionGroup)].find((group) =>
      group.querySelector('[data-testid="retweet"], [data-testid="unretweet"], [data-testid="like"], [data-testid="unlike"]')
    ) || null;
  }

  function normalizeText(value) {
    return String(value || "")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function visibleComposers() {
    return [...document.querySelectorAll(SELECTORS.composer)].filter(visible);
  }

  function findTargetComposer(previouslyVisible, username, sourceArticle, previouslyActive) {
    const targetHandle = `@${String(username).replace(/^@+/, "")}`.toLowerCase();
    const candidates = visibleComposers();
    const associated = (composer) => {
      const dialog = composer.closest('[role="dialog"]');
      if (dialog && (dialog.textContent || "").toLowerCase().includes(targetHandle)) return true;
      return Boolean(sourceArticle && composer.closest(SELECTORS.tweet) === sourceArticle);
    };
    const focused = document.activeElement;
    if (candidates.includes(focused) && focused !== previouslyActive) {
      return focused;
    }
    return candidates.find((composer) => !previouslyVisible.has(composer) && associated(composer)) || null;
  }

  function composerText(composer) {
    const draftText = [...composer.querySelectorAll('[data-text="true"]')]
      .map((node) => node.textContent || "")
      .join("");
    return draftText || composer.textContent || "";
  }

  function findSubmitForComposer(composer) {
    let container = composer?.parentElement || null;
    while (container && container !== document.body && container !== document.documentElement) {
      const buttons = [...container.querySelectorAll(SELECTORS.submit)].filter(visible);
      if (buttons.length === 1) return buttons[0];
      if (buttons.length > 1) return null;
      container = container.parentElement;
    }
    return null;
  }

  function currentUsername() {
    const profileLink = document.querySelector('a[data-testid="AppTabBar_Profile_Link"]');
    const path = profileLink?.getAttribute("href") || "";
    return path.match(/^\/([A-Za-z0-9_]{1,15})\/?$/)?.[1] || "";
  }

  function matchingReplyIds(command, author = "") {
    const expected = normalizeText(command);
    const expectedAuthor = author.toLowerCase();
    const ids = new Set();
    document.querySelectorAll(SELECTORS.tweet).forEach((article) => {
      const body = article.querySelector('[data-testid="tweetText"]');
      const identity = findTweetIdentity(article);
      if (!body || !identity || normalizeText(body.textContent) !== expected) return;
      if (expectedAuthor && identity.username.toLowerCase() !== expectedAuthor) return;
      ids.add(identity.statusId);
    });
    return ids;
  }

  function statusTimestampMs(statusId) {
    try {
      return Number((BigInt(statusId) >> 22n) + 1288834974657n);
    } catch {
      return 0;
    }
  }

  function findNewPublishedReply(command, previousIds, author = "", startedAt = 0) {
    const matches = matchingReplyIds(command, author);
    const earliest = Number(startedAt || 0) - 5000;
    const newId = [...matches].find((statusId) =>
      !previousIds.has(statusId) && (!earliest || statusTimestampMs(statusId) >= earliest)
    );
    return newId ? findArticleByStatusId(newId) : null;
  }

  function createTargetToken() {
    return globalThis.crypto?.randomUUID?.() || `bch-tip-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function closeTargetComposer(composer) {
    composer?.removeAttribute("data-bch-tip-target");
    const dialog = composer?.closest('[role="dialog"]');
    if (!dialog) return;
    const closeButton = dialog.querySelector('[data-testid="app-bar-close"]') || [...dialog.querySelectorAll("button")].find((candidate) => {
      const label = (candidate.getAttribute("aria-label") || candidate.title || candidate.textContent || "").trim().toLowerCase();
      return label === "close" || label === "cerrar";
    });
    closeButton?.click();
  }

  function insertReplyInMainWorld(text, targetToken, timeout = 6000) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error("MAIN world insertion timed out"));
      }, timeout);

      chrome.runtime.sendMessage({ type: "bch-tip-insert-reply", text, targetToken }, (response) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response || { ok: false, reason: "empty-response", actual: "" });
      });
    });
  }

  function bchIcon() {
    return `
      <svg class="bch-tip-action__icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="currentColor"></circle>
        <path fill="white" d="M15.9 8.75c-.25-1.67-1.7-2.1-3.53-2.26l.45-1.8-1.1-.27-.44 1.75-.88-.21.44-1.77-1.1-.27-.45 1.8-.7-.17v-.01l-1.52-.38-.3 1.18s.81.19.8.2c.45.11.53.4.51.63l-.51 2.05.11.03-.12-.03-.72 2.87c-.05.14-.19.34-.5.26.01.02-.8-.2-.8-.2l-.56 1.27 1.44.36.79.2-.46 1.82 1.1.28.45-1.8.88.23-.45 1.78 1.1.27.46-1.82c2.36.45 4.14.27 4.89-1.87.6-1.72-.03-2.71-1.27-3.35.9-.21 1.58-.8 1.76-2.02Zm-3.15 4.41c-.43 1.72-3.32.79-4.26.56l.6-2.42c.94.23 4.1.67 3.66 1.86Zm.43-4.44c-.39 1.56-2.8.77-3.58.58l.55-2.2c.78.2 3.44.5 3.03 1.62Z"></path>
      </svg>`;
  }

  function updateInjectedButtons() {
    const text = strings();
    document.querySelectorAll(".bch-tip-action").forEach((button) => {
      const username = button.dataset.username;
      if (!username) return;
      button.title = text.buttonTitle(username);
      button.setAttribute("aria-label", text.buttonAria(username));
      const label = button.querySelector(".bch-tip-action__label");
      if (label) label.textContent = text.buttonLabel;
      button.disabled = busy;
    });
  }

  function injectButton(article) {
    if (article.querySelector(":scope .bch-tip-action-slot")) return;

    const identity = findTweetIdentity(article);
    const actionGroup = findActionGroup(article);
    if (!identity || !actionGroup) return;

    const text = strings();
    const slot = document.createElement("div");
    slot.className = "bch-tip-action-slot";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "bch-tip-action";
    button.dataset.username = identity.username;
    button.disabled = busy;
    button.title = text.buttonTitle(identity.username);
    button.setAttribute("aria-label", text.buttonAria(identity.username));
    button.innerHTML = `${bchIcon()}<span class="bch-tip-action__label">${text.buttonLabel}</span>`;

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (busy) return;
      openTipModal({ article, identity, button });
    });

    slot.append(button);
    actionGroup.append(slot);
  }

  function scan(root = document) {
    if (root instanceof Element) {
      if (root.matches(SELECTORS.tweet)) injectButton(root);
      const parentTweet = root.closest(SELECTORS.tweet);
      if (parentTweet) injectButton(parentTweet);
    }
    root.querySelectorAll?.(SELECTORS.tweet).forEach(injectButton);
  }

  function closeModal(target = activeModal) {
    target?.remove();
    if (activeModal === target) {
      activeModal = null;
      activeModalContext = null;
    }
  }

  function clearToast() {
    activeToast?.remove();
    activeToast = null;
  }

  function showToast(message, kind = "success", duration = 3500, action = null) {
    clearToast();
    const host = document.createElement("div");
    host.style.position = "fixed";
    host.style.left = "50%";
    host.style.bottom = "28px";
    host.style.transform = "translateX(-50%)";
    host.style.zIndex = "2147483647";
    host.setAttribute("data-bch-tip-toast", kind);
    document.documentElement.append(host);
    activeToast = host;

    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .toast { min-width:220px; max-width:min(520px,calc(100vw - 32px)); padding:12px 18px; border-radius:${action ? "18px" : "999px"};
          color:#fff; background:${kind === "error" ? "#8b1e2d" : kind === "pending" ? "#202327" : "#0b7a53"};
          border:1px solid ${kind === "error" ? "#d94b61" : "#2f3336"}; text-align:center; font:700 14px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
          box-shadow:0 8px 28px rgba(0,0,0,.45); }
        button { margin-top:10px; border:1px solid rgba(255,255,255,.45); border-radius:999px; padding:7px 12px; color:#fff;
          background:rgba(0,0,0,.22); cursor:pointer; font:700 12px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
        button:hover { background:rgba(0,0,0,.38); }
      </style><div class="toast" role="status"><span class="message"></span>${action ? '<br><button type="button"></button>' : ""}</div>`;
    shadow.querySelector(".message").textContent = message;
    if (action) {
      const actionButton = shadow.querySelector("button");
      actionButton.textContent = action.label;
      actionButton.addEventListener("click", action.onClick);
    }

    if (duration > 0) {
      setTimeout(() => {
        if (activeToast === host) clearToast();
      }, duration);
    }
  }

  function savePendingVerification(payload) {
    try {
      sessionStorage.setItem(VERIFY_KEY, JSON.stringify(payload));
    } catch {
      // Verification can still complete without the reload fallback.
    }
  }

  function clearPendingVerification() {
    try {
      sessionStorage.removeItem(VERIFY_KEY);
    } catch {
      // Ignore unavailable session storage.
    }
  }

  function lockForManualReview(pending) {
    busy = true;
    updateInjectedButtons();
    const text = strings(pending?.language);
    showToast(text.uncertain, "error", 0, {
      label: text.allowRetry,
      onClick: () => {
        clearPendingVerification();
        busy = false;
        updateInjectedButtons();
        clearToast();
      }
    });
  }

  async function resumePendingVerification() {
    let pending = null;
    try {
      pending = JSON.parse(sessionStorage.getItem(VERIFY_KEY) || "null");
    } catch {
      clearPendingVerification();
      busy = false;
      updateInjectedButtons();
      return;
    }

    if (!pending) {
      busy = false;
      updateInjectedButtons();
      return;
    }
    busy = true;
    updateInjectedButtons();
    if (Date.now() - Number(pending.createdAt || 0) > 300000) {
      lockForManualReview(pending);
      return;
    }
    if (!location.pathname.includes(`/status/${pending.sourceStatusId}`)) {
      const sourceUrl = `https://x.com/${pending.sourceUsername}/status/${pending.sourceStatusId}`;
      window.location.assign(sourceUrl);
      return;
    }

    const text = strings(pending.language);
    showToast(text.checking, "pending", 15000);
    const previousIds = new Set(Array.isArray(pending.previousIds) ? pending.previousIds : []);
    const publishedReply = await waitFor(
      () => findNewPublishedReply(pending.command, previousIds, pending.author || "", pending.createdAt),
      { timeout: 12000, interval: 250 }
    );
    clearToast();
    if (publishedReply) {
      clearPendingVerification();
      busy = false;
      updateInjectedButtons();
      showToast(text.posted, "success", 4000);
      scan(publishedReply);
    } else {
      lockForManualReview(pending);
    }
  }

  function openTipModal({ article, identity, button, initialAmount = null }) {
    if (busy) return;
    closeModal();

    const language = Core.normalizeLanguage(settings.language);
    const text = strings(language);
    const host = document.createElement("div");
    host.style.position = "fixed";
    host.style.inset = "0";
    host.style.zIndex = "2147483647";
    host.setAttribute("data-bch-tip-modal", "true");
    document.documentElement.append(host);
    activeModal = host;
    activeModalContext = { article, identity, button };

    const shadow = host.attachShadow({ mode: "open" });
    const selectedDefault = Core.normalizeAmount(initialAmount) || Core.normalizeAmount(settings.lastAmount) || settings.presets[0];

    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        * { box-sizing: border-box; }
        .backdrop { position:fixed; inset:0; display:grid; place-items:center; padding:20px; background:rgba(0,0,0,.62);
          font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
        .card { width:min(430px,100%); color:#e7e9ea; background:#000; border:1px solid #2f3336; border-radius:18px;
          box-shadow:0 18px 60px rgba(0,0,0,.5); overflow:hidden; }
        .header { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:18px 20px 10px; }
        .header-actions { display:flex; align-items:center; gap:8px; }
        h2 { margin:0; font-size:21px; line-height:1.25; }
        .language { display:flex; padding:2px; border:1px solid #2f3336; border-radius:999px; background:#111; }
        .lang { border:0; border-radius:999px; padding:5px 8px; color:#71767b; background:transparent; cursor:pointer; font:700 11px/1 sans-serif; }
        .lang.active { color:#fff; background:#0b7a53; }
        .close { border:0; border-radius:999px; background:transparent; color:#e7e9ea; font-size:25px; cursor:pointer; width:36px; height:36px; }
        .close:hover { background:#181818; }
        .body { padding:8px 20px 20px; }
        .recipient { color:#a7f3d0; font-weight:700; margin-bottom:16px; }
        .label { display:block; margin:0 0 8px; color:#71767b; font-size:13px; font-weight:700; }
        .presets { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:12px; }
        .preset { border:1px solid #2f3336; background:#0f0f0f; color:#e7e9ea; border-radius:999px; padding:9px 6px; cursor:pointer; font-weight:700; }
        .preset:hover,.preset.active { color:white; border-color:#0fad73; background:rgba(15,173,115,.16); }
        .amount-wrap { display:flex; align-items:center; border:1px solid #2f3336; border-radius:12px; padding:0 12px; }
        .amount-wrap:focus-within { border-color:#0fad73; box-shadow:0 0 0 1px #0fad73; }
        .amount { width:100%; border:0; outline:0; background:transparent; color:#e7e9ea; font-size:20px; padding:12px 4px; }
        .currency { color:#71767b; font-weight:700; }
        .warning { min-height:20px; margin:7px 2px 3px; color:#f4a261; font-size:12px; }
        .preview { margin:12px 0; padding:11px 12px; border-radius:12px; background:#111; border:1px solid #222;
          font:13px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace; overflow-wrap:anywhere; }
        .notice { color:#cfd2d4; font-size:13px; line-height:1.45; margin:12px 0 17px; }
        .actions { display:flex; gap:10px; }
        .button { flex:1; border:0; border-radius:999px; padding:12px 14px; cursor:pointer; font-weight:800; font-size:15px; }
        .cancel { color:#e7e9ea; background:#202327; }
        .confirm { color:white; background:#0fad73; }
        .button:disabled { opacity:.5; cursor:not-allowed; }
        .status { min-height:20px; margin-top:10px; text-align:center; color:#a7f3d0; font-size:13px; }
        @media (max-width:420px) { .presets { grid-template-columns:repeat(2,1fr); } }
      </style>
      <div class="backdrop" role="presentation">
        <section class="card" lang="${language}" role="dialog" aria-modal="true" aria-labelledby="bch-tip-title">
          <div class="header">
            <h2 id="bch-tip-title">${text.modalTitle}</h2>
            <div class="header-actions">
              <div class="language" aria-label="${text.language}">
                <button class="lang ${language === "en" ? "active" : ""}" type="button" data-language="en" aria-pressed="${language === "en"}">EN</button>
                <button class="lang ${language === "es" ? "active" : ""}" type="button" data-language="es" aria-pressed="${language === "es"}">ES</button>
              </div>
              <button class="close" type="button" aria-label="${text.close}">×</button>
            </div>
          </div>
          <div class="body">
            <div class="recipient">${text.recipient(identity.username)}</div>
            <span class="label">${text.amount}</span>
            <div class="presets">
              ${settings.presets.map((amount) => `<button class="preset" type="button" data-amount="${amount}">${amount}</button>`).join("")}
            </div>
            <div class="amount-wrap">
              <input class="amount" inputmode="decimal" autocomplete="off" spellcheck="false" value="${selectedDefault}" aria-label="${text.amountAria}">
              <span class="currency">BCH</span>
            </div>
            <div class="warning"></div>
            <span class="label">${text.preview}</span>
            <div class="preview"></div>
            <div class="notice">${text.notice}</div>
            <div class="actions">
              <button class="button cancel" type="button">${text.cancel}</button>
              <button class="button confirm" type="button">${text.confirm}</button>
            </div>
            <div class="status" aria-live="polite"></div>
          </div>
        </section>
      </div>`;

    const backdrop = shadow.querySelector(".backdrop");
    const amountInput = shadow.querySelector(".amount");
    const warning = shadow.querySelector(".warning");
    const preview = shadow.querySelector(".preview");
    const confirm = shadow.querySelector(".confirm");
    const status = shadow.querySelector(".status");
    const presetButtons = [...shadow.querySelectorAll(".preset")];

    function refresh() {
      const amount = Core.normalizeAmount(amountInput.value);
      const command = Core.buildCommand(settings, identity.username, amountInput.value);
      preview.textContent = command || text.invalidAmount;
      confirm.disabled = !command || busy;
      warning.textContent = amount && Number(amount) < 0.0001 ? text.lowAmount : "";
      presetButtons.forEach((item) => item.classList.toggle("active", item.dataset.amount === amount));
    }

    shadow.querySelector(".close").addEventListener("click", () => closeModal());
    shadow.querySelector(".cancel").addEventListener("click", () => closeModal());
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop && !busy) closeModal();
    });
    host.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !busy) closeModal();
    });

    shadow.querySelectorAll(".lang").forEach((languageButton) => {
      languageButton.addEventListener("click", () => {
        if (busy) return;
        const nextLanguage = Core.normalizeLanguage(languageButton.dataset.language);
        if (nextLanguage === language) return;
        storageSet({ language: nextLanguage });
      });
    });

    presetButtons.forEach((preset) => {
      preset.addEventListener("click", () => {
        amountInput.value = preset.dataset.amount;
        refresh();
      });
    });

    amountInput.addEventListener("input", refresh);

    confirm.addEventListener("click", async () => {
      const amount = Core.normalizeAmount(amountInput.value);
      const command = Core.buildCommand(settings, identity.username, amountInput.value);
      if (!amount || !command || busy) return;

      busy = true;
      updateInjectedButtons();
      confirm.disabled = true;
      amountInput.disabled = true;
      status.textContent = text.opening;
      await storageSet({ lastAmount: amount });

      let targetComposer = null;
      let submitClicked = false;
      let keepLocked = false;
      try {
        const sourceArticle = document.contains(article) ? article : findArticleByStatusId(identity.statusId);
        const replyButton = sourceArticle?.querySelector(SELECTORS.reply);
        if (!replyButton) throw new Error(text.missingReply);

        const previouslyVisible = new Set(visibleComposers());
        const previouslyActive = document.activeElement;
        host.style.display = "none";
        showToast(text.posting, "pending", 0);
        replyButton.click();
        targetComposer = await waitFor(
          () => findTargetComposer(previouslyVisible, identity.username, sourceArticle, previouslyActive),
          { timeout: 7000 }
        );
        if (!targetComposer) throw new Error(text.missingComposer);

        const targetToken = createTargetToken();
        targetComposer.setAttribute("data-bch-tip-target", targetToken);
        if (normalizeText(composerText(targetComposer))) throw new Error(text.composerNotEmpty);

        status.textContent = text.writing;
        const insertion = await insertReplyInMainWorld(command, targetToken);
        if (!insertion?.ok) {
          throw new Error(insertion?.reason === "editor-not-empty" ? text.composerNotEmpty : text.writeRejected);
        }

        const textReady = await waitFor(
          () => normalizeText(composerText(targetComposer)) === normalizeText(command),
          { timeout: 2500 }
        );
        if (!textReady) throw new Error(text.textNotReady);

        const submit = await waitFor(() => {
          const candidate = findSubmitForComposer(targetComposer);
          return candidate?.getAttribute("aria-disabled") !== "true" && !candidate?.disabled ? candidate : null;
        }, { timeout: 5000 });
        if (!submit) throw new Error(text.submitDisabled);

        const author = currentUsername();
        const previousIds = matchingReplyIds(command, author);
        const attemptStartedAt = Date.now();
        savePendingVerification({
          command,
          author,
          previousIds: [...previousIds],
          sourceStatusId: identity.statusId,
          sourceUsername: identity.username,
          language,
          createdAt: attemptStartedAt
        });

        status.textContent = text.posting;
        submit.click();
        submitClicked = true;

        const publishedReply = await waitFor(
          () => findNewPublishedReply(command, previousIds, author, attemptStartedAt),
          { timeout: 15000, interval: 250 }
        );
        targetComposer.removeAttribute("data-bch-tip-target");
        closeModal(host);
        clearToast();

        if (publishedReply) {
          clearPendingVerification();
          showToast(text.posted, "success", 4000);
          scan(publishedReply);
        } else {
          keepLocked = true;
          showToast(text.checking, "pending", 1600);
          const sourceUrl = `https://x.com/${identity.username}/status/${identity.statusId}`;
          window.location.assign(sourceUrl);
        }
      } catch (error) {
        console.error("BCH Tip Button:", error);
        if (submitClicked) {
          keepLocked = true;
          targetComposer?.removeAttribute("data-bch-tip-target");
          closeModal(host);
          clearToast();
          showToast(text.checking, "pending", 0);
          const sourceUrl = `https://x.com/${identity.username}/status/${identity.statusId}`;
          window.location.assign(sourceUrl);
          return;
        }

        clearPendingVerification();
        const targetHasText = Boolean(targetComposer && normalizeText(composerText(targetComposer)));
        if (targetHasText) {
          targetComposer.removeAttribute("data-bch-tip-target");
          closeModal(host);
          clearToast();
          showToast(`${error instanceof Error ? error.message : text.genericError} ${text.manualReview}`, "error", 7000);
          return;
        }
        closeTargetComposer(targetComposer);
        clearToast();
        host.style.display = "";
        status.textContent = error instanceof Error ? error.message : text.genericError;
        confirm.disabled = false;
        amountInput.disabled = false;
        button.disabled = false;
      } finally {
        if (!keepLocked) {
          busy = false;
          updateInjectedButtons();
        }
      }
    });

    refresh();
    setTimeout(() => {
      amountInput.focus();
      amountInput.select();
    }, 0);
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node instanceof Element) scan(node);
      }
    }
  });

  loadSettings().finally(() => {
    try {
      if (sessionStorage.getItem(VERIFY_KEY)) busy = true;
    } catch {
      // Ignore unavailable session storage.
    }
    scan();
    observer.observe(document.documentElement, { childList: true, subtree: true });
    resumePendingVerification();
  });
})();
