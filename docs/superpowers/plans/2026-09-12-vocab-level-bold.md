# Vocabulary Level Bold Highlighting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional Level-5+ vocabulary bolding to English YouTube subtitles and reliably aligned Chinese translations, with a popup switch that defaults on and fully disables classification/alignment work when off.

**Architecture:** Add a pure-browser `vocab-levels.js` classifier/marker module loaded before `content.js`; keep rendering and network orchestration inside `content.js`; reuse existing `chrome.storage.sync`/`storage.onChanged` plumbing for the switch; reuse the existing translation worker contract where possible and add marked-alignment metadata only where needed. Package the same module into Chrome and Safari builds.

**Tech Stack:** Manifest V3 JavaScript, DOM APIs, chrome.storage.sync, existing background translation worker, Node 22 regression tests, GitHub Actions packaging.

**Spec:** `docs/superpowers/specs/2026-09-12-vocab-level-bold-design.md`

## Global Constraints

- Bold threshold is fixed at Level 5+.
- `vocabBoldEnabled` is stored in `chrome.storage.sync` and defaults to `true`.
- When disabled, both subtitle lines are plain and no vocabulary-alignment network request is initiated.
- English classification is local; the extension must not depend on a server/API to decide a token's level.
- Unknown tokens fail conservative; unknown proper names are never auto-promoted.
- Never use subtitle text as `innerHTML`; render with text nodes and controlled `<span>` elements only.
- TTS/export/copy must remain plain text with no marker leakage.
- Chrome and Safari must share identical classifier/rendering behavior.
- Do not redistribute the uploaded vocabulary PDF as a dataset.
- Use TDD; existing independent-position regression must continue to pass.

---

## File Structure

**Create**
- `vocab-levels.js` — tokenization, normalization, lemmatization, Level 1-9 lookup, context overrides, source-marker generation/parsing helpers.
- `tests/vocab-levels.test.js` — classifier/marker unit regression tests.
- `tests/vocab-bold-toggle.test.js` — static contract tests for defaults, popup binding, and disabled short-circuit.
- `THIRD_PARTY_VOCABULARY.md` — attribution and derivation notes for any redistributable lexical metadata bundled into `vocab-levels.js`.

**Modify**
- `manifest.json` — load `vocab-levels.js` before `content.js`.
- `content.js` — settings default, live switch handling, structured English/Chinese rendering, alignment cache/orchestration, disabled fast path.
- `content.css` — `.ytds-vocab-bold { font-weight: 700; }`.
- `popup.html` — add `高阶词汇加粗` checkbox/switch row in Translation card.
- `popup.js` — add default, bind state, persist via `setKey()`, update preview.
- `popup.css` — reuse/adjust existing switch/check-row styles only if needed.
- `_locales/en/messages.json` — English label/aria text.
- `_locales/zh_CN/messages.json` — simplified-Chinese label/aria text.
- `_locales/zh_TW/messages.json` — traditional-Chinese label/aria text.
- `background.js` — only if existing translate message contract cannot carry marker/alignment metadata cleanly; preserve ordinary translation behavior.
- `tests/browser-packages.test.mjs` — assert `vocab-levels.js` is shipped in both packages.
- `.github/workflows/build-browser-packages.yml` — run vocabulary regressions before packaging.

---

### Task 1: Build the standalone vocabulary classifier

**Files:**
- Create: `vocab-levels.js`
- Create: `tests/vocab-levels.test.js`
- Create: `THIRD_PARTY_VOCABULARY.md`

**Interfaces:**
- Produces global/browser API `self.YTDS_VOCAB`.
- Required API:
  - `LEVEL_BOLD_MIN: 5`
  - `tokenize(sentence) -> [{ text, start, end }]`
  - `classifyToken(token, sentence) -> { level, lemma, reason }`
  - `classifySentence(sentence) -> [{ text, start, end, level, lemma, reason }]`
  - `markSource(sentence, classified) -> { text, ids }`
  - `parseMarkedTranslation(text) -> { text, spans } | null`

- [ ] **Step 1: Write failing classifier tests**

Create `tests/vocab-levels.test.js` with assertions for:

