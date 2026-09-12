// vocab-runtime.js — presentation-only Level-5+ emphasis for the English line.
//
// Safety rule: this layer never performs translation/network work and never
// writes the translated line. Chinese alignment must be supplied by the normal
// translation pipeline itself so vocabulary emphasis cannot increase request
// volume or interfere with engine switching.
(() => {
  "use strict";

  if (window.__ytdsVocabRuntimeLoaded) return;
  window.__ytdsVocabRuntimeLoaded = true;

  const V = self.YTDS_VOCAB;
  if (!V) return;

  const KEY = "vocabBoldEnabled";
  let enabled = true;
  let origEl = null;
  let lineObserver = null;
  let origRaw = "";
  let scheduled = false;

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
      .filter(r => r && Number.isInteger(r.start) && Number.isInteger(r.end) &&
        r.start >= 0 && r.end > r.start && r.end <= s.length)
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
    if (!origEl) return;
    if (origEl.querySelector(".ytds-vocab-bold") || origEl.textContent !== origRaw) {
      origEl.textContent = origRaw;
    }
  }

  function applyOriginal(source) {
    if (!origEl) return;
    if (!enabled) { restorePlain(); return; }

    const advanced = V.classifySentence(source)
      .filter(x => x.level >= V.LEVEL_BOLD_MIN);
    if (!advanced.length) {
      if (origEl.querySelector(".ytds-vocab-bold")) origEl.textContent = source;
      return;
    }

    // Idempotence is mandatory because renderRanges mutates a node watched by
    // lineObserver. If the expected decorated DOM is already present, do not
    // write it again or the observer would schedule another render forever.
    const spans = origEl.querySelectorAll(".ytds-vocab-bold");
    const alreadyRendered = origEl.textContent === source && spans.length === advanced.length &&
      advanced.every((r, i) => spans[i] && spans[i].textContent === source.slice(r.start, r.end));
    if (!alreadyRendered) renderRanges(origEl, source, advanced);
  }

  function syncLine() {
    scheduled = false;
    if (!origEl || !origEl.isConnected) return;

    const observed = origEl.textContent || "";
    if (observed !== origRaw) origRaw = observed;

    if (!enabled) { restorePlain(); return; }
    applyOriginal(origRaw);
  }

  function scheduleSync() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(syncLine);
  }

  function attach(overlay) {
    const o = overlay && overlay.querySelector(".ytds-orig");
    if (!o || o === origEl) return;
    if (lineObserver) lineObserver.disconnect();
    origEl = o;
    origRaw = o.textContent || "";
    lineObserver = new MutationObserver(scheduleSync);
    lineObserver.observe(o, { childList: true, characterData: true, subtree: true });
    scheduleSync();
  }

  function findOverlay() {
    const overlay = document.getElementById("ytds-overlay");
    if (overlay) attach(overlay);
  }

  addStyle();
  findOverlay();
  const finder = setInterval(findOverlay, 700);
  window.addEventListener("pagehide", () => {
    clearInterval(finder);
    if (lineObserver) lineObserver.disconnect();
  }, { once: true });

  try {
    chrome.storage.sync.get({ [KEY]: true }, got => {
      enabled = !got || got[KEY] !== false;
      if (!enabled) restorePlain(); else scheduleSync();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync" || !changes[KEY]) return;
      enabled = changes[KEY].newValue !== false;
      if (!enabled) restorePlain(); else scheduleSync();
    });
  } catch (_e) { scheduleSync(); }
})();
