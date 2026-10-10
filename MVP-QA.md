# MVP verification

## Live Google services and browser checks

The bilingual change was verified with the existing configured Gemini model, `gemini-3.5-flash-lite`, and the actual local physics PDF `06_light.pdf` (three pages). Private PDFs and generated diagnostics remain ignored by Git.

- Backend: English overview and lesson generation returned HTTP 200. Vietnamese overview and lesson translations returned HTTP 200. Both language versions passed schema validation and protected-content comparisons, including topic/question IDs, source pages, correct answers, formula fields and delimited mathematics. A later numeric-token comparison also passed for these recorded outputs.
- Backend: real YouTube searches in English and Vietnamese returned HTTP 200. Cards use real video IDs, original titles, channels, thumbnails and available reported language metadata.
- Individual diagnostic timings: overview 3.7 seconds, lesson 6.5 seconds, overview translation 2.2 seconds, lesson translation 7.9 seconds, videos 0.4–0.5 seconds. These are observations, not guarantees.
- Browser: the default interface was English with no stored preference. Upload → overview → refraction lesson → three English-reported videos → quiz submission completed successfully.
- Browser: a submitted 5/5 quiz (10/10) was switched to Vietnamese. All five question IDs/choice positions, checked options, disabled submitted controls and score stayed with the same topic. Returning to English and Vietnamese, returning to the overview and reopening the lesson preserved the result. Backend logs showed no extra POST calls for those cached actions.
- Browser: selecting another PDF cleared the old lesson and all radio controls. A one-page PDF derived from the actual physics document generated only its dispersion topic, with source page 1 and no previous quiz selections/result.
- Browser: Vietnamese was selected before upload. The preference persisted after page navigation/reload. The English source document generated Vietnamese content, including full diacritics after the prompt clarification.
- Browser: rapid Vietnamese → English → Vietnamese changes during fresh lesson generation kept the selected document/topic. A translation was initially rejected because numbers were reordered naturally in the translated title; the invariant now preserves numeric values per field without requiring prose token order. Explicit browser retry succeeded after the fix.
- Browser: an invalid text file produced a Vietnamese error that changed to English immediately with the selector, without a Gemini request.
- Mobile: a 375 × 812 viewport override produced a 360 px content viewport after browser chrome/scrollbar sizing. The picker, topic navigation and lesson remained readable without page overflow. The lesson rendered 76 KaTeX expressions after the targeted repair, with zero `.katex-error` nodes. Screenshot: ignored `tmp/diagnostics/bilingual-mobile.png`.

## Automated checks

- TypeScript validation and production build pass.
- 55 tests pass without Google keys or live network calls.
- Coverage includes PDF stream/size/parser validation, invalid languages, source page bounds, output schemas and safe credential handling.
- Translation tests reject changed IDs, answers, source pages, formula fields, delimited math, numeric option positions and array sizes.
- Session tests cover simultaneous language requests sharing canonical content, topic-specific quiz results, per-language video caches, explicit retry, out-of-order replies, document replacement and replacement before scheduled work starts.
- Gemini overload/quota/timeouts and YouTube quota/configuration/network errors are simulated at provider boundaries. Translation failure cannot replace a successful cached language. Errors remain explicit; there is no sample fallback.
- A real generated formula used duplicate math closers instead of a closing parenthesis. A targeted display-only normalization and regression test were added; stored source content is preserved.

## Limits of this verification

- No intentional Google outage or quota exhaustion was caused. Those branches are tested with controlled failures; live outage recovery and live rate-limit behavior are not proven.
- Not every possible PDF, formula, viewport or generated translation was inspected. Structural checks cannot establish semantic equivalence of all translated prose or nonnumeric options.
- Video playback, spoken-language accuracy and complete educational relevance were not exhaustively reviewed. YouTube metadata/preferences do not guarantee actual language.
- No public deployment, persistent sessions, login/database, production abuse control or hosting-specific duration/upload limits were tested.

See [README.md](README.md) for the current setup, architecture and manual verification checklist. Historical Gemini investigation is separate in [GEMINI-DIAGNOSIS.md](GEMINI-DIAGNOSIS.md).
