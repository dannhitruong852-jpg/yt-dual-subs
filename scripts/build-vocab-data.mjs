#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const MANUAL_LEVELS = new Map();
function addManual(level, words) {
  for (const w of words.trim().split(/\s+/)) if (w) MANUAL_LEVELS.set(w, level);
}
addManual(4, `awkward version achieve affect approach attitude benefit challenge compare concern context decline establish evidence feature function increase issue maintain occur require respond strategy available average career claim factor impact individual involve information education experience important different possible relationship development environment government community technology understand question language business university difficult international organization conversation opportunity situation necessary especially actually probably usually together although however therefore`);
addManual(5, `consider despite determine essential estimate eventually frequent identify indicate influence likely major method obvious participate particular potential previous primary provide range reduce significant similar source specific standard suggest tend various abstract acknowledge adequate advocate allocate ambiguous arbitrary coherent competent comprehensive conventional crucial derive diminish ethical legitimate preliminary reluctant subtle sustain valid vulnerable compel controversial distort reinforce accumulate adjacent analogy anticipate apparent approximate attain attribute cease clarify coincide compile conceive concurrent constrain contradict convert correlate deduce demonstrate deviate discrete dispose diverse domestic eliminate emerge encounter enhance equivalent explicit facilitate finite flexible framework fundamental generate hypothesis illustrate imply incentive incidence inevitable infer inhibit initial inspect integrate intermediate interpret intervene isolate justify manipulate mature maximize minimize modify monitor objective obtain orient persist predominant prohibit promote proportion prospect refine regulate relevant rely restrict retain reveal revise rigid scope sector specify stable statistic substitute subsequent sufficient suspend transform transmit trend ultimate undergo uniform utilize visible welfare whereas acquire acquisition adverse adversity allegation alliance altitude ambassador amplify anxiety appeal applicant aspiration assault assemble assertion assumption assurance astonishing astronomy attendance attentive atypical audit authorize await`);
addManual(6, `exacerbate empirical intrinsic fluctuate mitigate paradigm plausible profound salient scrutinize undermine unprecedented ubiquitous nuanced reconcile inherent indispensable tentative robust pervasive viable articulate autonomous cumulative deteriorate differentiate discrepancy dynamic elaborate encompass entail exploit formulation hierarchy holistic impartial implicit impose induce innovative integral interaction invoke mechanism methodology offset persistent prerequisite qualitative quantitative rational resilient rigorous sophisticated subordinate synthesize trajectory transparent validate volatility marginalize convergence divergence susceptibility disproportionate interoperability sustainability`);
addManual(7, `ameliorate anachronistic antithetical circumvent corroborate deleterious delineate dichotomy disseminate eclectic elucidate equivocal esoteric extrapolate idiosyncratic immutable incongruous incontrovertible latent meticulous ostensibly paradoxical pragmatic propensity quintessential recalcitrant sporadic stringent substantive superfluous tacit tenuous unequivocal vindicate heterogeneity homogeneity ramifications epistemic heuristic orthogonal granular canonical endogenous exogenous`);
addManual(8, `abstruse acerbic capricious cogent didactic fastidious iconoclast ineffable insidious laconic magnanimous mendacious obfuscate parsimonious perfunctory perspicacious recondite sagacious trenchant vacuous vicissitude polemical protean inchoate sycophantic`);
addManual(9, `epistemological phenomenological hermeneutic ontological teleological phylogenetic psychometric heteroscedasticity metacognitive neuroplasticity deontological axiomatic jurisprudential`);

