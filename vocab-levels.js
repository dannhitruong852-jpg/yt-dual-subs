// vocab-levels.js — local vocabulary difficulty classifier + alignment markers.
// Project-specific 1–9 scale. Level 5+ is considered advanced for bolding.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.YTDS_VOCAB = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  const LEVEL_BOLD_MIN = 5;

  const LEVELS = Object.create(null);
  function add(level, words) {
    for (const w of words.split(/\s+/)) if (w) LEVELS[w] = level;
  }

  add(4, `awkward available average benefit challenge compare concern context
    determine essential estimate eventually frequent identify indicate influence
    likely major method obvious participate particular potential previous primary
    provide range reduce significant similar source specific standard strategy
    suggest various information education experience important different possible
    relationship development environment government community technology
    individual understand question language business university difficult
    international organization conversation opportunity situation necessary
    especially actually probably usually together although however therefore`);

  add(5, `abstract acknowledge adequate advocate allocate ambiguous arbitrary
    coherent competent comprehensive conventional crucial derive diminish ethical
    legitimate preliminary reluctant subtle sustain valid vulnerable compel
    controversial distort reinforce accumulate adjacent analogy anticipate
    apparent approximate attain attribute cease clarify coincide compile conceive
    concurrent constrain contradict convert correlate decline deduce demonstrate
    deviate discrete dispose diverse domestic eliminate emerge encounter enhance
    equivalent explicit facilitate finite flexible framework fundamental generate
    hypothesis illustrate imply incentive incidence inevitable infer inhibit
    initial inspect integrate intermediate interpret intervene isolate justify
    manipulate mature maximize minimize modify monitor objective obtain orient
    persist predominant prohibit promote proportion prospect refine regulate
    relevant rely restrict retain reveal revise rigid scope sector specify stable
    statistic substitute subsequent sufficient suspend transform transmit trend
    ultimate undergo uniform utilize visible welfare whereas`);

  add(6, `exacerbate empirical intrinsic fluctuate mitigate paradigm plausible
    profound salient scrutinize undermine unprecedented ubiquitous nuanced
    reconcile inherent indispensable tentative robust pervasive viable articulate
    autonomous cumulative deteriorate differentiate discrepancy dynamic elaborate
    encompass entail exploit formulation hierarchy holistic impartial implicit
    impose induce innovative integral interaction invoke mechanism methodology
    offset persistent prerequisite qualitative quantitative rational resilient
    rigorous sophisticated subordinate synthesize trajectory transparent
    validate volatility marginalize convergence divergence susceptibility
    disproportionate interoperability sustainability`);

  add(7, `ameliorate anachronistic antithetical circumvent corroborate deleterious
    delineate dichotomy disseminate eclectic elucidate equivocal esoteric
    extrapolate idiosyncratic immutable incongruous incontrovertible latent
    meticulous ostensibly paradoxical pragmatic propensity quintessential
    recalcitrant sporadic stringent substantive superfluous tacit tenuous
    unequivocal vindicate heterogeneity homogeneity ramifications
    epistemic heuristic orthogonal granular canonical endogenous exogenous`);

  add(8, `abstruse acerbic capricious cogent didactic fastidious iconoclast
    ineffable insidious laconic magnanimous mendacious obfuscate parsimonious
    perfunctory perspicacious recondite sagacious trenchant vacuous vicissitude
    polemical protean inchoate sycophantic`);

  add(9, `epistemological phenomenological hermeneutic ontological teleological
    phylogenetic psychometric heteroscedasticity metacognitive neuroplasticity
    deontological axiomatic jurisprudential`);

  const IRREGULAR = Object.freeze({
    went: 'go', gone: 'go', gave: 'give', given: 'give', took: 'take', taken: 'take',
    made: 'make', thought: 'think', brought: 'bring', bought: 'buy', taught: 'teach',
    wrote: 'write', written: 'write', spoke: 'speak', spoken: 'speak',
    chose: 'choose', chosen: 'choose', knew: 'know', known: 'know',
    saw: 'see', seen: 'see', came: 'come', became: 'become', begun: 'begin', began: 'begin'
  });

  const ACADEMIC_SUFFIX = /(?:ability|ibility|ization|isation|ological|ometric|escence|ential|ative|atory|ivity|ality|istic|ously|iveness)$/;

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
    for (const c of candidates(raw)) if (Object.prototype.hasOwnProperty.call(LEVELS, c)) return c;
    return candidates(raw)[0] || raw.toLowerCase();
  }

  function contextOverride(lemma, sentence) {
    const s = String(sentence || '');
    if (lemma === 'address') {
      if (/\baddress(?:es|ed|ing)?\s+(?:the\s+)?(?:[a-z-]+\s+){0,2}(?:problem|issue|challenge|question|concern|gap|risk|need|inequality|cause|impact|shortcoming|barrier)s?\b/i.test(s)) {
        return { level: 5, reason: 'sense:deal-with-problem' };
      }
      return { level: 3, reason: 'common-sense' };
    }
    if (lemma === 'pose') {
      if (/\bpose(?:s|d|ing)?\s+(?:a\s+|an\s+|the\s+)?(?:threat|risk|challenge|problem|question)s?\b/i.test(s)) {
        return { level: 5, reason: 'sense:present-risk' };
      }
    }
    return null;
  }

  function classifyToken(token, sentence) {
    const raw = String(token || '');
    const normalized = raw.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9'’:/._-]+$/g, '');
    if (!normalized || isUrl(normalized) || isNumber(normalized)) {
      return { level: 1, lemma: normalized.toLowerCase(), reason: isUrl(normalized) ? 'url' : 'nonlexical' };
    }

    const properLike = /^[A-Z][A-Za-z'-]*$/.test(normalized) && !/^I$/.test(normalized);
    const lemma = lemmaOf(normalized);
    const override = contextOverride(lemma, sentence);
    if (override) return { level: override.level, lemma, reason: override.reason };

    if (Object.prototype.hasOwnProperty.call(LEVELS, lemma)) {
      return { level: LEVELS[lemma], lemma, reason: 'lexicon' };
    }
    if (properLike) return { level: 2, lemma, reason: 'proper-name-conservative' };
    if (lemma.length >= 11 && ACADEMIC_SUFFIX.test(lemma)) {
      return { level: 5, lemma, reason: 'academic-morphology' };
    }
    return { level: 3, lemma, reason: 'unknown-conservative' };
  }

  function classifySentence(sentence) {
    const s = String(sentence || '');
    return tokenize(s).map(t => ({ ...t, ...classifyToken(t.text, s) }));
  }

  function markSource(sentence, classified) {
    const s = String(sentence || '');
    const items = Array.isArray(classified) ? classified.filter(x => x && x.level >= LEVEL_BOLD_MIN) : [];
    if (!items.length) return { text: s, ids: [] };
    let cursor = 0;
    let out = '';
    const ids = [];
    items.sort((a, b) => a.start - b.start).forEach((item) => {
      if (!(item.start >= cursor && item.end > item.start && item.end <= s.length)) return;
      const id = 'v' + ids.length;
      out += s.slice(cursor, item.start) + `⟦${id}⟧` + s.slice(item.start, item.end) + `⟦/${id}⟧`;
      ids.push(id);
      cursor = item.end;
    });
    out += s.slice(cursor);
    return { text: out, ids };
  }

  function parseMarkedTranslation(input) {
    const s = String(input || '');
    const marker = /⟦(\/)?(v\d+)⟧/g;
    const stack = [];
    const spans = [];
    let plain = '';
    let cursor = 0;
    let m;
    while ((m = marker.exec(s))) {
      plain += s.slice(cursor, m.index);
      const closing = !!m[1];
      const id = m[2];
      if (!closing) {
        if (stack.some(x => x.id === id)) return null;
        stack.push({ id, start: plain.length });
      } else {
        const top = stack.pop();
        if (!top || top.id !== id) return null;
        spans.push({ id, start: top.start, end: plain.length });
      }
      cursor = marker.lastIndex;
    }
    plain += s.slice(cursor);
    if (stack.length) return null;
    if (/⟦\/?v\d+⟧/.test(plain)) return null;
    spans.sort((a, b) => a.start - b.start);
    return { text: plain, spans };
  }

  return Object.freeze({ LEVEL_BOLD_MIN, tokenize, classifyToken, classifySentence, markSource, parseMarkedTranslation });
});