```js
const assert = require('assert');
const V = require('../vocab-levels.js');

assert.strictEqual(V.LEVEL_BOLD_MIN, 5);
assert.ok(V.classifyToken('awkward', 'That was awkward.').level < 5);
assert.ok(V.classifyToken('address', 'My address is on the form.').level < 5);
assert.ok(V.classifyToken('address', 'We must address the structural problem.').level >= 5);
assert.ok(V.classifyToken('exacerbate', 'This may exacerbate inequality.').level >= 5);
assert.strictEqual(V.classifyToken('exacerbated', 'It exacerbated the problem.').lemma, 'exacerbate');
assert.ok(V.classifyToken('Google', 'Google released an update.').level < 5);
assert.ok(V.classifyToken('2026', 'In 2026 this changed.').level < 5);
assert.ok(V.classifyToken('https://example.com', 'See https://example.com').level < 5);

const multi = V.classifySentence('A preliminary policy may exacerbate inequality.');
assert.ok(multi.filter(x => x.level >= 5).length >= 2);

const marked = V.markSource('This may exacerbate inequality.', V.classifySentence('This may exacerbate inequality.'));
assert.ok(marked.text.includes('exacerbate'));
assert.ok(marked.ids.length >= 1);

const parsed = V.parseMarkedTranslation('这可能会⟦v0⟧加剧⟦/v0⟧不平等。');
assert.deepStrictEqual(parsed, { text: '这可能会加剧不平等。', spans: [{ id: 'v0', start: 4, end: 6 }] });
assert.strictEqual(V.parseMarkedTranslation('坏掉的⟦v0⟧标记'), null);
```

- [ ] **Step 2: Run the test and confirm RED**

Run:

```bash
node tests/vocab-levels.test.js
```

Expected: FAIL because `vocab-levels.js` does not exist yet.

- [ ] **Step 3: Implement minimal pure-JS classifier**

Implement `vocab-levels.js` as a UMD-style module:

```js
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.YTDS_VOCAB = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';
  const LEVEL_BOLD_MIN = 5;
  // compact derived metadata + conservative defaults + context overrides
  // ...
  return { LEVEL_BOLD_MIN, tokenize, classifyToken, classifySentence, markSource, parseMarkedTranslation };
});
```

Use a compact lemma metadata table sufficient to distinguish Level 1-4 from Level 5+ for common YouTube/general/academic English. Store only derived level/frequency/exam-tag data, not dictionary definitions.

Add deterministic inflection handling for `-s/-es/-ed/-ing/-ies` plus an explicit irregular map for high-frequency irregulars needed by the vocabulary table.

Add context overrides at minimum for:

```js
/address\s+(the\s+)?(problem|issue|challenge|question|concern|gap|risk|need|inequality|cause|impact)/i
/pose\s+(a\s+)?(threat|risk|challenge|problem|question)/i
```

Map ordinary conversational `awkward` below 5; map `exacerbate` to 6 or 7.

- [ ] **Step 4: Add attribution file**

Create `THIRD_PARTY_VOCABULARY.md` documenting:
- source repository/dataset names actually used,
- licenses,
- which columns/metadata were used,
- that definitions/translations were not bundled,
- how raw source categories were converted into this project's 1-9 scale.

- [ ] **Step 5: Run classifier tests GREEN**

Run:

```bash
node tests/vocab-levels.test.js
```

Expected: `PASS vocabulary levels`.

- [ ] **Step 6: Commit**

```bash
git add vocab-levels.js tests/vocab-levels.test.js THIRD_PARTY_VOCABULARY.md
git commit -m "Add vocabulary level classifier"
```

---

### Task 2: Wire the classifier into the extension bundle

**Files:**
- Modify: `manifest.json`
- Modify: `tests/browser-packages.test.mjs`

**Interfaces:**
- Consumes: `self.YTDS_VOCAB` from Task 1.
- Produces: `vocab-levels.js` loaded before `content.js` in the isolated-world content script.

- [ ] **Step 1: Extend packaging test first**

In `tests/browser-packages.test.mjs`, make the fixture manifest include:

```js
content_scripts: [{
  matches: ['https://www.youtube.com/*'],
  js: ['vocab-levels.js', 'content.js'],
  run_at: 'document_idle'
}]
```

Create fixture `vocab-levels.js`, then assert:

```js
await access(path.join(out, 'chrome', 'vocab-levels.js'));
await access(path.join(out, 'safari', 'vocab-levels.js'));
```

- [ ] **Step 2: Run packaging test and confirm RED where appropriate**

```bash
node tests/browser-packages.test.mjs
```

Expected: fixture assertion fails until fixture/source wiring is complete.

- [ ] **Step 3: Modify real manifest**

Change the document-idle content-script list from:

```json
["fonts.js", "content.js", "independent-position.js"]
```

to:

```json
["fonts.js", "vocab-levels.js", "content.js", "independent-position.js"]
```

- [ ] **Step 4: Run syntax and packaging tests**

```bash
node --check vocab-levels.js
node tests/browser-packages.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add manifest.json tests/browser-packages.test.mjs
git commit -m "Ship vocabulary classifier in browser packages"
```

---

### Task 3: Add the popup switch and live preview

**Files:**
- Modify: `popup.html`
- Modify: `popup.js`
- Modify: `popup.css`
- Modify: `_locales/en/messages.json`
- Modify: `_locales/zh_CN/messages.json`
- Modify: `_locales/zh_TW/messages.json`
- Create: `tests/vocab-bold-toggle.test.js`

**Interfaces:**
- Produces sync setting `vocabBoldEnabled: boolean`.
- Default: `true`.

- [ ] **Step 1: Write failing static toggle contract test**

Create `tests/vocab-bold-toggle.test.js` that reads source files and asserts:

```js
const assert = require('assert');
const fs = require('fs');

const popup = fs.readFileSync('popup.js', 'utf8');
const html = fs.readFileSync('popup.html', 'utf8');
const content = fs.readFileSync('content.js', 'utf8');

assert.match(popup, /vocabBoldEnabled:\s*true/);
assert.match(content, /vocabBoldEnabled:\s*true/);
assert.match(html, /id="vocabBoldEnabled"/);
assert.match(popup, /setKey\("vocabBoldEnabled"/);
```

- [ ] **Step 2: Run test and confirm RED**

```bash
node tests/vocab-bold-toggle.test.js
```

Expected: FAIL on missing setting/control.

- [ ] **Step 3: Add popup markup**

Inside the Translation card add a compact switch row:

```html
<div class="row row-split vocab-bold-row">
  <label for="vocabBoldEnabled" data-i18n="vocabBoldLabel">高阶词汇加粗</label>
  <label class="switch" title="高阶词汇加粗" data-i18n-title="vocabBoldLabel">
    <input type="checkbox" id="vocabBoldEnabled"
           aria-label="高阶词汇加粗" data-i18n-aria="vocabBoldAria" />
    <span class="switch-track"><span class="switch-thumb"></span></span>
  </label>
</div>
```

- [ ] **Step 4: Wire popup state**

Add to `DEFAULTS`:

```js
vocabBoldEnabled: true,
```

Add to `bindUI()`:

```js
$('vocabBoldEnabled').checked = !!state.vocabBoldEnabled;
```

Add to `wire()`:

```js
$('vocabBoldEnabled').addEventListener('change', (e) =>
  setKey('vocabBoldEnabled', e.target.checked));
```

Update preview rendering so a deterministic advanced sample word and its Chinese counterpart use a controlled `<span class="ytds-vocab-bold">` only when the switch is on. Build nodes with `replaceChildren()` / `createTextNode()`.

- [ ] **Step 5: Add locale strings**

Add:

```json
"vocabBoldLabel": { "message": "Bold advanced vocabulary" },
"vocabBoldAria": { "message": "Turn advanced vocabulary bolding on or off" }
```

to English; equivalent simplified/traditional Chinese strings to those locales.

- [ ] **Step 6: Run toggle test GREEN**

```bash
node tests/vocab-bold-toggle.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add popup.html popup.js popup.css _locales/en/messages.json _locales/zh_CN/messages.json _locales/zh_TW/messages.json tests/vocab-bold-toggle.test.js
git commit -m "Add advanced vocabulary bolding switch"
```

---

### Task 4: Render Level-5+ English tokens safely in the subtitle DOM

**Files:**
- Modify: `content.js`
- Modify: `content.css`
- Modify: `tests/vocab-bold-toggle.test.js`

**Interfaces:**
- Consumes: `self.YTDS_VOCAB.classifySentence()`.
- Produces: structured English subtitle DOM while preserving `textContent` equality with the source sentence.

- [ ] **Step 1: Extend failing static/runtime tests**

Add assertions that:
- `content.js` references `YTDS_VOCAB`.
- disabled path checks `settings.vocabBoldEnabled` before classification.
- `content.css` defines `.ytds-vocab-bold`.

Add a small exported/testable renderer helper in `vocab-levels.js` only if needed; otherwise exercise classifier spans and static integration separately.

- [ ] **Step 2: Implement a safe line renderer**

Inside `content.js`, add:

```js
function renderPlain(el, text) {
  el.textContent = text || '';
}

function renderOriginalWithVocabulary(el, text) {
  if (!settings.vocabBoldEnabled || !self.YTDS_VOCAB) {
    renderPlain(el, text);
    return;
  }
  const items = self.YTDS_VOCAB.classifySentence(text || '');
  // append untouched gaps as Text nodes, target tokens as controlled spans
}
```

Do not use `innerHTML`.

Update `setOriginal()` to preserve existing pending-selection behavior, then call the renderer rather than assigning `textContent` directly.

- [ ] **Step 3: Add CSS**

```css
.ytds-vocab-bold { font-weight: 700; }
```

Do not alter size/color/background.

- [ ] **Step 4: Make live switch repaint current line**

In `onStorageChanged`, when `vocabBoldEnabled` changes:
- update `settings.vocabBoldEnabled` through the existing general settings merge path;
- re-render the currently displayed original string immediately;
- if disabling, clear/cancel any in-flight vocabulary-only alignment bookkeeping and re-render current translation as plain text.

- [ ] **Step 5: Run tests**

```bash
node tests/vocab-levels.test.js
node tests/vocab-bold-toggle.test.js
node tests/independent-position.test.js
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add content.js content.css tests/vocab-bold-toggle.test.js
git commit -m "Bold advanced words in English subtitles"
```

---

### Task 5: Add reliable Chinese marker alignment

**Files:**
- Modify: `content.js`
- Modify: `background.js` only if the existing message shape cannot return marked text intact
- Modify: `tests/vocab-levels.test.js`
- Create or modify: `tests/vocab-alignment.test.js`

**Interfaces:**
- Consumes: `YTDS_VOCAB.markSource()` and `parseMarkedTranslation()`.
- Produces: `{ text, spans }` presentation metadata for the Chinese line.

- [ ] **Step 1: Write marker/alignment parser tests**

Cover:
- one marked word;
- two marked words;
- reordered Chinese output;
- duplicated/missing/unterminated marker => `null`;
- marker characters stripped from visible text;
- disabled mode never calls alignment helper.

Example:

```js
assert.deepStrictEqual(
  V.parseMarkedTranslation('该政策可能⟦v0⟧加剧⟦/v0⟧⟦v1⟧不平等⟦/v1⟧。'),
  { text: '该政策可能加剧不平等。', spans: [
    { id: 'v0', start: 5, end: 7 },
    { id: 'v1', start: 7, end: 10 }
  ] }
);
```

- [ ] **Step 2: Add vocabulary alignment cache to `content.js`**

Use:

```js
const vocabAlignCache = new Map();
const vocabAlignInflight = new Map();
```

Cache key must include video id, target language, engine, and original sentence.

- [ ] **Step 3: Implement alignment request helper**

Pseudo-contract:

```js
async function getVocabularyAlignment(sourceText, ordinaryTranslation, engine) {
  if (!settings.vocabBoldEnabled) return null;
  const classified = self.YTDS_VOCAB.classifySentence(sourceText);
  const difficult = classified.filter(x => x.level >= self.YTDS_VOCAB.LEVEL_BOLD_MIN);
  if (!difficult.length) return null;
  // build marked source, request translation using existing worker capability,
  // parse markers, validate spans, cache result
}
```

For `gtx`, prefer the existing worker route with the marked source.
For `tlang`, make one extra no-key GTX request only for qualifying sentences.
For BYO/LLM, extend the request protocol only if the provider can preserve marker tokens reliably; otherwise fail closed to plain Chinese for that provider in v1 rather than guessing.

- [ ] **Step 4: Render Chinese spans safely**

Add:

```js
function renderTranslationWithSpans(el, text, spans) {
  // append Text nodes and controlled .ytds-vocab-bold spans by validated offsets
}
```

If parsing/validation fails, call `renderPlain(transEl, ordinaryTranslation)`.

- [ ] **Step 5: Preserve plain-string consumers**

Verify that:
- `lastTransSource` remains the original source string;
- TTS receives ordinary plain Chinese strings;
- export/SRT reads strings/cue data, not DOM markup;
- selection/copy yields exact visible text with no marker characters.

- [ ] **Step 6: Run alignment and regression tests**

```bash
node tests/vocab-levels.test.js
node tests/vocab-alignment.test.js
node tests/vocab-bold-toggle.test.js
node tests/independent-position.test.js
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add content.js background.js tests/vocab-levels.test.js tests/vocab-alignment.test.js
git commit -m "Bold aligned Chinese vocabulary translations"
```

