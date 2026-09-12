// skins.js — which look the extension's own two pages wear.
//
// Loaded FIRST in the <head> of popup.html and options.html, before the
// stylesheets have anything to paint. It does three things, in this order:
//
//   1. Reads the last-known choice from localStorage — synchronously, which is
//      the whole reason this file exists. chrome.storage is async, and a popup
//      that paints in one skin and switches to another 80ms later flashes on
//      every single open. localStorage is the cache; it is never the truth.
//   2. Reconciles against chrome.storage.sync, which IS the truth, and writes
//      the cache back. A first open on a second machine flashes once and then
//      never again.
//   3. Follows later changes, so the settings page and an open popup agree
//      without either being reloaded.
//
// Adding a skin later is two lines: an entry in SKINS below, and a block in
// skins.css under `html[data-skin="<id>"]`. Nothing else in the codebase knows
// a skin exists — the pages carry one attribute and the CSS does the rest.
//
// Why an attribute on <html> and not a second stylesheet: a <link> added at
// runtime loads asynchronously, which is the flash again. Every skin ships in
// one already-linked file and costs nothing until its attribute is set.

(function (root) {
  "use strict";

  const KEY = "uiSkin";                 // chrome.storage.sync
  const CACHE = "ytdsSkin";             // localStorage, same value, fast path
  const DEFAULT = "default";

  // `name` is a proper name and stays untranslated the way provider names do;
  // `nameKey` is for skins whose name is a word rather than a name — the
  // shipped default is one ("默认" / "Default"), so it carries a key.
  // swatch = 底 / 强调 / **第三个真正用得上的颜色**。它是给「挑哪一套」用的
  // 辨认，不是预览：真正的预览是设置页当场换漆，你看见的就是真界面。
  // 第三块取那一套自己的第二个信号色(霓虹的品红)；只有一个强调色的皮肤——
  // 出厂这一套就是——取它的文字色，因为再取一个近黑的边框色，三块里就有两块
  // 看不出区别，色块也就不再帮人辨认了。
  // 三块色必须是那一套**真的在用**的 token：options-interact 会在皮肤生效之后
  // 量真实像素来对第一块和第二块，第三块必须出现在它声明过的 token 里。
  const SKINS = [
    { id: "default", nameKey: "skinDefault", name: "Default",
      swatch: ["#0e0f11", "#3ea6ff", "#f1f1f1"] },
    { id: "neon", nameKey: "skinNeon", name: "Neon Terminal",
      swatch: ["#07080c", "#38e8ff", "#ff4d8d"] },
    { id: "ember", nameKey: "skinEmber", name: "Ember",
      swatch: ["#140e0a", "#ec9e5d", "#e06b4f"] },
    { id: "mocha", nameKey: "skinMocha", name: "Mocha",
      swatch: ["#1a1815", "#8ba876", "#eaddcf"] },
    { id: "ink", nameKey: "skinInk", name: "Ink",
      swatch: ["#000000", "#8ba3c7", "#ececf1"] },
    { id: "dusk", nameKey: "skinDusk", name: "Dusk",
      swatch: ["#121018", "#b794f6", "#e089c0"] }
  ];
  const BY_ID = {};
  for (const s of SKINS) BY_ID[s.id] = s;

  const known = (id) => (typeof id === "string" && BY_ID[id]) ? id : DEFAULT;

  // The default skin is the stylesheets as written, so it carries NO attribute
  // at all. That keeps `html:not([data-skin])` correct for anyone reading the
  // DOM, and means a skin can never half-apply if skins.css fails to load.
  function apply(id) {
    const el = document.documentElement;
    if (!el) return;
    const use = known(id);
    if (use === DEFAULT) el.removeAttribute("data-skin");
    else el.setAttribute("data-skin", use);
  }

  function cacheWrite(id) {
    try { localStorage.setItem(CACHE, known(id)); } catch (_e) { /* private mode: skip */ }
  }
  function cacheRead() {
    try { return known(localStorage.getItem(CACHE)); } catch (_e) { return DEFAULT; }
  }

  // ---- 1. the synchronous first paint --------------------------------------
  apply(cacheRead());

  // ---- 2. reconcile with the truth ----------------------------------------
  try {
    chrome.storage.sync.get({ [KEY]: DEFAULT }, (got) => {
      const id = known(got && got[KEY]);
      cacheWrite(id);
      apply(id);
    });
  } catch (_e) { /* no extension APIs (a mock-up page): the cache stands */ }

  // ---- 3. follow later changes --------------------------------------------
  try {
    chrome.storage.onChanged.addListener((ch, area) => {
      if (area !== "sync" || !ch[KEY]) return;
      const id = known(ch[KEY].newValue);
      cacheWrite(id);
      apply(id);
    });
  } catch (_e) { /* ditto */ }

  function set(id) {
    const use = known(id);
    cacheWrite(use);
    apply(use);                        // instant here; onChanged carries it elsewhere
    return new Promise((resolve) => {
      try { chrome.storage.sync.set({ [KEY]: use }, resolve); }
      catch (_e) { resolve(); }
    });
  }

  root.YTDS_SKINS = {
    list: SKINS,
    get: (id) => BY_ID[known(id)],
    DEFAULT,
    KEY,
    current: () => known(document.documentElement.getAttribute("data-skin")),
    apply, set
  };
})(typeof self !== "undefined" ? self : this);

