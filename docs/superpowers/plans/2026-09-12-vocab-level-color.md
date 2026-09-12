# Level 5+ Vocabulary Color Highlighting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unstable prototype bolding system with zero-extra-request Level-5+ color highlighting for English subtitles and conservatively matched Chinese counterparts, with independent user-configurable colors.

**Architecture:** Move vocabulary highlighting into the existing `content.js` render path so it runs exactly when subtitle text is rendered, rather than through a second `MutationObserver`. Keep classification and Chinese counterpart matching fully local. Ship a generated compact lexical dataset for broad coverage, preserve sense-aware overrides, and make all vocabulary presentation settings live `chrome.storage.sync` values that never trigger a translation re-request.

**Tech Stack:** Manifest V3 JavaScript, DOM APIs, `chrome.storage.sync`, Node 22 regression tests, GitHub Actions packaging, Chrome/Safari shared extension source.

**Spec:** `docs/superpowers/specs/2026-09-12-vocab-level-color-design.md`

## Global Constraints

- Highlight threshold is fixed at project Level 5-9; Level 1-4 keeps the normal subtitle color.
- `vocabHighlightEnabled` defaults to `true`.
- `vocabOrigColor` defaults to `#FFD54F`.
- `vocabTransColor` defaults to `#80DEEA`.
- Vocabulary highlighting creates **zero additional translation requests**.
- Vocabulary code must never call Google Translate, YouTube `tlang`, BYO translation, or `chrome.runtime.sendMessage({ type: "translate" ... })`.
- No vocabulary subsystem may observe and rewrite the same subtitle subtree through `MutationObserver`.
- Rendering may change only text color; it must not change font weight, size, family, background, stroke, line order, or subtitle position.
- Subtitle strings must never be rendered through `innerHTML`; use text nodes and controlled `<span>` elements.
- Chinese matching is local and conservative: uncertain or ambiguous matches remain uncolored.
- TTS, copy, selection, SRT/export, and translation caches remain plain-text behavior.
- Chrome and Safari package the same classifier/data/rendering implementation.
- The uploaded postgraduate vocabulary PDF remains a calibration source only and is not redistributed.
- Use TDD for every behavior change.

---

## File Structure

**Create**
- `vocab-data.js` — generated compact runtime metadata: lemma levels plus Level-5+ Chinese surface candidates.
- `scripts/build-vocab-data.mjs` — deterministic generator/validator for checked-in derived vocabulary metadata.
- `tests/vocab-data.test.js` — coverage, level-boundary, candidate-shape, and source-size regressions.
- `tests/vocab-color-render.test.js` — pure renderer/range/matching behavior tests.
- `tests/vocab-color-settings.test.js` — popup/settings migration and no-recue contract tests.

**Modify**
- `vocab-levels.js` — consume generated data; keep tokenization, lemmatization, context overrides, and expose local Chinese matching helpers; remove marker-translation helpers from the runtime contract.
- `manifest.json` — load `vocab-data.js` before `vocab-levels.js` and `content.js`; stop loading obsolete `vocab-runtime.js` once direct rendering is live.
- `content.js` — add highlight settings, direct structured rendering for English/Chinese, live repaint on color/enable changes, and no-recue behavior for vocabulary settings.
- `popup.html` — add highlight switch plus two color inputs in the Translation card.
- `popup.js` — add defaults, state binding, persistence, migration from prototype key, and deterministic preview.
- `popup.css` — compact color-row styling using existing popup visual language.
- `_locales/en/messages.json` — English labels.
- `_locales/zh_CN/messages.json` — simplified-Chinese labels.
- `_locales/zh_TW/messages.json` — traditional-Chinese labels.
- `skins.js` — remove the prototype dynamic `vocabBoldEnabled` injector; no vocabulary feature logic remains here.
- `tests/browser-packages.test.mjs` — assert generated data/classifier are packaged and obsolete runtime is not.
- `.github/workflows/build-browser-packages.yml` — run the new vocabulary regressions.
- `THIRD_PARTY_VOCABULARY.md` — update actual derived sources, licenses, and transformation notes.

