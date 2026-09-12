# Third-party vocabulary metadata

## Runtime data policy

`vocab-levels.js` ships only project-authored level metadata and rules. It does **not** bundle third-party dictionary definitions, example sentences, translations, or the user's uploaded postgraduate-exam PDF.

## Calibration reference: CEFR-J / Open Language Profiles

- Project: `openlanguageprofiles/olp-en-cefrj`
- CEFR-J Vocabulary Profile: Version 1.5, compiled by Yukio Tono / Tono Laboratory, Tokyo University of Foreign Studies.
- C1/C2 extension: Octanove Vocabulary Profile C1/C2 Version 1.0.
- Terms stated by the source repository: CEFR-J vocabulary/grammar profiles may be used for research and commercial purposes without charge with proper citation; the Octanove C1/C2 profile is licensed CC BY-SA 4.0.
- Use in this project: CEFR bands are calibration evidence for the project-specific 1–9 scale. The runtime file contains project-authored derived level choices rather than copied definitions or examples.

## Calibration reference: ECDICT

- Project: `skywind3000/ECDICT`
- License: MIT.
- Relevant metadata described by the project: exam tags (including CET-4/CET-6 and IELTS), Collins/Oxford indicators, BNC frequency rank, contemporary-corpus frequency rank, and lemma/exchange information.
- Use in this project: its metadata schema and documented exam/frequency dimensions are calibration evidence for combining Chinese-exam coverage with corpus frequency. No ECDICT dictionary definitions or translations are copied into the runtime table.

## Project-specific level conversion

The extension's 1–9 scale is not an official CEFR, IELTS, TOEFL, CET, CEFR-J, Octanove, or ECDICT scale. The table follows the approved product boundary:

- Levels 1–4: common through lower-B2/high-frequency upper-intermediate.
- Level 5: upper-B2/CET-6-core reading-friction boundary; bolding starts here.
- Level 6: C1-entry and common advanced academic/general vocabulary.
- Level 7: higher-C1/formal/academic low-frequency vocabulary.
- Level 8: C2/rare advanced general vocabulary.
- Level 9: specialist, archaic, or highly technical vocabulary.

Native-speaker usage frequency acts as a correction rather than a separate official scale. Context-sensitive rules may override a lemma's base difficulty for familiar-word uncommon senses. Unknown words fail conservative unless strong morphological evidence identifies a likely academic formation; that heuristic is capped at Level 5.
