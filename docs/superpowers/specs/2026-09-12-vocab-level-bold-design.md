# Vocabulary Level Bold Highlighting Design

Date: 2026-09-12
Repository: `dannhitruong852-jpg/yt-dual-subs`

## Goal

Add vocabulary-learning emphasis to bilingual YouTube subtitles. Words judged to be **Level 5 or above** are bolded in the English subtitle, and the corresponding Chinese translation span is bolded when the mapping is reliable.

This feature must behave the same in Chrome and Safari and must not disturb the existing subtitle positioning, translation engines, TTS, selection/copy, export, or popup behavior.

## Product rule

The threshold is fixed at **Level 5+** for the first version.

The popup includes one user-facing switch named **“高阶词汇加粗” / “Bold advanced vocabulary”**. The persisted setting is `vocabBoldEnabled` in `chrome.storage.sync` and defaults to `true`.

- When `vocabBoldEnabled === true`, Level 5-9 English words are bolded and reliable corresponding Chinese spans are bolded.
- When `vocabBoldEnabled === false`, all vocabulary emphasis is disabled. English and Chinese render exactly as ordinary subtitles.
- The disabled state must bypass vocabulary classification work that is only needed for rendering emphasis and must not trigger any marker/alignment network request. Turning the switch off is therefore both a visual and a processing/network opt-out.
- Toggling the setting applies live to the current YouTube tab through the extension's existing `chrome.storage.onChanged` path; no page reload is required.
- The threshold itself is not user-adjustable in v1.

The internal 1-9 scale is a project-specific learning scale, not an official exam scale. It is calibrated from multiple evidence types:

- CEFR vocabulary level as the primary international proficiency axis.
- CET-4/CET-6 as Chinese learner calibration anchors.
- IELTS/TOEFL as advanced general/academic-English calibration anchors rather than literal fixed word lists.
- Native-speaker usage frequency as a correction against overrating common conversational words.
- The user's postgraduate-English vocabulary reference as a Chinese-exam calibration source, especially its separation of true-exam vocabulary, zero-frequency vocabulary, out-of-syllabus vocabulary, and its emphasis on uncommon senses of familiar words.

The uploaded reference explicitly states that it contains 4249 words seen in past postgraduate exams, 1281 syllabus words not seen in the exams, and 216 out-of-syllabus words seen in real exams. It also emphasizes that uncommon senses of familiar words are a major source of difficulty. The implementation therefore treats sense/context as a first-class override rather than assigning one immutable level to every spelling.

## 1-9 level model

The first release uses this semantic interpretation:

- Level 1: A1 core survival vocabulary and extremely common function/content words.
- Level 2: A2 everyday vocabulary.
- Level 3: B1 everyday and general-reading vocabulary.
- Level 4: lower-B2 / high-frequency upper-intermediate vocabulary; generally expected to be comfortable for the target user.
- Level 5: upper-B2 / CET-6-core boundary; words that begin to cause meaningful reading friction for the user. **Bold starts here.**
- Level 6: C1-entry, IELTS/TOEFL advanced general or academic vocabulary.
- Level 7: higher-C1, formal, academic, or clearly low-frequency educated usage.
- Level 8: C2 / rare advanced general vocabulary.
- Level 9: specialist, archaic, highly technical, or extremely rare vocabulary.

Base level is lemma-based, then context-sensitive overrides may raise or lower it for a particular sense.

Examples:

- `awkward` in ordinary conversational use should remain below the bold threshold despite being difficult for some learners, because it is common native conversational vocabulary.
- `address` meaning “street/location” is below the threshold.
- `address` meaning “deal with / tackle a problem” may be Level 5+ and should be bolded in that context.
- `exacerbate` is Level 5+ and should be bolded.

## Vocabulary data architecture

Add a self-contained runtime module, `vocab-levels.js`, loaded before `content.js`.

The runtime data should be generated from redistributable/open lexical metadata rather than copied wholesale from the uploaded book. The book is used for calibration and test cases, not republished as a dictionary.

The data pipeline may use exam tags/frequency/lemma metadata from an open source such as ECDICT, but it must not ship third-party dictionary definitions or translations. Only the minimal derived metadata needed for classification may be bundled, together with required attribution/license notices.

The generated runtime table must be compact and browser-friendly. The production extension must not depend on a server or an API for basic English level classification.

## Tokenization and normalization

Classification runs locally on the English subtitle text when `vocabBoldEnabled` is on.

Required normalization:

- preserve original surface text for rendering;
- lowercase only for lookup;
- strip surrounding punctuation;
- handle common English inflections with deterministic lemmatization;
- preserve contractions correctly;
- avoid highlighting pure numbers, URLs, obvious proper-name tokens, or punctuation;
- support repeated words and multiple Level 5+ words in one subtitle.

If a token cannot be classified with confidence, it fails conservative rather than being automatically promoted to Level 9. Unknown proper names must not become bold simply because they are absent from the lexicon.

## Context-sensitive senses

A base spelling is not always enough. The module exposes a context-aware classifier similar to:

`classifyToken(token, sentence) -> { level, lemma, reason }`

The first version uses deterministic phrase/context overrides for high-value familiar-word uncommon senses. Example classes include verbs whose difficulty changes in constructions such as `address a problem`, `pose a threat`, or similar academically common patterns.

This is intentionally conservative. The extension must not pretend to perform perfect word-sense disambiguation locally.

## Popup switch

The new switch lives in the popup's Translation card so it is visible during normal subtitle setup. It reuses the extension's existing switch visual language.

UI contract:

