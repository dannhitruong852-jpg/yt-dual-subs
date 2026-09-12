# Vocabulary Level Bold Highlighting Design

Date: 2026-09-12
Repository: `dannhitruong852-jpg/yt-dual-subs`

## Goal

Add vocabulary-learning emphasis to bilingual YouTube subtitles. Words judged to be **Level 5 or above** are bolded in the English subtitle, and the corresponding Chinese translation span is bolded when the mapping is reliable.

This feature must behave the same in Chrome and Safari and must not disturb the existing subtitle positioning, translation engines, TTS, selection/copy, export, or popup behavior.

## Product rule

The threshold is fixed at **Level 5+** for the first version. There is no settings UI in v1.

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

Add a self-contained runtime module, tentatively `vocab-levels.js`, loaded before `content.js`.

The runtime data should be generated from redistributable/open lexical sources rather than copied wholesale from the uploaded book. The book is used for calibration and test cases, not republished as a dictionary.

Preferred source stack for v1:

1. CEFR-J / Open Language Profiles for CEFR-labelled vocabulary.
2. C1/C2 extension data where licensing permits redistribution with attribution.
3. An openly redistributable general/native frequency source to correct CEFR-only misclassification of common spoken vocabulary.
4. Small hand-curated context overrides for common polysemes that matter to the target learner.

The generated runtime table should be compact and browser-friendly. The production extension should not depend on a server or an API for basic English level classification.

## Tokenization and normalization

Classification runs locally on the English subtitle text.

Required normalization:

- preserve original surface text for rendering;
- lowercase only for lookup;
- strip surrounding punctuation;
- handle common English inflections with lightweight deterministic lemmatization;
- preserve contractions correctly;
- avoid highlighting pure numbers, URLs, obvious proper-name tokens, or punctuation;
- support repeated words and multiple Level 5+ words in one subtitle.

If a token cannot be classified with confidence, it should fail conservative rather than be automatically promoted to Level 9. Unknown proper names must not become bold simply because they are absent from the lexicon.

## Context-sensitive senses

A base spelling is not always enough. The module exposes a context-aware classifier similar to:

`classifyToken(token, sentence) -> { level, lemma, reason }`

The first version uses deterministic phrase/context overrides for high-value familiar-word uncommon senses. Example classes include verbs whose difficulty changes in constructions such as `address a problem`, `pose a threat`, or similar academically common patterns.

This is intentionally conservative. The extension must not pretend to perform perfect word-sense disambiguation locally.

## English rendering

`content.js` currently writes subtitle text through `textContent`. The new rendering path must retain the same safety guarantees.

Instead of setting `innerHTML`, the renderer constructs DOM text nodes and `<span class="ytds-vocab-bold">` nodes. This avoids HTML injection and keeps text selection/copy behavior predictable.

English text is always bolded deterministically for classified Level 5+ tokens.

CSS uses `font-weight: 700` (or equivalent relative bolding compatible with the selected subtitle font).

## Chinese counterpart alignment

The requirement is not merely to bold the English word; the corresponding Chinese translated span should also be bold.

The alignment design differs by translation path:

### GTX path

When a sentence contains one or more Level 5+ English tokens, insert stable non-language marker tokens around only those source spans before sending the translation request. The marker format must be chosen and tested so Google translation preserves the boundaries without rendering the marker text.

The returned translation is parsed into plain Chinese text plus marked Chinese spans, then rendered as text nodes and bold spans.

This should use the existing translation request rather than a second request whenever possible.

### BYO/LLM path

Extend the controlled translation prompt/protocol so difficult-word markers survive translation or return explicit span metadata. The normal visible translation remains plain natural Chinese; only the renderer receives span metadata.

The change must not expose API keys or alter existing key-storage rules.

### YouTube `tlang` path

`tlang` does not accept modified source text, so it cannot provide direct word alignment. When a displayed sentence contains Level 5+ vocabulary, use the existing no-key GTX capability to obtain a marker-preserving aligned translation for that sentence and cache it. For those sentences, the aligned translation becomes the rendered Chinese line so the English and Chinese bold spans remain semantically paired.

This extra call is only made for subtitles containing Level 5+ vocabulary and only in the YouTube/Google translation path; it is not a general extra request for every subtitle.

If alignment cannot be produced or parsed safely, render the ordinary translation unchanged and omit Chinese bolding for that sentence. Never guess a Chinese span aggressively.

## Caching and performance

Vocabulary classification is local and synchronous.

Alignment/marked translations are cached by a stable key containing at least video id, source sentence, target language, and translation-engine identity where relevant.

Do not trigger work on every animation frame. Classification happens when subtitle text changes. Network alignment happens at most once per unique qualifying sentence while cached.

The feature must not materially increase cue-loop CPU use.

## Interaction with selection/copy

The extension already supports selectable subtitle text. Bold spans must not change copied text.

Copying a subtitle should produce the same plain English/Chinese string as before, without marker characters, HTML, or duplicated whitespace.

Pending-line logic that delays DOM updates while the user has an active selection must continue to work with structured rendering.

## TTS and export

TTS must receive plain translation strings, never marker tokens or DOM markup.

SRT/export paths remain plain text and should not contain bold markup or marker characters.

The vocabulary emphasis is a presentation feature only.

## Chrome and Safari

The vocabulary module must be pure browser JavaScript with no Chrome-only APIs. It is included in the shared extension source so both generated Chrome and Safari packages use the same classifier and renderer.

Update the cross-browser packaging tests to verify that the vocabulary module is present in both packages and that Safari packaging does not drop it.

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
9. GTX/BYO marker parsing yields matching Chinese bold spans.
10. Broken/missing alignment fails closed: Chinese remains plain rather than bolding the wrong text.
11. Text selection and copied text contain no markers or markup.
12. Existing independent Chinese-above-English positioning regression still passes.
13. Both Chrome and Safari package tests pass.

## Non-goals for v1

- No user-adjustable threshold UI.
- No visible numeric level badges.
- No color coding by level.
- No dictionary popup.
- No attempt to provide perfect full-dictionary word-sense disambiguation.
- No republication of the uploaded copyrighted vocabulary book as a dataset.

## Acceptance criteria

A YouTube subtitle containing Level 5+ vocabulary displays those English words in bold. The Chinese line bolds the corresponding translated spans whenever a reliable marked alignment is available. Ordinary Level 1-4 words remain visually unchanged. The feature works in both Chrome and Safari packages, does not leak markers into TTS/export/copy, and fails conservatively when uncertain.
