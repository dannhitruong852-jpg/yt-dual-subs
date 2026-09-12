# Level 5+ Vocabulary Color Highlighting Design

Date: 2026-09-12
Repository: `dannhitruong852-jpg/yt-dual-subs`
Branch: `feature/vocab-bold`

This specification supersedes the earlier bold-highlighting design for the vocabulary-learning feature.

## Goal

Highlight difficult vocabulary in bilingual YouTube subtitles using **user-configurable colors**, not bold weight or font-size changes.

The product threshold is fixed at the project's custom **Level 5 and above** (Levels 5-9). Level 1-4 vocabulary retains the normal subtitle color.

For a qualifying English word, the English surface form is colored. When the corresponding Chinese surface form can be matched locally with high confidence, that Chinese span is also colored. If the Chinese mapping is uncertain, the English word is colored and the Chinese line remains unchanged for that item.

The feature must not increase translation request volume, must not trigger a second Google request for alignment, and must not introduce a DOM mutation feedback loop.

## Non-negotiable stability rule

Vocabulary highlighting is a **presentation-only, network-free subsystem**.

It must never call the translation worker, Google Translate, YouTube `tlang`, or a BYO translation provider. Enabling Level 5+ highlighting must therefore create **zero additional translation requests** compared with highlighting being disabled.

The previous prototype violated this by sending a second marker-bearing translation request for qualifying lines and by observing/re-writing translated subtitle DOM. That architecture is retired.

The final design also avoids a `MutationObserver` that observes nodes it subsequently rewrites. Vocabulary rendering is invoked directly from the existing subtitle rendering path in `content.js`, so changing engines repeatedly cannot create a self-triggering render loop.

## Vocabulary standard

The internal 1-9 vocabulary scale is project-specific rather than an official exam scale. It combines several calibration dimensions:

- CEFR as the primary international proficiency axis.
- CET-4/CET-6 as Chinese-learner calibration anchors.
- IELTS and TOEFL as advanced general/academic-English calibration signals rather than literal official word lists.
- Postgraduate entrance-exam vocabulary as an additional Chinese academic-reading calibration dimension, including uncommon senses of familiar words.
- Native-speaker usage frequency/register so ordinary conversational words are not incorrectly promoted merely because learners may encounter them late.

The first-release interpretation is:

- Level 1: A1 core vocabulary.
- Level 2: A2 everyday vocabulary.
- Level 3: B1 general vocabulary.
- Level 4: lower-B2/high-frequency upper-intermediate vocabulary.
- Level 5: upper-B2/CET-6-core reading-friction boundary. **Color starts here.**
- Level 6: C1-entry / advanced IELTS-TOEFL general and academic vocabulary.
- Level 7: higher-C1, formal, academic, or clearly low-frequency educated usage.
- Level 8: C2 / rare advanced general vocabulary.
- Level 9: specialist, archaic, highly technical, or extremely rare vocabulary.

Examples remain sense-aware:

- ordinary `awkward` stays below the highlighting boundary;
- `address` meaning a street/location stays below the boundary;
- `address a problem` can be promoted to Level 5 because the contextual sense is “deal with/tackle”;
- `exacerbate` is Level 5+.

## Vocabulary data architecture

Replace the prototype's small hand-written list with a generated local lexical dataset large enough for normal YouTube use.

Build-time sources may include redistributable/open metadata such as:

- ECDICT exam tags, lemma/exchange metadata, frequency metadata, and Chinese gloss metadata under its license;
- redistributable CEFR-labelled vocabulary metadata;
- redistributable native-English frequency/register metadata;
- a small hand-curated override table for high-value polysemes and classification errors.

The user's uploaded postgraduate vocabulary book is a calibration/reference source only. Its copyrighted dictionary content is not republished into the extension.

The production extension ships only compact derived runtime data required for:

1. English lemma -> project Level 1-9;
2. surface-form/inflection -> lemma normalization;
3. selected context/sense overrides;
4. for Level 5+ lemmas only, a compact set of short Chinese surface candidates used for conservative local matching.

The raw third-party dictionaries are not bundled into the extension package.

## Unknown-word policy

The prototype treated most unknown words as Level 3, which creates obvious false negatives when the built-in list is incomplete. The final classifier must not use that behavior as its main fallback.

Classification order:

1. exact/lemmatized lookup in generated vocabulary data;
2. context/sense override;
3. known native-frequency/exam/CEFR metadata;
4. conservative morphology/register heuristics only when data is absent;
5. proper names, URLs, numbers, and obvious non-lexical tokens remain unhighlighted.

Unknown words are never automatically promoted to Level 9 simply because they are absent, but long academic morphology may conservatively enter Level 5 when supported by the configured heuristic.

## Rendering architecture

Vocabulary coloring is integrated into the existing render functions rather than applied by a second observer-based runtime.

`content.js` already owns the source strings and knows when a cue actually changes. The new renderer receives the plain subtitle string and creates DOM text nodes plus color spans only when needed.

Conceptually:

`renderVocabularyText(element, text, ranges, color)`

The renderer:

- never uses `innerHTML` for subtitle text;
- preserves exact visible text and whitespace;
- changes only the `color` style/class of matched spans;
- never changes font weight, size, family, stroke, background, or line position;
- is idempotent;
- preserves selection/copy plain text;
- is bypassed entirely when highlighting is disabled.

The old observer-based `vocab-runtime.js` must either be removed or reduced to a pure helper with no DOM observation and no network calls. The preferred architecture is direct rendering from `content.js`.

## Chinese counterpart matching

Chinese coloring is local and conservative. It does **not** request a second translation.

For every Level 5+ English lemma, the generated dataset may contain a small list of likely Chinese surface candidates, for example conceptually:

`exacerbate -> [加剧, 恶化, 加重]`

