// vocab-runtime.js — presentation-only vocabulary emphasis for the subtitle overlay.
// Runs after content.js. It never changes TTS/export state; it only decorates the
// rendered DOM and optionally asks the existing translate worker for marked Chinese.
(() => {
  "use strict";

  if (window.__ytdsVocabRuntimeLoaded) return;
  window.__ytdsVocabRuntimeLoaded = true;

  const V = self.YTDS_VOCAB;
  if (!V) return;

  const KEY = "vocabBoldEnabled";
  let enabled = true;
  let targetLang = "zh-CN";
  let engine = "auto";
  let origEl = null;
  let transEl = null;
  let lineObserver = null;
  let origRaw = "";
  let transRaw = "";
  let currentAdvanced = [];
  let epoch = 0;
  let scheduled = false;
  let lastAlignedText = "";
  const alignCache = new Map();
  const alignPending = new Set();

  function addStyle() {
    if (document.getElementById("ytds-vocab-style")) return;
    const style = document.createElement("style");
    style.id = "ytds-vocab-style";
    style.textContent = ".ytds-vocab-bold{font-weight:700!important}";
    (document.head || document.documentElement).appendChild(style);
  }

  function renderRanges(el, text, ranges) {
    const s = String(text || "");
    const safe = (Array.isArray(ranges) ? ranges : [])
      .filter(r => r && Number.isInteger(r.start) && Number.isInteger(r.end) && r.start >= 0 && r.end > r.start && r.end <= s.length)
      .sort((a, b) => a.start - b.start);
    const frag = document.createDocumentFragment();
    let cursor = 0;
    for (const r of safe) {
      if (r.start < cursor) continue;
      if (r.start > cursor) frag.appendChild(document.createTextNode(s.slice(cursor, r.start)));
      const span = document.createElement("span");
      span.className = "ytds-vocab-bold";
      span.textContent = s.slice(r.start, r.end);
      frag.appendChild(span);
      cursor = r.end;
    }
    if (cursor < s.length) frag.appendChild(document.createTextNode(s.slice(cursor)));
    el.replaceChildren(frag);
  }

  function restorePlain() {
    epoch++;
    currentAdvanced = [];
    lastAlignedText = "";
    if (origEl && (origEl.textContent !== origRaw || origEl.querySelector(".ytds-vocab-bold"))) origEl.textContent = origRaw;
    if (transEl && (transEl.textContent !== transRaw || transEl.querySelector(".ytds-vocab-bold"))) transEl.textContent = transRaw;
  }

  function currentVideoId() {
    try {
      const u = new URL(location.href);
      const watch = u.searchParams.get("v");
      if (watch) return watch;
      const m = /^\/shorts\/([^/?#]+)/.exec(u.pathname);
      return m ? m[1] : "";
    } catch (_e) { return ""; }
  }

  function cacheKey(source) {
    return [currentVideoId(), targetLang, engine, source].join("\n");
  }

  function renderCachedTranslation(source) {
    if (!enabled || !transEl || !/^zh(?:-|$)/i.test(targetLang)) return false;
    const parsed = alignCache.get(cacheKey(source));
    if (!parsed || !parsed.spans || !parsed.spans.length) return false;
    lastAlignedText = parsed.text;
    renderRanges(transEl, parsed.text, parsed.spans);
    return true;
  }

  function requestAlignment(source, classified) {
    if (!enabled || !/^zh(?:-|$)/i.test(targetLang)) return;
    const marked = V.markSource(source, classified);
    if (!marked.ids.length) return;
    const key = cacheKey(source);
    if (alignCache.has(key)) { renderCachedTranslation(source); return; }
    if (alignPending.has(key)) return;
    alignPending.add(key);
    const myEpoch = epoch;
    try {
      chrome.runtime.sendMessage({ type: "translate", text: marked.text, targetLang, urgent: true }, (res) => {
        alignPending.delete(key);
        if (chrome.runtime.lastError || !res || !res.ok || typeof res.translated !== "string") {
          alignCache.set(key, null); return;
        }
        const parsed = V.parseMarkedTranslation(res.translated);
        if (!parsed || parsed.spans.length !== marked.ids.length || parsed.spans.some(s => s.end <= s.start)) {
          alignCache.set(key, null); return;
        }
        alignCache.set(key, parsed);
        if (!enabled || myEpoch !== epoch || origRaw !== source || key !== cacheKey(source)) return;
        renderCachedTranslation(source);
      });
    } catch (_e) {
      alignPending.delete(key);
      alignCache.set(key, null);
    }
  }

  function applyOriginal(source) {
    if (!origEl) return;
    if (!enabled) { if (origEl.querySelector(".ytds-vocab-bold")) origEl.textContent = source; return; }
    const classified = V.classifySentence(source);
    currentAdvanced = classified.filter(x => x.level >= V.LEVEL_BOLD_MIN);
    if (!currentAdvanced.length) {
      if (origEl.querySelector(".ytds-vocab-bold")) origEl.textContent = source;
      return;
    }
    const hasExpected = origEl.querySelectorAll(".ytds-vocab-bold").length === currentAdvanced.length;
    if (!hasExpected) renderRanges(origEl, source, currentAdvanced);
    requestAlignment(source, classified);
  }

  function syncLines() {
    scheduled = false;
    if (!origEl || !transEl || !origEl.isConnected || !transEl.isConnected) return;

    const oldAlignedText = lastAlignedText;
    const observedOrig = origEl.textContent || "";
    const sourceChanged = observedOrig !== origRaw;
    if (sourceChanged) {
      origRaw = observedOrig;
      epoch++;
      currentAdvanced = [];
    }

    const observedTrans = transEl.textContent || "";
    const isOwnAligned = !!transEl.querySelector(".ytds-vocab-bold") && observedTrans === oldAlignedText;
    if (!isOwnAligned && observedTrans !== transRaw) transRaw = observedTrans;

    // If YouTube/content.js advanced the English cue before it replaced the
    // translated line, discard our old decorated Chinese DOM without mistaking
    // it for the next cue's ordinary translation.
    if (sourceChanged) {
      if (isOwnAligned && transEl.textContent !== transRaw) transEl.textContent = transRaw;
      lastAlignedText = "";
    }

    if (!enabled) { restorePlain(); return; }
    applyOriginal(origRaw);
    if (currentAdvanced.length && renderCachedTranslation(origRaw)) return;
    if (lastAlignedText && transEl.textContent === lastAlignedText && transRaw !== lastAlignedText) {
      transEl.textContent = transRaw;
      lastAlignedText = "";
    }
  }

  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(syncLines);
  }

  function attach(overlay) {
    const o = overlay && overlay.querySelector(".ytds-orig");
    const t = overlay && overlay.querySelector(".ytds-trans");
    if (!o || !t || (o === origEl && t === transEl)) return;
    if (lineObserver) lineObserver.disconnect();
    origEl = o; transEl = t;
    origRaw = o.textContent || "";
    transRaw = t.textContent || "";
    lastAlignedText = "";
    lineObserver = new MutationObserver(scheduleSync);
    lineObserver.observe(o, { childList: true, characterData: true, subtree: true });
    lineObserver.observe(t, { childList: true, characterData: true, subtree: true });
    scheduleSync();
  }

  function findOverlay() {
    const overlay = document.getElementById("ytds-overlay");
    if (overlay) attach(overlay);
  }

  addStyle();
  findOverlay();
  const finder = setInterval(findOverlay, 700);
  window.addEventListener("pagehide", () => { clearInterval(finder); if (lineObserver) lineObserver.disconnect(); }, { once: true });

  try {
    chrome.storage.sync.get({ [KEY]: true, targetLang: "zh-CN", engine: "auto" }, got => {
      enabled = !got || got[KEY] !== false;
      targetLang = String((got && got.targetLang) || "zh-CN");
      engine = String((got && got.engine) || "auto");
      if (!enabled) restorePlain(); else scheduleSync();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      let repaint = false;
      if (changes[KEY]) {
        enabled = changes[KEY].newValue !== false;
        epoch++;
        repaint = true;
      }
      if (changes.targetLang) {
        targetLang = String(changes.targetLang.newValue || "zh-CN");
        epoch++;
        lastAlignedText = "";
        repaint = true;
      }
      if (changes.engine) {
        engine = String(changes.engine.newValue || "auto");
        epoch++;
        lastAlignedText = "";
        repaint = true;
      }
      if (repaint) {
        if (!enabled) restorePlain();
        else { if (origEl) origEl.textContent = origRaw; if (transEl) transEl.textContent = transRaw; scheduleSync(); }
      }
    });
  } catch (_e) { scheduleSync(); }
})();
