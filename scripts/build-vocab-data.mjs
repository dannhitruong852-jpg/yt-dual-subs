#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const MANUAL_LEVELS = new Map();
function addManual(level, words) {
  for (const w of words.trim().split(/\s+/)) if (w) MANUAL_LEVELS.set(w, level);
}
addManual(4, `awkward achieve affect approach attitude benefit challenge compare concern
context decline establish evidence feature function increase issue maintain occur require
respond strategy available average career claim factor impact individual involve information
education experience important different possible relationship development environment
government community technology understand question language business university difficult
international organization conversation opportunity situation necessary especially actually
probably usually together although however therefore version`);
addManual(5, `consider despite determine essential estimate eventually frequent identify
indicate influence likely major method obvious participate particular potential previous
primary provide range reduce significant similar source specific standard suggest tend various
abstract acknowledge adequate advocate allocate ambiguous arbitrary coherent competent
comprehensive conventional crucial derive diminish ethical legitimate preliminary reluctant
subtle sustain valid vulnerable compel controversial distort reinforce accumulate adjacent
analogy anticipate apparent approximate attain attribute cease clarify coincide compile
conceive concurrent constrain contradict convert correlate deduce demonstrate deviate discrete
dispose diverse domestic eliminate emerge encounter enhance equivalent explicit facilitate
finite flexible framework fundamental generate hypothesis illustrate imply incentive incidence
inevitable infer inhibit initial inspect integrate intermediate interpret intervene isolate
justify manipulate mature maximize minimize modify monitor objective obtain orient persist
predominant prohibit promote proportion prospect refine regulate relevant rely restrict retain
reveal revise rigid scope sector specify stable statistic substitute subsequent sufficient
suspend transform transmit trend ultimate undergo uniform utilize visible welfare whereas acquire
acquisition adverse adversity allegation alliance altitude ambassador amplify anxiety appeal
applicant aspiration assault assemble assertion assumption assurance astonishing astronomy
attendance attentive atypical audit authorize await`);
addManual(6, `exacerbate empirical intrinsic fluctuate mitigate paradigm plausible profound
salient scrutinize undermine unprecedented ubiquitous nuanced reconcile inherent indispensable
tentative robust pervasive viable articulate autonomous cumulative deteriorate differentiate
discrepancy dynamic elaborate encompass entail exploit formulation hierarchy holistic impartial
implicit impose induce innovative integral interaction invoke mechanism methodology offset
persistent prerequisite qualitative quantitative rational resilient rigorous sophisticated
subordinate synthesize trajectory transparent validate volatility marginalize convergence
divergence susceptibility disproportionate interoperability sustainability`);
addManual(7, `ameliorate anachronistic antithetical circumvent corroborate deleterious delineate
dichotomy disseminate eclectic elucidate equivocal esoteric extrapolate idiosyncratic immutable
incongruous incontrovertible latent meticulous ostensibly paradoxical pragmatic propensity
quintessential recalcitrant sporadic stringent substantive superfluous tacit tenuous unequivocal
vindicate heterogeneity homogeneity ramifications epistemic heuristic orthogonal granular
canonical endogenous exogenous`);
addManual(8, `abstruse acerbic capricious cogent didactic fastidious iconoclast ineffable
insidious laconic magnanimous mendacious obfuscate parsimonious perfunctory perspicacious
recondite sagacious trenchant vacuous vicissitude polemical protean inchoate sycophantic`);
addManual(9, `epistemological phenomenological hermeneutic ontological teleological phylogenetic
psychometric heteroscedasticity metacognitive neuroplasticity deontological axiomatic jurisprudential`);

const MANUAL_ZH = Object.freeze({
  exacerbate: ['加剧', '恶化', '加重'],
  significant: ['显著', '重大', '重要', '有意义'],
  determine: ['确定', '决定', '判定'],
  essential: ['必要', '必不可少', '本质'],
  various: ['各种', '多种', '不同'],
  address: ['解决', '处理', '应对'],
  pose: ['构成', '造成', '提出']
});

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    out[key] = value;
  }
  return out;
}