When a translated Chinese line is already available from YouTube, Google, or BYO:

1. inspect only the existing translated text;
2. find candidate surface forms for the active Level 5+ English lemmas;
3. color a Chinese candidate only when the match is unambiguous and non-overlapping;
4. if multiple English words compete for the same Chinese span, or several candidate matches make the mapping ambiguous, do not color that Chinese item;
5. never replace or retranslate the Chinese string merely to obtain alignment.

This gives all translation engines the same zero-extra-request behavior.

Chinese coverage is intentionally allowed to be lower than English coverage. A missed Chinese highlight is preferable to a wrong highlight, an extra network request, or a stability regression.

## Settings and popup UI

Replace the old bold setting with vocabulary color highlighting.

New settings in `chrome.storage.sync`:

- `vocabHighlightEnabled`: boolean, default `true`;
- `vocabOrigColor`: English Level 5+ color, default `#FFD54F`;
- `vocabTransColor`: Chinese counterpart color, default `#80DEEA`.

Popup labels:

- Simplified Chinese: `高阶词汇标色`
- Traditional Chinese: `高階詞彙標色`
- English: `Highlight advanced vocabulary`

Color controls:

- Simplified Chinese: `英文高阶词颜色`, `中文对应词颜色`
- English: `English advanced-word color`, `Chinese counterpart color`

The two colors are independently configurable. They may be set to the same value by the user.

For branch/test migration, if `vocabHighlightEnabled` is absent but the prototype key `vocabBoldEnabled` exists, its boolean value may be used once as the initial enabled state. The old key is not the source of truth going forward.

Toggling the feature or changing either color applies live without reloading YouTube and without re-requesting cues or translations.

## Preview

The popup preview must visibly demonstrate the feature. Replace the ineffective `The quick brown fox` vocabulary demo with a sentence that contains a known Level 5+ token, for example:

`The policy may exacerbate inequality.`

Chinese preview:

`这项政策可能会加剧不平等。`

With highlighting enabled, `exacerbate` uses `vocabOrigColor` and `加剧` uses `vocabTransColor`. With highlighting disabled both lines use their normal subtitle colors.

The preview itself performs no translation request.

## Translation-engine switching

Changing between YouTube translation, Google translation, Auto, or BYO must not create vocabulary-specific network work.

The existing engine-change/recue logic remains authoritative. Vocabulary coloring only runs when the normal rendering pipeline receives source/translated text.

Repeated engine switching must therefore satisfy these invariants:

- no vocabulary-generated `chrome.runtime.sendMessage({type: "translate"...})` calls;
- no observer watching and re-writing the same subtitle subtree;
- no accumulation of vocabulary timers/listeners on every switch;
- stale translation responses from an old engine cannot repaint vocabulary styling for the new engine;
- video playback and cue progression continue normally.

## TTS, copy, selection, and export

Color spans are presentation metadata only.

- TTS receives the same plain string as before.
- SRT/export receives plain strings only.
- Copying subtitle text produces exactly the visible textual content with no marker characters or duplicated whitespace.
- Existing select-text hold behavior remains authoritative.

## Chrome and Safari

All classification and rendering logic is shared pure browser JavaScript and must work identically in Chrome and Safari packages.

The generated lexical data and any renderer helper must be included in both package outputs.

## Testing

Use TDD. Required regression coverage includes:

1. Level 4 words retain the normal subtitle color.
2. Level 5-9 words use `vocabOrigColor`.
3. No vocabulary code applies `font-weight` or changes font size.
4. `awkward` ordinary use remains below the threshold.
5. `address` ordinary address/location sense remains below the threshold.
6. `address a problem` reaches Level 5+.
7. `exacerbate` reaches Level 5+.
8. Inflected forms map to the expected lemma.
9. Proper names, URLs, and numbers are not highlighted merely because they are absent from the lexicon.
10. Vocabulary coverage tests include a substantially larger representative Level 5+ sample than the prototype hand list.
11. Chinese local mapping colors an unambiguous known counterpart.
12. Ambiguous/missing Chinese mappings remain plain.
13. Multiple Level 5+ words can color distinct English and Chinese spans without overlap.
14. `vocabHighlightEnabled=false` leaves both subtitle lines entirely under their normal colors.
15. Changing `vocabOrigColor` and `vocabTransColor` updates the current line live.
16. Vocabulary feature code performs zero translation `sendMessage` calls.
17. Vocabulary feature code contains no observer that observes and re-writes the subtitle line subtree.
18. Repeated engine setting changes do not accumulate listeners/timers or freeze cue progression in the test harness.
19. Existing Chinese-above-English independent-position tests still pass.
20. Chrome and Safari package regression tests pass.

## Non-goals for this release

- No bolding for vocabulary emphasis.
- No font-size enlargement for vocabulary emphasis.
- No user-adjustable difficulty threshold; it remains Level 5+.
- No per-level rainbow scheme; all qualifying English words share the selected English color, and all confidently matched Chinese counterparts share the selected Chinese color.
- No dictionary popup.
- No second translation request for Chinese alignment.
- No claim of perfect word-sense disambiguation.
- No aggressive Chinese guess when local alignment is uncertain.

## Acceptance criteria

With `高阶词汇标色` enabled, every confidently classified Level 5-9 English token is rendered using the user's English highlight color while Level 1-4 text keeps the ordinary subtitle color. When an existing Chinese translation contains an unambiguous locally known counterpart, only that Chinese span uses the user's Chinese highlight color.

The feature performs **zero additional translation requests**, does not modify font weight or size, and does not use a self-triggering subtitle DOM observer. Users can change the two highlight colors and toggle the feature live. Repeated switching among translation engines does not freeze subtitles or crash the page. Chrome and Safari package the same behavior.