**Delete after migration is proven**
- `vocab-runtime.js` — obsolete observer/network prototype.
- `tests/vocab-runtime-static.test.js` — replaced by direct-render/no-network tests.
- `tests/vocab-bold-toggle.test.js` — replaced by color-settings tests.
- `tests/vocab-alignment.test.js` — marker alignment is no longer the architecture.

---

### Task 1: Replace the hand list with a broad local vocabulary dataset

**Files:**
- Create: `vocab-data.js`
- Create: `scripts/build-vocab-data.mjs`
- Create: `tests/vocab-data.test.js`
- Modify: `vocab-levels.js`
- Modify: `THIRD_PARTY_VOCABULARY.md`

**Interfaces:**
- Produces global `self.YTDS_VOCAB_DATA` from `vocab-data.js`.
- `YTDS_VOCAB_DATA.levels` is a plain object `{ lemma: level }` where `level` is integer 1-9.
- `YTDS_VOCAB_DATA.zh` is a plain object `{ lemma: [candidate1, candidate2, ...] }` only for Level-5+ lemmas with safe short Chinese candidates.
- `self.YTDS_VOCAB` continues to expose:
  - `LEVEL_HIGHLIGHT_MIN: 5`
  - `tokenize(sentence)`
  - `classifyToken(token, sentence)`
  - `classifySentence(sentence)`
  - `matchChineseCounterparts(sourceText, translatedText, classified)`

- [ ] **Step 1: Write the failing data/coverage test**

Create `tests/vocab-data.test.js`:

```js
const assert = require('assert');
global.self = global;
require('../vocab-data.js');
const V = require('../vocab-levels.js');

const D = global.YTDS_VOCAB_DATA;
assert.ok(D && D.levels && D.zh);
assert.strictEqual(V.LEVEL_HIGHLIGHT_MIN, 5);

// The final system must be materially larger than the prototype hand list.
assert.ok(Object.keys(D.levels).length >= 5000,
  'runtime vocabulary data should contain at least 5000 classified lemmas');

for (const [lemma, level] of Object.entries(D.levels)) {
  assert.ok(/^[a-z][a-z'-]*$/.test(lemma), `bad lemma: ${lemma}`);
  assert.ok(Number.isInteger(level) && level >= 1 && level <= 9,
    `bad level for ${lemma}`);
}

assert.ok(V.classifyToken('awkward', 'That was awkward.').level < 5);
assert.ok(V.classifyToken('determine', 'We must determine the cause.').level >= 5);
assert.ok(V.classifyToken('essential', 'This is essential.').level >= 5);
assert.ok(V.classifyToken('significant', 'The effect was significant.').level >= 5);
assert.ok(V.classifyToken('various', 'There are various reasons.').level >= 5);
assert.ok(V.classifyToken('address', 'My address is on the form.').level < 5);
assert.ok(V.classifyToken('address', 'We must address the structural problem.').level >= 5);
assert.ok(V.classifyToken('exacerbate', 'This may exacerbate inequality.').level >= 5);
assert.strictEqual(V.classifyToken('exacerbated', 'It exacerbated the problem.').lemma, 'exacerbate');

assert.ok(Array.isArray(D.zh.exacerbate) && D.zh.exacerbate.includes('加剧'));
assert.ok(Array.isArray(D.zh.significant) && D.zh.significant.length > 0);

console.log('PASS vocabulary data coverage');
```

- [ ] **Step 2: Run the test and confirm RED**

Run:

```bash
node tests/vocab-data.test.js
```

Expected: FAIL because `vocab-data.js` does not exist / prototype coverage is below 5000 lemmas.

- [ ] **Step 3: Add deterministic generated-data shape**

Create `vocab-data.js` in this exact runtime shape:

```js
(function (root) {
  'use strict';
  root.YTDS_VOCAB_DATA = Object.freeze({
    version: 1,
    levels: Object.freeze({
      // generated lowercase lemma -> integer 1..9
    }),
    zh: Object.freeze({
      // Level-5+ lemma -> short Chinese surface candidates
    })
  });
})(typeof self !== 'undefined' ? self : globalThis);
```

