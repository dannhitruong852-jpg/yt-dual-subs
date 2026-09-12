// vocab-runtime.js — network-free Level-5+ vocabulary color highlighting.
// Presentation only: no translation requests and no MutationObserver feedback loop.
(() => {
  "use strict";
  if (window.__ytdsVocabRuntimeLoaded) return;
  window.__ytdsVocabRuntimeLoaded = true;

  const V = self.YTDS_VOCAB;
  const DATA = self.YTDS_VOCAB_DATA || { zh: Object.create(null) };
  if (!V) return;

  const DEFAULTS = Object.freeze({
    vocabHighlightEnabled: true,
    vocabOrigColor: "#FFD54F",
    vocabTransColor: "#80DEEA",
    targetLang: "zh-CN"
  });
  let settings = { ...DEFAULTS };
  let origEl = null, transEl = null;
  let sourceText = "", translatedText = "";
  let lastSignature = "";

  function validColor(v, fallback) {
    return /^#[0-9a-f]{6}$/i.test(String(v || "")) ? String(v) : fallback;
  }

  function renderRanges(el, text, ranges, color) {
    const s = String(text || "");
    const safe = (ranges || [])
      .filter(r => r && Number.isInteger(r.start) && Number.isInteger(r.end) && r.start >= 0 && r.end > r.start && r.end <= s.length)
      .sort((a, b) => a.start - b.start);
    const frag = document.createDocumentFragment();
    let cursor = 0;
    for (const r of safe) {
      if (r.start < cursor) continue;
      if (r.start > cursor) frag.appendChild(document.createTextNode(s.slice(cursor, r.start)));
      const span = document.createElement("span");
      span.className = "ytds-vocab-highlight";
      span.style.color = color;
      span.textContent = s.slice(r.start, r.end);
      frag.appendChild(span);
      cursor = r.end;
    }
    if (cursor < s.length) frag.appendChild(document.createTextNode(s.slice(cursor)));
    el.replaceChildren(frag);
  }

  function chineseRanges(classified, text) {
    if (!/^zh(?:-|$)/i.test(settings.targetLang)) return [];
    const out = [], claimed = [];
    for (const item of classified) {
      if (!item || item.level < V.LEVEL_HIGHLIGHT_MIN) continue;
      const candidates = (DATA.zh && DATA.zh[item.lemma]) || [];
      const hits = [];
      for (const surface of candidates) {
        if (!surface) continue;
        let from = 0, at;
        while ((at = text.indexOf(surface, from)) >= 0) {
          hits.push({ start: at, end: at + surface.length, lemma: item.lemma, surface });
          from = at + surface.length;
        }
      }
      const unique = hits.filter((h, i, a) => a.findIndex(x => x.start === h.start && x.end === h.end) === i);
      if (unique.length !== 1) continue;
      const hit = unique[0];
      if (claimed.some(r => hit.start < r.end && hit.end > r.start)) continue;
      claimed.push(hit); out.push(hit);
    }
    return out.sort((a, b) => a.start - b.start);
  }

  function plainRestore() {
    if (origEl && origEl.querySelector(".ytds-vocab-highlight")) origEl.textContent = sourceText;
    if (transEl && transEl.querySelector(".ytds-vocab-highlight")) transEl.textContent = translatedText;
  }

  function repaint(force = false) {
    const overlay = document.getElementById("ytds-overlay");
    const o = overlay && overlay.querySelector(".ytds-orig");
    const t = overlay && overlay.querySelector(".ytds-trans");
    if (!o || !t) return;
    if (o !== origEl || t !== transEl) {
      origEl = o; transEl = t; force = true;
      sourceText = o.textContent || "";
      translatedText = t.textContent || "";
    }

    const observedSource = o.textContent || "";
    const observedTrans = t.textContent || "";
    if (observedSource !== sourceText) { sourceText = observedSource; force = true; }
    if (observedTrans !== translatedText) { translatedText = observedTrans; force = true; }

    if (!settings.vocabHighlightEnabled) {
      plainRestore(); lastSignature = "off:" + sourceText + "\n" + translatedText; return;
    }

    const classified = V.classifySentence(sourceText);
    const english = classified.filter(x => x.level >= V.LEVEL_HIGHLIGHT_MIN);
    const chinese = chineseRanges(classified, translatedText);
    const signature = [sourceText, translatedText, settings.vocabOrigColor, settings.vocabTransColor,
      english.map(x => `${x.start}:${x.end}`).join(','), chinese.map(x => `${x.start}:${x.end}`).join(',')].join("\n");

    const missingEnglish = english.length && o.querySelectorAll(".ytds-vocab-highlight").length !== english.length;
    const missingChinese = chinese.length && t.querySelectorAll(".ytds-vocab-highlight").length !== chinese.length;
    if (!force && signature === lastSignature && !missingEnglish && !missingChinese) return;
    lastSignature = signature;

    if (english.length) renderRanges(o, sourceText, english, settings.vocabOrigColor);
    else if (o.querySelector(".ytds-vocab-highlight")) o.textContent = sourceText;

    if (chinese.length) renderRanges(t, translatedText, chinese, settings.vocabTransColor);
    else if (t.querySelector(".ytds-vocab-highlight")) t.textContent = translatedText;
  }

  const timer = setInterval(() => repaint(false), 180);
  window.addEventListener("pagehide", () => clearInterval(timer), { once: true });

  try {
    chrome.storage.sync.get({ ...DEFAULTS, vocabBoldEnabled: true }, got => {
      const migratedEnabled = Object.prototype.hasOwnProperty.call(got || {}, "vocabHighlightEnabled")
        ? got.vocabHighlightEnabled !== false : got.vocabBoldEnabled !== false;
      settings = {
        ...settings,
        vocabHighlightEnabled: migratedEnabled,
        vocabOrigColor: validColor(got && got.vocabOrigColor, DEFAULTS.vocabOrigColor),
        vocabTransColor: validColor(got && got.vocabTransColor, DEFAULTS.vocabTransColor),
        targetLang: String((got && got.targetLang) || DEFAULTS.targetLang)
      };
      repaint(true);
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      let changed = false;
      if (changes.vocabHighlightEnabled) { settings.vocabHighlightEnabled = changes.vocabHighlightEnabled.newValue !== false; changed = true; }
      // Compatibility while the old popup switch is being migrated.
      if (changes.vocabBoldEnabled && !changes.vocabHighlightEnabled) { settings.vocabHighlightEnabled = changes.vocabBoldEnabled.newValue !== false; changed = true; }
      if (changes.vocabOrigColor) { settings.vocabOrigColor = validColor(changes.vocabOrigColor.newValue, DEFAULTS.vocabOrigColor); changed = true; }
      if (changes.vocabTransColor) { settings.vocabTransColor = validColor(changes.vocabTransColor.newValue, DEFAULTS.vocabTransColor); changed = true; }
      if (changes.targetLang) { settings.targetLang = String(changes.targetLang.newValue || DEFAULTS.targetLang); changed = true; }
      if (changed) repaint(true);
    });
  } catch (_e) { repaint(true); }
})();