const MANUAL_ZH = Object.freeze({
  exacerbate: ['加剧', '恶化', '加重'], significant: ['显著', '重大', '重要', '有意义'],
  determine: ['确定', '决定', '判定'], essential: ['必要', '必不可少', '本质'],
  various: ['各种', '多种', '不同'], address: ['解决', '处理', '应对'], pose: ['构成', '造成', '提出']
});

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    out[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return out;
}
function validLemma(raw) {
  const s = String(raw || '').trim().toLowerCase();
  return /^[a-z][a-z'-]{0,31}$/.test(s) ? s : null;
}
function parseCsv(text) {
  const rows = []; let row = []; let field = ''; let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  return rows;
}
function parseCefr(file) {
  const levels = new Map();
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  const mapping = { A1: 1, A2: 2, B1: 3, B2: 5, C1: 6, C2: 8 };
  for (let i = 1; i < lines.length; i++) {
    const [headword, , cefr] = lines[i].split(';');
    const lemma = validLemma(headword); const level = mapping[String(cefr || '').trim().toUpperCase()];
    if (!lemma || !level || headword.includes(' ')) continue;
    const previous = levels.get(lemma); if (!previous || level < previous) levels.set(lemma, level);
  }
  return levels;
}
function chineseCandidates(raw) {
  const chunks = String(raw || '').split(/[\n;；,，/|]/);
  const out = [];
  for (const chunk of chunks) {
    const cleaned = chunk.replace(/^[a-z.\s]+/i, '').trim();
    const matches = cleaned.match(/[\p{Script=Han}]{2,8}/gu) || [];
    for (const candidate of matches) {
      if (!out.includes(candidate)) out.push(candidate);
      if (out.length >= 6) return out;
    }
  }
  return out;
}
function parseEcdict(file, levels, zh) {
  if (!file || !fs.existsSync(file)) return;
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  const header = rows.shift() || [];
  const wordAt = header.indexOf('word'), tagAt = header.indexOf('tag'), translationAt = header.indexOf('translation');
  for (const cols of rows) {
    const lemma = validLemma(cols[wordAt]); if (!lemma) continue;
    const tags = String(cols[tagAt] || '').toLowerCase();
    let metadataLevel = 0;
    if (/\b(cet6|ky)\b/.test(tags)) metadataLevel = 5;
    if (/\b(ielts|toefl)\b/.test(tags)) metadataLevel = 6;
    if (/\bgre\b/.test(tags)) metadataLevel = 7;
    if (metadataLevel) levels.set(lemma, Math.max(levels.get(lemma) || 0, metadataLevel));
    const finalLevel = Math.max(levels.get(lemma) || 0, MANUAL_LEVELS.get(lemma) || 0);
    if (finalLevel >= 5 && translationAt >= 0) {
      const candidates = chineseCandidates(cols[translationAt]);
      if (candidates.length) zh.set(lemma, candidates);
    }
  }
}
function emit(data) {
  return `// Generated by scripts/build-vocab-data.mjs. Do not hand-edit.\n(function(root){'use strict';root.YTDS_VOCAB_DATA=Object.freeze(${JSON.stringify(data)});})(typeof self!=='undefined'?self:globalThis);\n`;
}
function main() {
  const args = parseArgs(process.argv);
  if (!args.cefr || !args.out) { console.error('Usage: node scripts/build-vocab-data.mjs --cefr <word_list_cefr.csv> [--ecdict <ecdict.csv>] --out <vocab-data.js>'); process.exit(2); }
  const levels = parseCefr(args.cefr); const zh = new Map();
  parseEcdict(args.ecdict, levels, zh);
  for (const [lemma, level] of MANUAL_LEVELS) levels.set(lemma, level);
  for (const [lemma, candidates] of Object.entries(MANUAL_ZH)) zh.set(lemma, candidates);
  const levelObject = Object.fromEntries([...levels.entries()].sort(([a], [b]) => a.localeCompare(b)));
  const zhObject = Object.fromEntries([...zh.entries()].sort(([a], [b]) => a.localeCompare(b)));
  if (Object.keys(levelObject).length < 5000) throw new Error(`generated vocabulary too small: ${Object.keys(levelObject).length}`);
  if (args.ecdict && Object.keys(zhObject).length < 1000) throw new Error(`Chinese counterpart vocabulary too small: ${Object.keys(zhObject).length}`);
  fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
  fs.writeFileSync(args.out, emit({ version: 3, levels: levelObject, zh: zhObject }));
  console.log(`Generated ${Object.keys(levelObject).length} lemmas and ${Object.keys(zhObject).length} Chinese candidate entries`);
}
main();