The checked-in generated file must contain at least 5000 classified lemmas. Keep only level metadata and short candidate strings; do not bundle source dictionary definitions, examples, or long translations.

- [ ] **Step 4: Add the generator/validator**

Create `scripts/build-vocab-data.mjs` so it can consume local source exports and write the exact deterministic `vocab-data.js` structure. The CLI must be explicit and offline:

```bash
node scripts/build-vocab-data.mjs \
  --ecdict ./vendor/ecdict.csv \
  --cefr ./vendor/cefr.csv \
  --frequency ./vendor/frequency.csv \
  --out ./vocab-data.js
```

The script must:

```js
function levelFromSignals({ cefr, cet, postgraduate, frequencyRank, register }) {
  // A1/A2/B1 -> <=3; lower-B2/high-frequency -> 4;
  // upper-B2/CET-6-core friction -> 5; C1 -> 6/7; C2/rare -> 8/9.
}

function sanitizeChineseCandidates(values) {
  return [...new Set(values)]
    .map(s => s.trim())
    .filter(s => /^[\p{Script=Han}]{1,6}$/u.test(s))
    .slice(0, 6);
}
```

The script must sort object keys before emission so identical sources create byte-stable output.

- [ ] **Step 5: Refactor classifier to consume generated data**

In `vocab-levels.js`, replace the embedded `LEVELS` hand table with:

```js
const DATA = (typeof self !== 'undefined' && self.YTDS_VOCAB_DATA) ||
             (typeof globalThis !== 'undefined' && globalThis.YTDS_VOCAB_DATA) ||
             { levels: Object.create(null), zh: Object.create(null) };
const LEVEL_HIGHLIGHT_MIN = 5;
```

Keep deterministic inflection handling and context overrides. Unknown handling must be conservative:

```js
if (properLike || isUrl(normalized) || isNumber(normalized)) return lowLevelResult;
if (lemma.length >= 11 && ACADEMIC_SUFFIX.test(lemma)) return { level: 5, ... };
return { level: 3, lemma, reason: 'unknown-conservative' };
```

Do not use absence from the dataset as evidence for Level 8/9.

- [ ] **Step 6: Update attribution**

In `THIRD_PARTY_VOCABULARY.md`, list only sources actually used in the checked-in generation, their licenses, input fields, and what was discarded. Explicitly state that the uploaded postgraduate vocabulary PDF is calibration-only and not redistributed.

- [ ] **Step 7: Run data/classifier tests GREEN**

Run:

```bash
node tests/vocab-data.test.js
node tests/vocab-levels.test.js
node --check vocab-data.js
node --check vocab-levels.js
```

Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add vocab-data.js vocab-levels.js scripts/build-vocab-data.mjs tests/vocab-data.test.js tests/vocab-levels.test.js THIRD_PARTY_VOCABULARY.md
git commit -m "Expand local vocabulary classification data"
```

---

### Task 2: Replace bold settings with highlight settings and two color controls

**Files:**
- Modify: `popup.html`
- Modify: `popup.js`
- Modify: `popup.css`
- Modify: `skins.js`
- Modify: `_locales/en/messages.json`
- Modify: `_locales/zh_CN/messages.json`
- Modify: `_locales/zh_TW/messages.json`
- Create: `tests/vocab-color-settings.test.js`

**Interfaces:**
- Produces sync settings:
  - `vocabHighlightEnabled: boolean = true`
  - `vocabOrigColor: string = '#FFD54F'`
  - `vocabTransColor: string = '#80DEEA'`
- Prototype migration input: `vocabBoldEnabled` only when `vocabHighlightEnabled` is absent.

- [ ] **Step 1: Write failing settings/UI test**

Create `tests/vocab-color-settings.test.js`:

```js
const assert = require('assert');
const fs = require('fs');

const html = fs.readFileSync('popup.html', 'utf8');
const popup = fs.readFileSync('popup.js', 'utf8');
const content = fs.readFileSync('content.js', 'utf8');
const skins = fs.readFileSync('skins.js', 'utf8');