---

### Task 6: Enforce the disabled fast path and race safety

**Files:**
- Modify: `content.js`
- Modify: `tests/vocab-alignment.test.js`
- Modify: `tests/vocab-bold-toggle.test.js`

**Interfaces:**
- Ensures a stale async result cannot re-bold text after the user turned the feature off or navigated to another cue/video.

- [ ] **Step 1: Add failing race tests**

Model a generation token:

```js
let vocabEpoch = 0;
```

Tests/static assertions must prove:
- disabling increments epoch;
- a response captured under old epoch is discarded;
- disabling bypasses classification/alignment request creation.

- [ ] **Step 2: Implement epoch invalidation**

In `content.js`:

```js
let vocabEpoch = 0;
```

Increment on:
- `vocabBoldEnabled` true -> false;
- video/cue teardown if existing `cueEpoch` cannot safely serve the same role.

Before applying any async alignment result, compare captured epoch and current source sentence/video id.

- [ ] **Step 3: Clear current visual state synchronously on disable**

On disable:
- immediately re-render original with plain text;
- immediately re-render translation with its plain string;
- clear vocabulary-only cache/inflight entries if needed to prevent unnecessary memory retention.

- [ ] **Step 4: Run tests**

```bash
node tests/vocab-alignment.test.js
node tests/vocab-bold-toggle.test.js
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add content.js tests/vocab-alignment.test.js tests/vocab-bold-toggle.test.js
git commit -m "Make vocabulary bolding disable cleanly"
```

---

### Task 7: Add CI coverage and final package verification

**Files:**
- Modify: `.github/workflows/build-browser-packages.yml`
- Modify: `tests/browser-packages.test.mjs`

**Interfaces:**
- CI must reject a package that omits the classifier or breaks vocabulary regressions.

- [ ] **Step 1: Update workflow regression step**

Run:

```yaml
- name: Run regression tests
  run: |
    node tests/independent-position.test.js
    node tests/vocab-levels.test.js
    node tests/vocab-bold-toggle.test.js
    node tests/vocab-alignment.test.js
    node tests/browser-packages.test.mjs
```

- [ ] **Step 2: Run all local Node checks**

```bash
node --check vocab-levels.js
node --check content.js
node --check popup.js
node --check background.js
node tests/independent-position.test.js
node tests/vocab-levels.test.js
node tests/vocab-bold-toggle.test.js
node tests/vocab-alignment.test.js
node tests/browser-packages.test.mjs
```

Expected: all PASS / no syntax errors.

- [ ] **Step 3: Build packages locally**

```bash
node scripts/build-browser-packages.mjs
```

Verify:

```bash
test -f dist/chrome/vocab-levels.js
test -f dist/safari/vocab-levels.js
```

- [ ] **Step 4: Commit CI changes**

```bash
git add .github/workflows/build-browser-packages.yml tests/browser-packages.test.mjs
git commit -m "Test vocabulary bolding in browser builds"
```

---

### Task 8: Runtime acceptance check on real YouTube subtitles

**Files:**
- No code change unless a defect is found.

**Interfaces:**
- Validates real DOM behavior that static Node tests cannot fully prove.

- [ ] **Step 1: Install the freshly built Chrome package as unpacked extension**

Use `dist/chrome` on desktop Chrome.

- [ ] **Step 2: Verify enabled behavior**

On a YouTube video with English captions, confirm:
- Level 5+ English examples visibly bold;
- ordinary words remain normal;
- Chinese corresponding words bold when alignment succeeds;
- subtitle positions remain Chinese above / English below.

- [ ] **Step 3: Verify switch behavior live**

Open popup, turn **高阶词汇加粗** off, and confirm without page reload:
- existing bolding disappears immediately;
- subsequent subtitles remain plain;
- turning it back on restores classification/bolding.

- [ ] **Step 4: Verify copy/TTS/export sanity**

Confirm copied text and exported SRT contain no marker tokens or markup. If TTS is configured, confirm it speaks normal Chinese text.

- [ ] **Step 5: Trigger GitHub Actions and inspect artifacts**

After pushing the final commit, require the `Build Chrome and Safari packages` workflow to succeed and confirm both artifact families are produced.

- [ ] **Step 6: Final commit only if acceptance uncovered fixes**

```bash
git add <fixed files>
git commit -m "Fix vocabulary bolding acceptance issues"
```
