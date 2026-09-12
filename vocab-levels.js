// vocab-levels.js — local vocabulary difficulty classifier.
// Project-specific 1–9 scale. Level 5+ is highlighted.
(function (root, factory) {
  const api = factory(root || globalThis);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.YTDS_VOCAB = api;
})(typeof self !== 'undefined' ? self : globalThis, function (root) {
  'use strict';

  const DATA = (root && root.YTDS_VOCAB_DATA) || { levels: Object.create(null), zh: Object.create(null) };
  const LEVEL_HIGHLIGHT_MIN = 5;
  const LEVEL_BOLD_MIN = LEVEL_HIGHLIGHT_MIN; // temporary compatibility alias until old tests are removed
  const LEVELS = DATA.levels || Object.create(null);

  const IRREGULAR = Object.freeze({
    went: 'go', gone: 'go', gave: 'give', given: 'give', took: 'take', taken: 'take',
    made: 'make', thought: 'think', brought: 'bring', bought: 'buy', taught: 'teach',
    wrote: 'write', written: 'write', spoke: 'speak', spoken: 'speak',
    chose: 'choose', chosen: 'choose', knew: 'know', known: 'know',
    saw: 'see', seen: 'see', came: 'come', became: 'become', begun: 'begin', began: 'begin'
  });

  const ACADEMIC_SUFFIX = /(?:ability|ibility|ization|isation|ological|ometric|escence|ential|ative|atory|ivity|ality|istic|ously|iveness)$/;
  function hasLevel(word) { return Object.prototype.hasOwnProperty.call(LEVELS, word); }
  function isUrl(s) { return /^(?:https?:\/\/|www\.)/i.test(s); }
  function isNumber(s) { return /^[+-]?(?:\d+(?:[.,]\d+)*)$/.test(s); }

  function tokenize(sentence) {
    const s = String(sentence || '');
    const out = [];
    const re = /https?:\/\/[^\s]+|www\.[^\s]+|[A-Za-z]+(?:['’][A-Za-z]+)?|\d+(?:[.,]\d+)*/g;
    let m;
    while ((m = re.exec(s))) out.push({ text: m[0], start: m.index, end: m.index + m[0].length });
    return out;
  }

  function candidates(word) {
    const w = word.toLowerCase().replace(/[’]/g, "'");
    const out = [w];
    if (IRREGULAR[w]) out.unshift(IRREGULAR[w]);
    if (w.endsWith("'s") && w.length > 3) out.push(w.slice(0, -2));
    if (w.endsWith('ies') && w.length > 4) out.push(w.slice(0, -3) + 'y');
    if (w.endsWith('ied') && w.length > 4) out.push(w.slice(0, -3) + 'y');
    if (w.endsWith('ing') && w.length > 5) {
      const stem = w.slice(0, -3);
      out.push(stem, stem + 'e');
      if (/([b-df-hj-np-tv-z])\1$/.test(stem)) out.push(stem.slice(0, -1));
    }
    if (w.endsWith('ed') && w.length > 4) {
      const stem = w.slice(0, -2);
      out.push(stem, stem + 'e');
      if (/([b-df-hj-np-tv-z])\1$/.test(stem)) out.push(stem.slice(0, -1));
    }
    if (w.endsWith('es') && w.length > 4) out.push(w.slice(0, -2), w.slice(0, -1));
    if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) out.push(w.slice(0, -1));
    return [...new Set(out)];
  }

  function lemmaOf(token) {
    const raw = String(token || '');
    if (!raw || isUrl(raw) || isNumber(raw)) return raw.toLowerCase();
    const cs = candidates(raw);
    for (const c of cs) if (hasLevel(c)) return c;
    return cs[0] || raw.toLowerCase();
  }

  function contextOverride(lemma, sentence) {
    const s = String(sentence || '');
    if (lemma === 'address') {
      if (/\baddress(?:es|ed|ing)?\s+(?:the\s+)?(?:[a-z-]+\s+){0,2}(?:problem|issue|challenge|question|concern|gap|risk|need|inequality|cause|impact|shortcoming|barrier)s?\b/i.test(s)) {
        return { level: 5, reason: 'sense:deal-with-problem' };
      }
      return { level: 3, reason: 'common-sense' };
    }
    if (lemma === 'pose' && /\bpose(?:s|d|ing)?\s+(?:a\s+|an\s+|the\s+)?(?:threat|risk|challenge|problem|question)s?\b/i.test(s)) {
      return { level: 5, reason: 'sense:present-risk' };
    }
    return null;
  }

  function classifyToken(token, sentence) {
    const raw = String(token || '');
    const normalized = raw.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9'’:/._-]+$/g, '');
    if (!normalized || isUrl(normalized) || isNumber(normalized)) {
      return { level: 1, lemma: normalized.toLowerCase(), reason: isUrl(normalized) ? 'url' : 'nonlexical' };
    }

    const lemma = lemmaOf(normalized);
    const override = contextOverride(lemma, sentence);
    if (override) return { level: override.level, lemma, reason: override.reason };
    if (hasLevel(lemma)) return { level: LEVELS[lemma], lemma, reason: 'generated-lexicon' };

    const properLike = /^[A-Z][A-Za-z'-]*$/.test(normalized) && !/^I$/.test(normalized);
    if (properLike) return { level: 2, lemma, reason: 'proper-name-conservative' };
    if (lemma.length >= 11 && ACADEMIC_SUFFIX.test(lemma)) return { level: 5, lemma, reason: 'academic-morphology' };
    return { level: 3, lemma, reason: 'unknown-conservative' };
  }

  function classifySentence(sentence) {
    const s = String(sentence || '');
    return tokenize(s).map(t => ({ ...t, ...classifyToken(t.text, s) }));
  }

  // Retained only until the obsolete marker prototype is removed in the color migration.
  function markSource(sentence, classified) {
    const s = String(sentence || '');
    const items = Array.isArray(classified) ? classified.filter(x => x && x.level >= LEVEL_HIGHLIGHT_MIN) : [];
    if (!items.length) return { text: s, ids: [] };
    let cursor = 0, out = '';
    const ids = [];
    items.sort((a, b) => a.start - b.start).forEach(item => {
      if (!(item.start >= cursor && item.end > item.start && item.end <= s.length)) return;
      const id = 'v' + ids.length;
      out += s.slice(cursor, item.start) + `⟦${id}⟧` + s.slice(item.start, item.end) + `⟦/${id}⟧`;
      ids.push(id); cursor = item.end;
    });
    out += s.slice(cursor);
    return { text: out, ids };
  }

  function parseMarkedTranslation(input) {
    const s = String(input || '');
    const marker = /⟦(\/)?(v\d+)⟧/g;
    const stack = [], spans = [], seen = new Set();
    let plain = '', cursor = 0, m;
    while ((m = marker.exec(s))) {
      plain += s.slice(cursor, m.index);
      const closing = !!m[1], id = m[2];
      if (!closing) {
        if (seen.has(id) || stack.some(x => x.id === id)) return null;
        seen.add(id); stack.push({ id, start: plain.length });
      } else {
        const top = stack.pop();
        if (!top || top.id !== id) return null;
        spans.push({ id, start: top.start, end: plain.length });
      }
      cursor = marker.lastIndex;
    }
    plain += s.slice(cursor);
    if (stack.length || /⟦\/?v\d+⟧/.test(plain)) return null;
    spans.sort((a, b) => a.start - b.start);
    return { text: plain, spans };
  }

  return Object.freeze({
    LEVEL_HIGHLIGHT_MIN, LEVEL_BOLD_MIN,
    tokenize, classifyToken, classifySentence, markSource, parseMarkedTranslation
  });
});