assert.match(html, /id="vocabHighlightEnabled"/);
assert.match(html, /id="vocabOrigColor"[^>]*type="color"/);
assert.match(html, /id="vocabTransColor"[^>]*type="color"/);
assert.match(popup, /vocabHighlightEnabled:\s*true/);
assert.match(popup, /vocabOrigColor:\s*["']#FFD54F["']/i);
assert.match(popup, /vocabTransColor:\s*["']#80DEEA["']/i);
assert.match(content, /vocabHighlightEnabled:\s*true/);
assert.doesNotMatch(skins, /vocabBoldEnabled|高阶词汇加粗|Bold advanced vocabulary/);
assert.doesNotMatch(html, /vocabBoldEnabled/);

console.log('PASS vocabulary color settings');
```

- [ ] **Step 2: Run and confirm RED**

```bash
node tests/vocab-color-settings.test.js
```

Expected: FAIL because the popup still uses the prototype bold switch / has no color controls.

- [ ] **Step 3: Add popup controls directly in `popup.html`**

Immediately after the target-language row, add:

```html
<div class="row row-split">
  <label for="vocabHighlightEnabled" data-i18n="vocabHighlightLabel">高阶词汇标色</label>
  <label class="switch" data-i18n-title="vocabHighlightLabel">
    <input type="checkbox" id="vocabHighlightEnabled" />
    <span class="switch-track"><span class="switch-thumb"></span></span>
  </label>
</div>
<div class="row vocab-color-row" id="vocabColorRows">
  <label for="vocabOrigColor" data-i18n="vocabOrigColorLabel">英文高阶词颜色</label>
  <input type="color" id="vocabOrigColor" value="#FFD54F" />
  <label for="vocabTransColor" data-i18n="vocabTransColorLabel">中文对应词颜色</label>
  <input type="color" id="vocabTransColor" value="#80DEEA" />
</div>
```

- [ ] **Step 4: Remove prototype vocabulary injection from `skins.js`**

Delete the entire additive IIFE whose key is `vocabBoldEnabled`. `skins.js` returns to skin/position responsibilities only.

- [ ] **Step 5: Add settings defaults and persistence in `popup.js`**

Add:

```js
vocabHighlightEnabled: true,
vocabOrigColor: '#FFD54F',
vocabTransColor: '#80DEEA',
```

Bind controls from current state and persist through existing `setKey()`:

```js
$('vocabHighlightEnabled').checked = !!state.vocabHighlightEnabled;
$('vocabOrigColor').value = state.vocabOrigColor || '#FFD54F';
$('vocabTransColor').value = state.vocabTransColor || '#80DEEA';

$('vocabHighlightEnabled').addEventListener('change', e =>
  setKey('vocabHighlightEnabled', e.target.checked));
$('vocabOrigColor').addEventListener('input', e =>
  setKey('vocabOrigColor', e.target.value));
$('vocabTransColor').addEventListener('input', e =>
  setKey('vocabTransColor', e.target.value));
```

When initial storage lacks `vocabHighlightEnabled`, read the old prototype `vocabBoldEnabled` once and use its boolean as the initial enable value; do not keep the old key as source of truth.

- [ ] **Step 6: Make the preview deterministic**

Change the preview sample strings to:

```text
The policy may exacerbate inequality.
这项政策可能会加剧不平等。
```

Build the preview spans safely with `createTextNode()` and controlled spans. When enabled, `exacerbate` uses `vocabOrigColor` and `加剧` uses `vocabTransColor`; when disabled, preview uses ordinary original/translation colors.

- [ ] **Step 7: Add locale messages**

Add these keys in English, zh_CN, and zh_TW:

```json
"vocabHighlightLabel": { "message": "Highlight advanced vocabulary" },
"vocabOrigColorLabel": { "message": "English advanced-word color" },
"vocabTransColorLabel": { "message": "Chinese counterpart color" }
```

Use `高阶词汇标色 / 英文高阶词颜色 / 中文对应词颜色` in zh_CN and the corresponding traditional forms in zh_TW.

- [ ] **Step 8: Run GREEN**

```bash
node tests/vocab-color-settings.test.js
node --check popup.js
node --check skins.js
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add popup.html popup.js popup.css skins.js _locales/en/messages.json _locales/zh_CN/messages.json _locales/zh_TW/messages.json tests/vocab-color-settings.test.js
git commit -m "Replace vocabulary bolding with color controls"
```

---

### Task 3: Render English Level-5+ colors directly from `content.js`

**Files:**
- Modify: `content.js`
- Create: `tests/vocab-color-render.test.js`

**Interfaces:**
- Consumes `self.YTDS_VOCAB.classifySentence(text)`.
- Produces `renderVocabularyRanges(el, text, ranges, color)` with identical `textContent` to `text`.
- `setOriginal(text)` remains the only normal owner of original-line updates.

- [ ] **Step 1: Write failing renderer tests**

Create `tests/vocab-color-render.test.js` with a small pure helper fixture exported under Node test mode or factored into `vocab-levels.js`:

```js
const assert = require('assert');
global.self = global;
require('../vocab-data.js');
const V = require('../vocab-levels.js');

const line = 'The policy may exacerbate inequality.';
const advanced = V.classifySentence(line).filter(x => x.level >= 5);
assert.ok(advanced.some(x => x.text.toLowerCase() === 'exacerbate'));
assert.ok(!advanced.some(x => x.text.toLowerCase() === 'the'));

const content = require('fs').readFileSync('content.js', 'utf8');
assert.match(content, /vocabHighlightEnabled:\s*true/);
assert.match(content, /vocabOrigColor:\s*["']#FFD54F["']/i);
assert.match(content, /renderVocabularyRanges/);
assert.match(content, /createTextNode/);
assert.doesNotMatch(content, /ytds-vocab-bold/);

console.log('PASS vocabulary color render contract');
```

- [ ] **Step 2: Run RED**

```bash
node tests/vocab-color-render.test.js
```

Expected: FAIL on missing color settings/direct renderer.

- [ ] **Step 3: Add content defaults**

In `DEFAULTS` add:

```js
vocabHighlightEnabled: true,
vocabOrigColor: '#FFD54F',
vocabTransColor: '#80DEEA',
```

Do **not** add these keys to `RECUE_KEYS`.

- [ ] **Step 4: Add the safe direct renderer**

Add:

```js
function renderVocabularyRanges(el, text, ranges, color) {
  const s = String(text || '');
  const sorted = ranges.slice().sort((a, b) => a.start - b.start);
  const frag = document.createDocumentFragment();
  let cursor = 0;
  for (const r of sorted) {
    if (!r || r.start < cursor || r.end <= r.start || r.end > s.length) continue;
    if (r.start > cursor) frag.appendChild(document.createTextNode(s.slice(cursor, r.start)));
    const span = document.createElement('span');
    span.className = 'ytds-vocab-highlight';
    span.style.color = color;
    span.textContent = s.slice(r.start, r.end);
    frag.appendChild(span);
    cursor = r.end;
  }
  if (cursor < s.length) frag.appendChild(document.createTextNode(s.slice(cursor)));
  el.replaceChildren(frag);
}
```

- [ ] **Step 5: Integrate into `setOriginal()` without changing selection semantics**

Preserve the existing `selectionInside(origEl)` / `pendingOrig` logic. After the hold check:

```js
pendingOrig = null;
if (!settings.vocabHighlightEnabled || !self.YTDS_VOCAB) {
  origEl.textContent = next;
} else {
  const ranges = self.YTDS_VOCAB.classifySentence(next)
    .filter(x => x.level >= self.YTDS_VOCAB.LEVEL_HIGHLIGHT_MIN);
  if (ranges.length) renderVocabularyRanges(origEl, next, ranges, settings.vocabOrigColor);
  else origEl.textContent = next;
}
updateEmptyState();
```

No `MutationObserver` is introduced.

- [ ] **Step 6: Live repaint on vocabulary setting changes without re-cue**

In `onStorageChanged`, after normal settings merge, detect any of:

```js
'vocabHighlightEnabled' in changes ||
'vocabOrigColor' in changes ||
'vocabTransColor' in changes
```

and force only the active subtitle lines to repaint from their current plain strings. Do not call `sendConfig()` for these keys and do not clear translation caches.

- [ ] **Step 7: Run GREEN plus existing position regression**

```bash
node tests/vocab-color-render.test.js
node tests/vocab-data.test.js
node tests/independent-position.test.js
node --check content.js
```

Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add content.js tests/vocab-color-render.test.js
git commit -m "Render advanced English vocabulary colors directly"
```

---

### Task 4: Add conservative local Chinese counterpart coloring

**Files:**
- Modify: `vocab-levels.js`
- Modify: `content.js`
- Modify: `tests/vocab-color-render.test.js`

**Interfaces:**
- `matchChineseCounterparts(sourceText, translatedText, classified)` returns ranges:

```js
[{ start, end, lemma, surface }]
```

- It consumes only already-rendered/source translation strings and local `YTDS_VOCAB_DATA.zh` candidates.

- [ ] **Step 1: Write failing counterpart-matching tests**

Add to `tests/vocab-color-render.test.js`:

```js
const src = 'The policy may exacerbate inequality.';
const cls = V.classifySentence(src);
assert.deepStrictEqual(
  V.matchChineseCounterparts(src, '这项政策可能会加剧不平等。', cls),
  [{ start: 7, end: 9, lemma: 'exacerbate', surface: '加剧' }]
);

// Two occurrences are ambiguous: fail closed rather than color both.
assert.deepStrictEqual(
  V.matchChineseCounterparts(src, '加剧可能导致进一步加剧。', cls),
  []
);

// No candidate: English still colors; Chinese remains plain.
assert.deepStrictEqual(
  V.matchChineseCounterparts(src, '这项政策可能让问题变得更严重。', cls),
  []
);
```

- [ ] **Step 2: Run RED**

```bash
node tests/vocab-color-render.test.js
```

Expected: FAIL because `matchChineseCounterparts` is absent.

- [ ] **Step 3: Implement local conservative matcher**

In `vocab-levels.js`:

```js
function matchChineseCounterparts(sourceText, translatedText, classified) {
  const zhText = String(translatedText || '');
  const advanced = (classified || classifySentence(sourceText))
    .filter(x => x.level >= LEVEL_HIGHLIGHT_MIN);
  const claimed = [];
  const out = [];

  for (const item of advanced) {
    const candidates = (DATA.zh && DATA.zh[item.lemma]) || [];
    const hits = [];
    for (const surface of candidates) {
      let from = 0;
      while (surface && from <= zhText.length) {
        const at = zhText.indexOf(surface, from);
        if (at < 0) break;
        hits.push({ start: at, end: at + surface.length, lemma: item.lemma, surface });
        from = at + surface.length;
      }
    }
    const unique = hits.filter((h, i, a) =>
      a.findIndex(x => x.start === h.start && x.end === h.end) === i);
    if (unique.length !== 1) continue;
    const hit = unique[0];
    if (claimed.some(r => hit.start < r.end && hit.end > r.start)) continue;
    claimed.push(hit);
    out.push(hit);
  }
  return out.sort((a, b) => a.start - b.start);
}
```

- [ ] **Step 4: Integrate Chinese coloring into existing `setTranslation()`**

Keep `lastTransSource`, pending selection, and plain `next` exactly as today. Determine the currently active English source from the existing `forSource` argument / active cue source. Then:

```js
const classified = settings.vocabHighlightEnabled && self.YTDS_VOCAB
  ? self.YTDS_VOCAB.classifySentence(source)
  : [];
const ranges = settings.vocabHighlightEnabled && self.YTDS_VOCAB
  ? self.YTDS_VOCAB.matchChineseCounterparts(source, next, classified)
  : [];

if (ranges.length) renderVocabularyRanges(transEl, next, ranges, settings.vocabTransColor);
else transEl.textContent = next;
```

Do not replace the Chinese text with a retranslation. Do not send any message to background code.

- [ ] **Step 5: Protect same-language/non-Chinese cases**

Only attempt Chinese candidate matching when the visible target language begins with `zh`. For any other target language, translation rendering remains plain unless a future language-specific matcher exists.

- [ ] **Step 6: Run GREEN**

```bash
node tests/vocab-color-render.test.js
node tests/vocab-data.test.js
node --check vocab-levels.js
node --check content.js
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add vocab-levels.js content.js tests/vocab-color-render.test.js
git commit -m "Color reliable Chinese vocabulary counterparts locally"
```

---

### Task 5: Remove the unstable prototype architecture and lock the zero-network invariant

**Files:**
- Modify: `manifest.json`
- Delete: `vocab-runtime.js`
- Delete: `tests/vocab-runtime-static.test.js`
- Delete: `tests/vocab-bold-toggle.test.js`
- Delete: `tests/vocab-alignment.test.js`
- Modify: `tests/vocab-color-settings.test.js`
- Modify: `tests/browser-packages.test.mjs`

**Interfaces:**
- Final content-script order includes `vocab-data.js`, `vocab-levels.js`, `content.js`, and existing position code.
- `vocab-runtime.js` is no longer shipped or executed.

- [ ] **Step 1: Extend failing stability/static test before deleting runtime**

Add assertions to `tests/vocab-color-settings.test.js`:

```js
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
const joined = manifest.content_scripts.flatMap(x => x.js || []).join('\n');
assert.match(joined, /vocab-data\.js/);
assert.match(joined, /vocab-levels\.js/);
assert.doesNotMatch(joined, /vocab-runtime\.js/);

for (const file of ['vocab-levels.js', 'content.js']) {
  const src = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(src,
    /chrome\.runtime\.sendMessage\(\s*\{\s*type:\s*["']translate["']/,
    `${file} vocabulary path must not create translation requests`);
}

assert.doesNotMatch(fs.readFileSync('content.js', 'utf8'),
  /new MutationObserver\([^)]*vocab/i);
```

- [ ] **Step 2: Run RED**

```bash
node tests/vocab-color-settings.test.js
```

Expected: FAIL while manifest still loads `vocab-runtime.js`.

- [ ] **Step 3: Update manifest order**

The document-idle content-script list must contain:

```json
["fonts.js", "vocab-data.js", "vocab-levels.js", "content.js", "independent-position.js"]
```

Remove `vocab-runtime.js`.

- [ ] **Step 4: Delete retired prototype files/tests**

Delete:

```text
vocab-runtime.js
tests/vocab-runtime-static.test.js
tests/vocab-bold-toggle.test.js
tests/vocab-alignment.test.js
```

Do not keep marker-translation code as dead fallback.

- [ ] **Step 5: Update browser-package regression**

In `tests/browser-packages.test.mjs`, assert for both Chrome and Safari output:

```js
await access(path.join(out, browser, 'vocab-data.js'));
await access(path.join(out, browser, 'vocab-levels.js'));
await assert.rejects(() => access(path.join(out, browser, 'vocab-runtime.js')));
```

- [ ] **Step 6: Run GREEN**

```bash
node tests/vocab-color-settings.test.js
node tests/browser-packages.test.mjs
node --check content.js
node --check vocab-levels.js
node --check vocab-data.js
```

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add -A manifest.json vocab-runtime.js tests vocab-data.js vocab-levels.js
git commit -m "Remove vocabulary alignment request prototype"
```

---

### Task 6: Add engine-switch stability regression and full CI gate

**Files:**
- Create: `tests/vocab-engine-switch.test.js`
- Modify: `.github/workflows/build-browser-packages.yml`

**Interfaces:**
- Proves vocabulary settings are not in `RECUE_KEYS`.
- Proves repeated vocabulary toggle/color changes are presentation-only.
- Proves vocabulary source contains no separate translation request path.

- [ ] **Step 1: Write failing engine-switch/static regression**

Create `tests/vocab-engine-switch.test.js`:

```js
const assert = require('assert');
const fs = require('fs');
const content = fs.readFileSync('content.js', 'utf8');

const recue = content.match(/const RECUE_KEYS = new Set\(\[([\s\S]*?)\]\);/);
assert.ok(recue, 'RECUE_KEYS must remain discoverable');
for (const key of ['vocabHighlightEnabled', 'vocabOrigColor', 'vocabTransColor']) {
  assert.ok(!recue[1].includes(key), `${key} must not re-request cues/translations`);
}

assert.match(content, /renderVocabularyRanges/);
assert.doesNotMatch(content,
  /vocab[\s\S]{0,500}sendMessage\([\s\S]{0,100}type:\s*["']translate["']/i);

console.log('PASS vocabulary engine-switch stability contract');
```

- [ ] **Step 2: Run RED/GREEN as appropriate**

```bash
node tests/vocab-engine-switch.test.js
```

Expected after Tasks 3-5: PASS. If it fails, fix only the violated invariant before proceeding.

- [ ] **Step 3: Add all vocabulary tests to CI**

The regression step in `.github/workflows/build-browser-packages.yml` must run:

```bash
node tests/independent-position.test.js
node tests/vocab-data.test.js
node tests/vocab-levels.test.js
node tests/vocab-color-settings.test.js
node tests/vocab-color-render.test.js
node tests/vocab-engine-switch.test.js
node tests/browser-packages.test.mjs
```

Syntax checks must include:

```bash
node --check vocab-data.js
node --check vocab-levels.js
node --check content.js
node --check popup.js
```

- [ ] **Step 4: Run complete local regression set**

Run exactly the same commands as CI. Expected: every test and syntax check PASS.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/build-browser-packages.yml tests/vocab-engine-switch.test.js
git commit -m "Gate vocabulary colors on stability regressions"
```

---

### Task 7: Package and perform real YouTube acceptance testing

**Files:**
- No production code unless an acceptance failure is reproduced with a regression test first.

**Interfaces:**
- Produces installable Chrome/Safari packages from GitHub Actions.

- [ ] **Step 1: Push the feature branch and wait for Actions**

Verify the PR workflow has:

```text
Chrome and Safari ZIPs: success
Safari Xcode projects: success
```

Do not claim completion while either job is pending or failed.

- [ ] **Step 2: Download the new Chrome package and install it fresh**

Remove/disable the previous prototype package before loading the new unpacked build so stale content scripts cannot remain in the open YouTube tab. Reload the YouTube page after extension replacement.

- [ ] **Step 3: Verify deterministic preview**

In the popup:

- `exacerbate` visibly uses `vocabOrigColor`.
- `加剧` visibly uses `vocabTransColor`.
- changing either color updates the preview live.
- disabling `高阶词汇标色` restores ordinary preview colors immediately.

- [ ] **Step 4: Verify real English highlighting**

On a video containing representative Level-5+ terms, verify at minimum:

```text
determine
essential
significant
various
exacerbate
```

highlight, while ordinary `awkward` usage remains normal.

- [ ] **Step 5: Verify Chinese local mapping behavior**

Find at least one sentence where a generated candidate appears exactly once and confirm the matching Chinese span colors. Also verify a sentence with no reliable candidate leaves Chinese plain while English still colors.

- [ ] **Step 6: Stress engine switching**

While the video keeps playing, switch repeatedly among:

```text
Auto -> YouTube -> Google -> Auto -> Google -> YouTube
```

Repeat at least 10 cycles. Acceptance conditions:

- video remains responsive;
- subtitles continue advancing;
- no page crash;
- no vocabulary-generated rate-limit increase;
- changing the vocabulary enable switch/colors never triggers a translation warning by itself.

- [ ] **Step 7: Verify no regressions**

Confirm:

- Chinese remains above English per the existing fork behavior.
- independent position controls still work.
- copied subtitle text contains no markup.
- TTS/export text contains no color metadata.
- Chrome package works; Safari packaging remains green in Actions.

- [ ] **Step 8: Only after real acceptance, update PR description and prepare merge**

The PR description must describe the final architecture: Level-5+ color highlighting, local Chinese candidate matching, customizable colors, and zero extra translation requests. Remove claims about marker-preserving second translation requests or bold font weight.
