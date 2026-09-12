// skins.js — extension-page skin bootstrap + user-fork popup controls.
(function (root) {
  "use strict";
  const KEY = "uiSkin", CACHE = "ytdsSkin", DEFAULT = "default";
  const SKINS = [
    { id: "default", nameKey: "skinDefault", name: "Default", swatch: ["#0e0f11", "#3ea6ff", "#f1f1f1"] },
    { id: "neon", nameKey: "skinNeon", name: "Neon Terminal", swatch: ["#07080c", "#38e8ff", "#ff4d8d"] },
    { id: "ember", nameKey: "skinEmber", name: "Ember", swatch: ["#140e0a", "#ec9e5d", "#e06b4f"] },
    { id: "mocha", nameKey: "skinMocha", name: "Mocha", swatch: ["#1a1815", "#8ba876", "#eaddcf"] },
    { id: "ink", nameKey: "skinInk", name: "Ink", swatch: ["#000000", "#8ba3c7", "#ececf1"] },
    { id: "dusk", nameKey: "skinDusk", name: "Dusk", swatch: ["#121018", "#b794f6", "#e089c0"] }
  ];
  const BY_ID = Object.fromEntries(SKINS.map(s => [s.id, s]));
  const known = id => (typeof id === "string" && BY_ID[id]) ? id : DEFAULT;
  function apply(id) {
    const el = document.documentElement;
    if (!el) return;
    const use = known(id);
    if (use === DEFAULT) el.removeAttribute("data-skin"); else el.setAttribute("data-skin", use);
  }
  function cacheWrite(id) { try { localStorage.setItem(CACHE, known(id)); } catch (_e) {} }
  function cacheRead() { try { return known(localStorage.getItem(CACHE)); } catch (_e) { return DEFAULT; } }
  apply(cacheRead());
  try { chrome.storage.sync.get({ [KEY]: DEFAULT }, got => { const id = known(got && got[KEY]); cacheWrite(id); apply(id); }); } catch (_e) {}
  try { chrome.storage.onChanged.addListener((ch, area) => { if (area !== "sync" || !ch[KEY]) return; const id = known(ch[KEY].newValue); cacheWrite(id); apply(id); }); } catch (_e) {}
  function set(id) {
    const use = known(id); cacheWrite(use); apply(use);
    return new Promise(resolve => { try { chrome.storage.sync.set({ [KEY]: use }, resolve); } catch (_e) { resolve(); } });
  }
  root.YTDS_SKINS = { list: SKINS, get: id => BY_ID[known(id)], DEFAULT, KEY, current: () => known(document.documentElement.getAttribute("data-skin")), apply, set };
})(typeof self !== "undefined" ? self : this);

