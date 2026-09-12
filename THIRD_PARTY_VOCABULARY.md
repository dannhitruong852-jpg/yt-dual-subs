# Third-party vocabulary metadata

## Runtime data policy

`vocab-levels.js` ships only project-authored level metadata and rules. It does **not** bundle third-party dictionary definitions, example sentences, translations, or the user's uploaded postgraduate-exam PDF.

## Calibration reference: ECDICT

- Project: `skywind3000/ECDICT`
- License: MIT
- Relevant metadata described by the project: exam tags (including CET-4/CET-6 and IELTS), Collins/Oxford indicators, BNC frequency rank, contemporary-corpus frequency rank, and lemma/exchange information.
- Use in this project: its metadata schema and documented exam/frequency dimensions are used as a calibration reference for how future generated level tables should combine exam coverage with corpus frequency. No ECDICT dictionary definitions or translations are copied into this repository in the initial runtime table.

## Project-specific level conversion

The extension's 1–9 scale is not an official CEFR, IELTS, TOEFL, CET, or ECDICT scale. The initial hand-curated table follows the product specification:

- Levels 1–4: common through lower-B2/high-frequency upper-intermediate.
- Level 5: upper-B2/CET-6-core boundary, the bold threshold.
- Level 6: C1-entry and common advanced academic/general vocabulary.
- Level 7: higher-C1/formal/academic low-frequency vocabulary.
- Level 8: C2/rare advanced general vocabulary.
- Level 9: specialist, archaic, or highly technical vocabulary.

Context-sensitive rules may override a lemma's base difficulty for familiar-word uncommon senses. Unknown words fail conservative unless strong morphological evidence identifies a likely academic formation; that heuristic is capped at Level 5.