- control id: `vocabBoldEnabled`
- storage key: `vocabBoldEnabled`
- default: `true`
- simplified-Chinese label: `高阶词汇加粗`
- English label: `Bold advanced vocabulary`
- traditional-Chinese label: `高階詞彙加粗`

`popup.js` adds the key to `DEFAULTS`, binds the control in `bindUI()`, and writes changes through the existing `setKey()` batching path. `content.js` adds the same default and responds live in `onStorageChanged`.

The preview should make the switch observable: when on, one known Level 5+ sample token is bold in the English preview and the matching Chinese sample span is bold; when off, both preview lines are plain. Preview sample markup must be created safely with DOM nodes, not `innerHTML` from translated/external text.

## English rendering

`content.js` currently writes subtitle text through `textContent`. The new rendering path must retain the same safety guarantees.

Instead of setting `innerHTML`, the renderer constructs DOM text nodes and `<span class="ytds-vocab-bold">` nodes. This avoids HTML injection and keeps text selection/copy behavior predictable.

When enabled, English text is bolded deterministically for classified Level 5+ tokens. CSS uses `font-weight: 700`.

When disabled, `setOriginal()` follows the ordinary plain-text path and creates no vocabulary spans.

## Chinese counterpart alignment

The requirement is not merely to bold the English word; the corresponding Chinese translated span should also be bold.

### GTX path

When an enabled sentence contains one or more Level 5+ English tokens, insert stable non-language marker tokens around only those source spans before the translation/alignment request. The marker format must be covered by parser tests and must never render visibly.

The returned translation is parsed into plain Chinese text plus marked Chinese spans, then rendered as text nodes and bold spans.

### BYO/LLM path

Extend the controlled translation protocol so difficult-word markers survive translation or explicit span metadata is returned. The normal visible translation remains plain natural Chinese; only the renderer receives span metadata.

The change must not expose API keys or alter existing key-storage rules.

### YouTube `tlang` path

`tlang` does not accept modified source text, so it cannot provide direct word alignment. When an enabled displayed sentence contains Level 5+ vocabulary, use the existing no-key GTX capability to obtain marker-preserving aligned translation for that sentence and cache it. For those sentences, the aligned translation becomes the rendered Chinese line so English and Chinese bold spans remain semantically paired.

This extra call is only made for enabled subtitles containing Level 5+ vocabulary. If the feature switch is off, no alignment request is made.

If alignment cannot be produced or parsed safely, render the ordinary translation unchanged and omit Chinese bolding for that sentence. Never guess a Chinese span aggressively.

## Caching and performance

Vocabulary classification is local and synchronous.

Alignment/marked translations are cached by a stable key containing at least video id, source sentence, target language, and translation-engine identity where relevant.

Do not trigger work on every animation frame. Classification happens when subtitle text changes. Network alignment happens at most once per unique qualifying sentence while cached.

When `vocabBoldEnabled` is false, the emphasis pipeline short-circuits before classification/alignment work.

## Interaction with selection/copy

The extension already supports selectable subtitle text. Bold spans must not change copied text.

Copying a subtitle produces the same plain English/Chinese string as before, without marker characters, HTML, or duplicated whitespace.

Pending-line logic that delays DOM updates while the user has an active selection must continue to work with structured rendering.

## TTS and export

TTS receives plain translation strings, never marker tokens or DOM markup.

SRT/export paths remain plain text and must not contain bold markup or marker characters.

The vocabulary emphasis is a presentation feature only.

## Chrome and Safari

The vocabulary module must be pure browser JavaScript with no Chrome-only APIs. It is included in the shared extension source so both generated Chrome and Safari packages use the same classifier and renderer.

Update cross-browser packaging tests to verify the vocabulary module is present in both packages and that Safari packaging does not drop it.

## Testing

Use TDD. Required regression coverage includes:

1. Level threshold: Level 4 words are plain; Levels 5-9 are bold.
2. `awkward` ordinary use does not get incorrectly promoted merely because it is learner-difficult.
3. `address` low-level sense stays plain.
4. `address` in an advanced problem-solving sense is promoted to Level 5+.
5. `exacerbate` is bold.
6. Inflected forms resolve to the expected lemma.
7. Proper names/URLs/numbers are not promoted as unknown vocabulary.
8. Multiple difficult words in one sentence render all correct English spans.
9. Marker parsing yields matching Chinese bold spans.
10. Broken/missing alignment fails closed: Chinese remains plain rather than bolding the wrong text.
11. Text selection and copied text contain no markers or markup.
12. `vocabBoldEnabled` defaults to true, persists in sync storage, and updates the current page live.
13. With `vocabBoldEnabled=false`, both lines are plain and no marker/alignment request is initiated.
14. Existing independent Chinese-above-English positioning regression still passes.
15. Both Chrome and Safari package tests pass and include `vocab-levels.js`.

## Non-goals for v1

- No user-adjustable numeric threshold; the threshold remains Level 5+.
- No visible numeric level badges.
- No color coding by level.
- No dictionary popup.
- No attempt to provide perfect full-dictionary word-sense disambiguation.
- No republication of the uploaded copyrighted vocabulary book as a dataset.

## Acceptance criteria

With **高阶词汇加粗** enabled, a YouTube subtitle containing Level 5+ vocabulary displays those English words in bold and bolds corresponding Chinese translated spans whenever reliable alignment is available. Ordinary Level 1-4 words remain visually unchanged. With the switch disabled, both lines render without vocabulary bolding and the alignment pipeline performs no extra work or requests. The feature works in both Chrome and Safari packages, updates live when toggled, does not leak markers into TTS/export/copy, and fails conservatively when uncertain.