async function forEachDelimited(filePath, delimiter, onRow) {
  const stream = fs.createReadStream(filePath, { encoding: 'utf8', highWaterMark: 1 << 20 });
  let row = [];
  let field = '';
  let quoted = false;
  let pendingQuote = false;
  let header = null;

  const emitRow = () => {
    row.push(field);
    field = '';
    if (!row.some(x => x !== '')) { row = []; return; }
    if (!header) {
      header = row.map(x => x.trim());
    } else {
      const obj = Object.fromEntries(header.map((k, i) => [k, row[i] ?? '']));
      onRow(obj);
    }
    row = [];
  };

  for await (const rawChunk of stream) {
    let chunk = rawChunk;
    let start = 0;
    if (pendingQuote) {
      pendingQuote = false;
      if (chunk[0] === '"') {
        field += '"';
        start = 1;
      } else {
        quoted = false;
      }
    }
    for (let i = start; i < chunk.length; i++) {
      const ch = chunk[i];
      if (quoted) {
        if (ch === '"') {
          if (i + 1 >= chunk.length) { pendingQuote = true; continue; }
          if (chunk[i + 1] === '"') { field += '"'; i++; }
          else quoted = false;
        } else field += ch;
        continue;
      }
      if (ch === '"') { quoted = true; continue; }
      if (ch === delimiter) { row.push(field); field = ''; continue; }
      if (ch === '\r') continue;
      if (ch === '\n') { emitRow(); continue; }
      field += ch;
    }
  }
  if (pendingQuote) { pendingQuote = false; quoted = false; }
  if (field || row.length) emitRow();
  if (quoted) throw new Error(`unterminated quoted field in ${filePath}`);
}

