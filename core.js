(function attachBchTipCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.BCHTipCore = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createBchTipCore() {
  "use strict";

  const DEFAULTS = Object.freeze({
    language: "en",
    botHandle: "bchtip",
    commandTemplate: "@{bot} tip @{user} {amount} BCH",
    presets: ["0.0001", "0.0005", "0.001", "0.005"],
    lastAmount: "0.0001"
  });

  function normalizeHandle(value) {
    return String(value || "")
      .trim()
      .replace(/^@+/, "")
      .replace(/[^A-Za-z0-9_]/g, "")
      .slice(0, 15);
  }

  function normalizeLanguage(value) {
    return String(value || "").toLowerCase() === "es" ? "es" : "en";
  }

  function parseStatusPath(pathOrUrl) {
    try {
      const url = new URL(pathOrUrl, "https://x.com");
      const match = url.pathname.match(/^\/([A-Za-z0-9_]{1,15})\/status\/(\d+)/);
      if (!match) return null;
      return { username: match[1], statusId: match[2] };
    } catch {
      return null;
    }
  }

  function normalizeAmount(value) {
    const raw = String(value ?? "").trim().replace(",", ".");
    if (!/^\d+(?:\.\d{1,8})?$/.test(raw)) return null;
    const numeric = Number(raw);
    if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 21000000) return null;

    const [whole, fraction = ""] = raw.split(".");
    const cleanWhole = whole.replace(/^0+(?=\d)/, "") || "0";
    const cleanFraction = fraction.replace(/0+$/, "");
    return cleanFraction ? `${cleanWhole}.${cleanFraction}` : cleanWhole;
  }

  function buildCommand(settings, username, amount) {
    const bot = normalizeHandle(settings?.botHandle || DEFAULTS.botHandle);
    const user = normalizeHandle(username);
    const normalizedAmount = normalizeAmount(amount);
    const template = String(settings?.commandTemplate || DEFAULTS.commandTemplate);

    if (!bot || !user || !normalizedAmount) return null;

    return template
      .replaceAll("{bot}", bot)
      .replaceAll("{user}", user)
      .replaceAll("{amount}", normalizedAmount)
      .trim();
  }

  function parsePresets(value) {
    const entries = Array.isArray(value) ? value : String(value || "").split(/[;,\s]+/);
    const unique = [];
    for (const entry of entries) {
      const amount = normalizeAmount(entry);
      if (amount && !unique.includes(amount)) unique.push(amount);
      if (unique.length === 8) break;
    }
    return unique.length ? unique : [...DEFAULTS.presets];
  }

  function withDefaults(settings) {
    return {
      ...DEFAULTS,
      ...(settings || {}),
      language: normalizeLanguage(settings?.language || DEFAULTS.language),
      botHandle: normalizeHandle(settings?.botHandle || DEFAULTS.botHandle) || DEFAULTS.botHandle,
      presets: parsePresets(settings?.presets || DEFAULTS.presets)
    };
  }

  return {
    DEFAULTS,
    normalizeLanguage,
    normalizeHandle,
    parseStatusPath,
    normalizeAmount,
    buildCommand,
    parsePresets,
    withDefaults
  };
});