// User fork: the two subtitle lines have independent vertical positions.
// skins.js is already loaded by the popup, so mounting the two sliders here
// avoids changing the popup's large, otherwise-upstream HTML/JS files.
(function () {
  "use strict";

  const ORIG_KEY = "origYpct";
  const TRANS_KEY = "transYpct";
  const DEFAULT_ORIG_Y = 12;
  const DEFAULT_TRANS_Y = 88;

  function clamp(value, fallback) {
    let n = Number(value);
    if (!Number.isFinite(n)) n = fallback;
    return Math.max(0, Math.min(100, n));
  }

  function makeRow(id, labelText, initial) {
    const row = document.createElement("div");
    row.className = "row ytds-independent-position-row";

    const label = document.createElement("label");
    label.setAttribute("for", id);
    const text = document.createElement("span");
    text.textContent = labelText;
    const value = document.createElement("b");
    value.id = id + "V";
    value.textContent = initial + "%";
    label.append(text, document.createTextNode(" "), value);

    const range = document.createElement("input");
    range.type = "range";
    range.id = id;
    range.min = "0";
    range.max = "100";
    range.step = "1";
    range.value = String(initial);
    range.setAttribute("aria-label", labelText);

    row.append(label, range);
    return { row, range, value };
  }

  function mountIndependentPositionControls() {
    const position = document.getElementById("position");
    if (!position || document.getElementById(ORIG_KEY)) return; // options page or already mounted

    const card = position.closest(".card");
    if (!card) return;

    // These controls move the old single subtitle block. Keeping them visible
    // would make three controls fight over one concept, so the fork replaces
    // them with the two independent line sliders.
    for (const id of ["order", "position", "rowGap"]) {
      const el = document.getElementById(id);
      const row = el && el.closest(".row");
      if (row) row.hidden = true;
    }

    const orig = makeRow(ORIG_KEY, "英文位置", DEFAULT_ORIG_Y);
    const trans = makeRow(TRANS_KEY, "中文位置", DEFAULT_TRANS_Y);
    const selectText = document.getElementById("selectText");
    const before = selectText ? selectText.closest("label") : null;
    card.insertBefore(orig.row, before);
    card.insertBefore(trans.row, before);

    const hint = document.createElement("p");
    hint.className = "tip ytds-position-hint";
    hint.textContent = "0% = 视频顶部 · 100% = 视频底部";
    card.insertBefore(hint, before);

    // Make the existing popup preview obey the same independent geometry.
    const style = document.createElement("style");
    style.textContent = `
      #prevOverlay { position:absolute !important; inset:0 !important; width:100% !important;
        height:100% !important; transform:none !important; display:block !important; }
      #prevOrig, #prevTrans { position:absolute !important; left:50% !important; width:max-content;
        max-width:92% !important; transform:translate(-50%, -50%) !important; }
      #prevOrig { top:var(--ytds-popup-orig-y, 12%) !important; }
      #prevTrans { top:var(--ytds-popup-trans-y, 88%) !important; }
    `;
    document.head.appendChild(style);

    let pendingTimer = null;
    function paint(key, val) {
      const pct = clamp(val, key === ORIG_KEY ? DEFAULT_ORIG_Y : DEFAULT_TRANS_Y);
      document.documentElement.style.setProperty(
        key === ORIG_KEY ? "--ytds-popup-orig-y" : "--ytds-popup-trans-y",
        pct + "%"
      );
      return pct;
    }
    function save(key, value) {
      try { chrome.storage.sync.set({ [key]: value }); } catch (_e) { /* popup closing */ }
    }
    function bind(control, key, fallback) {
      const { range, value } = control;
      const onInput = () => {
        const pct = paint(key, range.value);
        value.textContent = pct + "%";
        if (pendingTimer) clearTimeout(pendingTimer);
        pendingTimer = setTimeout(() => save(key, pct), 140);
      };
      range.addEventListener("input", onInput);
      range.addEventListener("change", () => {
        if (pendingTimer) { clearTimeout(pendingTimer); pendingTimer = null; }
        const pct = paint(key, range.value);
        value.textContent = pct + "%";
        save(key, pct);
      });
      const init = clamp(range.value, fallback);
      paint(key, init);
    }

    bind(orig, ORIG_KEY, DEFAULT_ORIG_Y);
    bind(trans, TRANS_KEY, DEFAULT_TRANS_Y);

    try {
      chrome.storage.sync.get(
        { [ORIG_KEY]: DEFAULT_ORIG_Y, [TRANS_KEY]: DEFAULT_TRANS_Y },
        (got) => {
          const o = clamp(got && got[ORIG_KEY], DEFAULT_ORIG_Y);
          const t = clamp(got && got[TRANS_KEY], DEFAULT_TRANS_Y);
          orig.range.value = String(o); orig.value.textContent = o + "%"; paint(ORIG_KEY, o);
          trans.range.value = String(t); trans.value.textContent = t + "%"; paint(TRANS_KEY, t);
        }
      );
    } catch (_e) { /* defaults already painted */ }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountIndependentPositionControls, { once: true });
  } else {
    mountIndependentPositionControls();
  }
})();
