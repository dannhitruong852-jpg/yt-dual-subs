# Third-party vocabulary metadata

## Runtime data policy

The production package generates `vocab-data.js` from redistributable lexical metadata and then ships only compact derived fields needed at runtime: English lemma -> project level, plus a small Chinese candidate table for conservative counterpart matching. It does **not** bundle dictionary definitions, example sentences, or the user's uploaded postgraduate-exam PDF.

## Primary generated source: Words CEFR Dataset

- Project: `Maximax67/Words-CEFR-Dataset`
- Runtime input: `datasets/word_list_cefr.csv`
- Repository license: MIT.
- Upstream methodology documented by the project combines CEFR-J labels with lemma/stem/frequency analysis.
- Use in this extension: single-word CEFR-labelled entries provide the broad base vocabulary. Multi-word entries and non-lexical forms are omitted from the compact runtime table.

The extension's conversion is project-specific: A1 -> Level 1, A2 -> Level 2, B1 -> Level 3, and B2 supplies the upper-intermediate pool around the Level-5 highlighting boundary. Explicit product calibration overrides keep very common words such as `awkward` and `version` below the boundary while preserving approved Level-5 anchors such as `determine`, `essential`, `significant`, and `various`.

## Optional calibration source: ECDICT

- Project: `skywind3000/ECDICT`
- License: MIT.
- Relevant source metadata: exam tags including CET-4/CET-6, postgraduate (`ky`), IELTS, TOEFL and GRE; BNC/contemporary frequency ranks; inflection/lemma data; Chinese glosses.
- The build script accepts ECDICT as an optional additional source. When supplied, only compact exam-level signals and short Chinese surface candidates are derived; definitions and examples are not emitted.

## Project-specific 1-9 scale

This is not an official CEFR, IELTS, TOEFL, CET, postgraduate-exam, CEFR-J, or ECDICT scale.

- Levels 1-4: core through common/lower-B2 vocabulary.
- Level 5: upper-B2/CET-6-core reading-friction boundary; highlighting starts here.
- Level 6: C1-entry / advanced general-academic vocabulary.
- Level 7: higher-C1/formal/academic low-frequency vocabulary.
- Level 8: C2/rare advanced general vocabulary.
- Level 9: specialist, archaic, or highly technical vocabulary.

Context-sensitive rules can override the base lemma level for important familiar-word uncommon senses, such as ordinary `address` versus `address a problem`. Unknown words remain conservative except for a narrowly capped academic-morphology heuristic.

## User-provided postgraduate vocabulary reference

The uploaded postgraduate vocabulary PDF is used only as a private calibration/reference source for the user's learning boundary and familiar-word uncommon-sense requirements. Its copyrighted dictionary content is not redistributed in this repository or generated runtime data.
