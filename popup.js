(() => {
  "use strict";

  const Core = globalThis.BCHTipCore;
  const COPY = {
    en: {
      settings: "Settings",
      language: "Language",
      botHandle: "Bot account",
      presets: "Quick amounts, separated by commas",
      template: "Command template",
      variables: "Variables: {bot}, {user}, {amount}",
      save: "Save",
      note: "The extension never accesses keys or funds. It posts the tip command from your current X tab.",
      invalidHandle: "The bot account is not valid.",
      invalidTemplate: "The template must include {bot}, {user}, and {amount}.",
      saved: "Settings saved."
    },
    es: {
      settings: "Configuración",
      language: "Idioma",
      botHandle: "Usuario del bot",
      presets: "Montos rápidos, separados por coma",
      template: "Plantilla del comando",
      variables: "Variables: {bot}, {user}, {amount}",
      save: "Guardar",
      note: "La extensión no accede a claves ni fondos. Publica el comando de propina desde tu pestaña actual de X.",
      invalidHandle: "El usuario del bot no es válido.",
      invalidTemplate: "La plantilla debe incluir {bot}, {user} y {amount}.",
      saved: "Configuración guardada."
    }
  };

  const fields = {
    language: document.querySelector("#language"),
    botHandle: document.querySelector("#botHandle"),
    presets: document.querySelector("#presets"),
    commandTemplate: document.querySelector("#commandTemplate")
  };
  const status = document.querySelector("#status");

  function applyLanguage(value) {
    const language = Core.normalizeLanguage(value);
    const text = COPY[language];
    document.documentElement.lang = language;
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const translated = text[element.dataset.i18n];
      if (translated) element.textContent = translated;
    });
    fields.language.value = language;
    return text;
  }

  chrome.storage.sync.get(Object.keys(Core.DEFAULTS), (stored) => {
    const settings = Core.withDefaults(stored);
    applyLanguage(settings.language);
    fields.botHandle.value = settings.botHandle;
    fields.presets.value = settings.presets.join(", ");
    fields.commandTemplate.value = settings.commandTemplate;
  });

  fields.language.addEventListener("change", () => {
    status.textContent = "";
    const language = Core.normalizeLanguage(fields.language.value);
    applyLanguage(language);
    chrome.storage.sync.set({ language });
  });

  document.querySelector("#save").addEventListener("click", () => {
    const language = Core.normalizeLanguage(fields.language.value);
    const text = applyLanguage(language);
    const botHandle = Core.normalizeHandle(fields.botHandle.value);
    const presets = Core.parsePresets(fields.presets.value);
    const commandTemplate = fields.commandTemplate.value.trim();

    if (!botHandle) {
      status.textContent = text.invalidHandle;
      return;
    }
    if (!["{bot}", "{user}", "{amount}"].every((token) => commandTemplate.includes(token))) {
      status.textContent = text.invalidTemplate;
      return;
    }

    chrome.storage.sync.set({
      language,
      botHandle,
      presets,
      commandTemplate
    }, () => {
      status.textContent = text.saved;
      setTimeout(() => { status.textContent = ""; }, 1800);
    });
  });
})();