// User fork: independent vertical positions. Chinese must stay above English.
(function () {
  "use strict";
  const ORIG_KEY = "origYpct", TRANS_KEY = "transYpct", DEFAULT_ORIG_Y = 88, DEFAULT_TRANS_Y = 12;
  function clamp(value, fallback) { let n = Number(value); if (!Number.isFinite(n)) n = fallback; return Math.max(0, Math.min(100, n)); }
  function normalizePair(origValue, transValue) {
    let orig = clamp(origValue, DEFAULT_ORIG_Y), trans = clamp(transValue, DEFAULT_TRANS_Y);
    if (trans > orig) [trans, orig] = [orig, trans];
    if (trans === orig) { if (orig < 100) orig += 1; else trans -= 1; }
    return { orig, trans };
  }
  function makeRow(id, labelText, initial) {
    const row = document.createElement("div"); row.className = "row ytds-independent-position-row";
    const label = document.createElement("label"); label.setAttribute("for", id);
    const text = document.createElement("span"); text.textContent = labelText;
    const value = document.createElement("b"); value.id = id + "V"; value.textContent = initial + "%";
    label.append(text, document.createTextNode(" "), value);
    const range = document.createElement("input"); range.type = "range"; range.id = id; range.min = "0"; range.max = "100"; range.step = "1"; range.value = String(initial); range.setAttribute("aria-label", labelText);
    row.append(label, range); return { row, range, value };
  }
  function mountIndependentPositionControls() {
    const position = document.getElementById("position");
    if (!position || document.getElementById(ORIG_KEY)) return;
    const card = position.closest(".card"); if (!card) return;
    for (const id of ["order", "position", "rowGap"]) { const el = document.getElementById(id); const row = el && el.closest(".row"); if (row) row.hidden = true; }
    const trans = makeRow(TRANS_KEY, "中文位置", DEFAULT_TRANS_Y), orig = makeRow(ORIG_KEY, "英文位置", DEFAULT_ORIG_Y);
    const selectText = document.getElementById("selectText"); const before = selectText ? selectText.closest("label") : null;
    card.insertBefore(trans.row, before); card.insertBefore(orig.row, before);
    const hint = document.createElement("p"); hint.className = "tip ytds-position-hint"; hint.textContent = "0% = 视频顶部 · 100% = 视频底部 · 中文始终在英文上方"; card.insertBefore(hint, before);
    const style = document.createElement("style"); style.textContent = `#prevOverlay{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;transform:none!important;display:block!important}#prevOrig,#prevTrans{position:absolute!important;left:50%!important;width:max-content;max-width:92%!important;transform:translate(-50%,-50%)!important}#prevOrig{top:var(--ytds-popup-orig-y,88%)!important}#prevTrans{top:var(--ytds-popup-trans-y,12%)!important}`; document.head.appendChild(style);
    let pendingTimer = null;
    function paint(key, val) { const pct = clamp(val, key === ORIG_KEY ? DEFAULT_ORIG_Y : DEFAULT_TRANS_Y); document.documentElement.style.setProperty(key === ORIG_KEY ? "--ytds-popup-orig-y" : "--ytds-popup-trans-y", pct + "%"); return pct; }
    function savePair() { try { chrome.storage.sync.set({ [ORIG_KEY]: Number(orig.range.value), [TRANS_KEY]: Number(trans.range.value) }); } catch (_e) {} }
    function syncBounds() { const o = Number(orig.range.value), t = Number(trans.range.value); trans.range.max = String(Math.max(0, o - 1)); orig.range.min = String(Math.min(100, t + 1)); }
    function setPair(pair) { trans.range.value = String(pair.trans); trans.value.textContent = pair.trans + "%"; paint(TRANS_KEY, pair.trans); orig.range.value = String(pair.orig); orig.value.textContent = pair.orig + "%"; paint(ORIG_KEY, pair.orig); syncBounds(); }
    function handleInput(key, requested) { let o = Number(orig.range.value), t = Number(trans.range.value); if (key === TRANS_KEY) t = Math.min(clamp(requested, DEFAULT_TRANS_Y), o - 1); else o = Math.max(clamp(requested, DEFAULT_ORIG_Y), t + 1); setPair(normalizePair(o, t)); if (pendingTimer) clearTimeout(pendingTimer); pendingTimer = setTimeout(savePair, 140); }
    trans.range.addEventListener("input", () => handleInput(TRANS_KEY, trans.range.value)); orig.range.addEventListener("input", () => handleInput(ORIG_KEY, orig.range.value));
    for (const range of [trans.range, orig.range]) range.addEventListener("change", () => { if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; } savePair(); });
    setPair({ orig: DEFAULT_ORIG_Y, trans: DEFAULT_TRANS_Y });
    try { chrome.storage.sync.get({ [ORIG_KEY]: DEFAULT_ORIG_Y, [TRANS_KEY]: DEFAULT_TRANS_Y }, got => { const pair = normalizePair(got && got[ORIG_KEY], got && got[TRANS_KEY]); setPair(pair); if (got && (got[ORIG_KEY] !== pair.orig || got[TRANS_KEY] !== pair.trans)) savePair(); }); } catch (_e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountIndependentPositionControls, { once: true }); else mountIndependentPositionControls();
})();

// Popup-only advanced-vocabulary switch. Defaults on and writes sync storage.
(function () {
  "use strict";
  const KEY = "vocabBoldEnabled";
  function labelText() {
    let lang = "";
    try { lang = (chrome.i18n && chrome.i18n.getUILanguage && chrome.i18n.getUILanguage()) || ""; } catch (_e) {}
    lang = lang.toLowerCase();
    if (/^zh-(tw|hk|mo)/.test(lang)) return "高階詞彙加粗";
    if (/^zh/.test(lang)) return "高阶词汇加粗";
    return "Bold advanced vocabulary";
  }
  function mount() {
    if (!document.getElementById("prevOverlay") || document.getElementById(KEY)) return;
    const target = document.getElementById("targetLang");
    const card = target && target.closest(".card");
    if (!card) return;
    const row = document.createElement("div"); row.className = "row row-split vocab-bold-row";
    const text = document.createElement("span"); text.className = "tts-off"; text.textContent = labelText();
    const label = document.createElement("label"); label.className = "switch"; label.title = text.textContent;
    const input = document.createElement("input"); input.type = "checkbox"; input.id = KEY; input.setAttribute("aria-label", text.textContent);
    const track = document.createElement("span"); track.className = "switch-track";
    const thumb = document.createElement("span"); thumb.className = "switch-thumb"; track.appendChild(thumb); label.append(input, track); row.append(text, label);
    const targetRow = target.closest(".row"); targetRow.insertAdjacentElement("afterend", row);
    input.checked = true;
    try { chrome.storage.sync.get({ [KEY]: true }, got => { input.checked = !got || got[KEY] !== false; }); } catch (_e) {}
    input.addEventListener("change", () => { try { chrome.storage.sync.set({ [KEY]: input.checked }); } catch (_e) {} });
    try { chrome.storage.onChanged.addListener((changes, area) => { if (area === "sync" && changes[KEY]) input.checked = changes[KEY].newValue !== false; }); } catch (_e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true }); else mount();
})();
