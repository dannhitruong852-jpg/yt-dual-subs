// vocab-popup.js — popup-only switch for Level-5+ vocabulary emphasis.
(() => {
  "use strict";

  const KEY = "vocabBoldEnabled";

  function fallbackLabel() {
    let lang = "";
    try { lang = (chrome.i18n && chrome.i18n.getUILanguage && chrome.i18n.getUILanguage()) || ""; }
    catch (_e) { /* English fallback below */ }
    lang = lang.toLowerCase();
    if (/^zh-(tw|hk|mo)/.test(lang)) return "高階詞彙加粗";
    if (/^zh/.test(lang)) return "高阶词汇加粗";
    return "Bold advanced vocabulary";
  }

  function uiText(key, fallback) {
    try {
      const runtime = self.YTDS_I18N;
      const msg = runtime && runtime.get && runtime.get(key);
      if (msg) return msg;
      const chromeMsg = chrome.i18n && chrome.i18n.getMessage && chrome.i18n.getMessage(key);
      if (chromeMsg) return chromeMsg;
    } catch (_e) { /* fallback */ }
    return fallback;
  }

  function mount() {
    if (document.getElementById(KEY)) return;
    const target = document.getElementById("targetLang");
    const card = target && target.closest(".card");
    const targetRow = target && target.closest(".row");
    if (!card || !targetRow) return;

    const labelText = uiText("vocabBoldLabel", fallbackLabel());
    const ariaText = uiText("vocabBoldAria", labelText);

    const row = document.createElement("div");
    row.className = "row row-split vocab-bold-row";

    const text = document.createElement("span");
    text.className = "tts-off";
    text.textContent = labelText;

    const label = document.createElement("label");
    label.className = "switch";
    label.title = labelText;

    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = KEY;
    input.setAttribute("aria-label", ariaText);

    const track = document.createElement("span");
    track.className = "switch-track";
    const thumb = document.createElement("span");
    thumb.className = "switch-thumb";
    track.appendChild(thumb);
    label.append(input, track);
    row.append(text, label);
    targetRow.insertAdjacentElement("afterend", row);

    input.checked = true;
    try {
      chrome.storage.sync.get({ [KEY]: true }, got => {
        input.checked = !got || got[KEY] !== false;
      });
    } catch (_e) { /* default-on */ }

    input.addEventListener("change", () => {
      try { chrome.storage.sync.set({ [KEY]: input.checked }); }
      catch (_e) { /* popup closing */ }
    });

    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "sync" && changes[KEY]) input.checked = changes[KEY].newValue !== false;
      });
    } catch (_e) { /* no extension APIs in mock pages */ }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
})();