function validLemma(raw) {
  const s = String(raw || '').trim();
  if (!s || s !== s.toLowerCase()) return null;
  if (!/^[a-z][a-z'-]*$/.test(s)) return null;
  if (s.length > 32) return null;
  return s;
}

function exchangeLemma(word, exchange) {
  const base = String(exchange || '').split('/').map(x => x.trim()).find(x => x.startsWith('0:'));
  return validLemma(base ? base.slice(2) : word);
}

function positiveRank(v) {
  const n = Number.parseInt(String(v || '').trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function cefrNumber(v) {
  const s = String(v || '').trim().toUpperCase();
  return ({ A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 })[s] || 0;
}

function examLevel(tags) {
  let level = 0;
  if (tags.has('zk')) level = Math.max(level, 2);
  if (tags.has('gk')) level = Math.max(level, 3);
  if (tags.has('cet4')) level = Math.max(level, 4);
  if (tags.has('cet6') || tags.has('ky')) level = Math.max(level, 5);
  if (tags.has('ielts') || tags.has('toefl')) level = Math.max(level, 6);
  if (tags.has('gre')) level = Math.max(level, 7);
  return level;
}

function frequencyLevel(rank) {
  if (!rank) return 0;
  if (rank <= 2000) return 1;
  if (rank <= 5000) return 2;
  if (rank <= 9000) return 3;
  if (rank <= 14000) return 4;
  if (rank <= 22000) return 5;
  if (rank <= 32000) return 6;
  if (rank <= 45000) return 7;
  return 8;
}

export function levelFromSignals({ lemma, cefr = 0, tags = new Set(), nativeRank = 0 }) {
  if (MANUAL_LEVELS.has(lemma)) return MANUAL_LEVELS.get(lemma);
  let level = 0;
  if (cefr) level = ({ 1: 1, 2: 2, 3: 3, 4: 4, 5: 6, 6: 8 })[cefr] || 0;
  level = Math.max(level, examLevel(tags));
  const freqLevel = frequencyLevel(nativeRank);
  if (freqLevel) {
    if (!level) level = freqLevel;
    else if (level === 4 && nativeRank > 9000) level = 5;
    else if (level >= 6 && nativeRank > 45000) level = Math.min(8, level + 1);
  }
  if (nativeRank && nativeRank <= 2500 && level > 4) level = 4;
  else if (nativeRank && nativeRank <= 5000 && level > 5) level = 5;
  return Math.max(1, Math.min(9, level || 3));
}

const ZH_STOP = new Set(['网络', '人名', '英语', '美国', '英国', '一种', '一些', '某种', '某些', '东西', '事情', '表示', '用于', '以及', '或者']);
export function sanitizeChineseCandidates(values) {
  const out = [];
  const seen = new Set();
  const add = raw => {
    let s = String(raw || '').trim().replace(/^[的地得]+|[的地得了]+$/g, '');
    if (s.startsWith('使得') && s.length > 4) s = s.slice(2);
    else if (s.startsWith('使') && s.length > 2) s = s.slice(1);
    if (!/^[\p{Script=Han}]{2,6}$/u.test(s) || ZH_STOP.has(s) || seen.has(s)) return;
    seen.add(s); out.push(s);
  };
  for (const value of values || []) {
    const cleaned = String(value || '')
      .replace(/\[网络\][^\\\n]*/g, ' ')
      .replace(/(?:^|[\\\n;；,，])\s*(?:n|v|vt|vi|adj|adv|prep|conj|pron|num|art)\.?\s*/gi, ' ');
    const matches = cleaned.match(/[\p{Script=Han}]{2,8}/gu) || [];
    for (const m of matches) {
      if (m.length <= 6) add(m);
      if (m.startsWith('使') && m.length > 2 && m.length <= 7) add(m.slice(1));
      if (out.length >= 6) return out;
    }
  }
  return out.slice(0, 6);
}

function mergeManualZh(lemma, candidates) {
  return sanitizeChineseCandidates([...(MANUAL_ZH[lemma] || []), ...(candidates || [])]);
}

async function buildData({ ecdictPath, cefrPath }) {
  const records = new Map();
  const get = lemma => {
    if (!records.has(lemma)) records.set(lemma, { lemma, tags: new Set(), bnc: 0, frq: 0, cefr: 0, translations: [] });
    return records.get(lemma);
  };

  if (ecdictPath) {
    await forEachDelimited(ecdictPath, ',', row => {
      const lemma = exchangeLemma(row.word, row.exchange);
      if (!lemma) return;
      const tags = String(row.tag || '').toLowerCase().split(/\s+/).filter(Boolean);
      const bnc = positiveRank(row.bnc), frq = positiveRank(row.frq);
      if (!MANUAL_LEVELS.has(lemma) && !MANUAL_ZH[lemma] && !tags.length && !bnc && !frq) return;
      const rec = get(lemma);
      for (const tag of tags) rec.tags.add(tag);
      if (bnc && (!rec.bnc || bnc < rec.bnc)) rec.bnc = bnc;
      if (frq && (!rec.frq || frq < rec.frq)) rec.frq = frq;
      if (row.translation && rec.translations.length < 4) rec.translations.push(row.translation);
    });
  }

  if (cefrPath) {
    await forEachDelimited(cefrPath, ';', row => {
      const lemma = validLemma(row.headword);
      if (!lemma) return;
      const rec = get(lemma);
      const n = cefrNumber(row.CEFR);
      if (n && (!rec.cefr || n < rec.cefr)) rec.cefr = n;
    });
  }

  for (const lemma of MANUAL_LEVELS.keys()) get(lemma);
  for (const lemma of Object.keys(MANUAL_ZH)) get(lemma);

  const candidates = [];
  for (const rec of records.values()) {
    const ranks = [rec.frq, rec.bnc].filter(Boolean);
    const nativeRank = ranks.length ? Math.min(...ranks) : 0;
    const signalled = rec.cefr || rec.tags.size || nativeRank || MANUAL_LEVELS.has(rec.lemma);
    if (!signalled) continue;
    if (!MANUAL_LEVELS.has(rec.lemma) && !rec.cefr && !rec.tags.size && (!nativeRank || nativeRank > 45000)) continue;
    const level = levelFromSignals({ lemma: rec.lemma, cefr: rec.cefr, tags: rec.tags, nativeRank });
    candidates.push({ ...rec, nativeRank, level });
  }

  candidates.sort((a, b) => {
    const ar = a.nativeRank || 999999, br = b.nativeRank || 999999;
    return ar - br || a.lemma.localeCompare(b.lemma);
  });

  const keep = new Map();
  for (const rec of candidates) {
    if (rec.cefr || rec.tags.size || MANUAL_LEVELS.has(rec.lemma) || keep.size < 25000) keep.set(rec.lemma, rec);
  }

  const levels = {};
  const zh = {};
  for (const lemma of [...keep.keys()].sort()) {
    const rec = keep.get(lemma);
    levels[lemma] = rec.level;
    if (rec.level >= 5 || MANUAL_ZH[lemma]) {
      const z = mergeManualZh(lemma, sanitizeChineseCandidates(rec.translations));
      if (z.length) zh[lemma] = z;
    }
  }
  for (const lemma of Object.keys(MANUAL_ZH).sort()) {
    const z = mergeManualZh(lemma, zh[lemma] || []);
    if (z.length) zh[lemma] = z;
  }
  return { version: 2, levels, zh };
}

function emit(data) {
  const json = JSON.stringify(data);
  return `// Generated by scripts/build-vocab-data.mjs. Do not hand-edit.\n` +
    `(function(root){'use strict';root.YTDS_VOCAB_DATA=Object.freeze(${json});})(typeof self!=='undefined'?self:globalThis);\n`;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.ecdict || !args.cefr || !args.out) {
    console.error('Usage: node scripts/build-vocab-data.mjs --ecdict <ecdict.csv> --cefr <word_list_cefr.csv> --out <vocab-data.js>');
    process.exit(2);
  }
  const data = await buildData({ ecdictPath: args.ecdict, cefrPath: args.cefr });
  if (Object.keys(data.levels).length < 5000) throw new Error(`generated vocabulary too small: ${Object.keys(data.levels).length}`);
  fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
  fs.writeFileSync(args.out, emit(data));
  console.log(`Generated ${Object.keys(data.levels).length} lemmas and ${Object.keys(data.zh).length} Chinese candidate entries`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch(err => { console.error(err && err.stack || err); process.exit(1); });
}
