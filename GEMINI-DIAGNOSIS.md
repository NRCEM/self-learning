# Historical Gemini diagnosis

This document records a previous local investigation, not a current service-status report. No credentials or private PDF contents are included.

A 214,506-byte, three-page physics PDF was tested through the production analyzer, HTTP endpoint and browser.

| Path/configuration | Observed result |
| --- | --- |
| Original web request, `gemini-3.8-flash` | HTTP 503 / UNAVAILABLE after 54.626 seconds; upstream reported high demand |
| Direct production analyzer, same model and PDF | HTTP 503 / UNAVAILABLE after 3.963 seconds |
| Multipart endpoint, same model and PDF | HTTP 504 / DEADLINE_EXCEEDED after 89.639 seconds |
| Direct analyzer, `gemini-3.5-flash-lite` | Success after 3.680 seconds; valid overview schema |
| Endpoint with the updated configuration | HTTP 200 after 3.516 seconds; valid topics |
| Browser using the same PDF | HTTP 200 after 5.6 seconds; physics overview displayed |

The failure was reproduced outside the frontend. Changing only the configured model resolved it in that investigation. The current project retains `gemini-3.5-flash-lite` and does not switch models automatically. Diagnostics distinguish overload, deadline expiry and network errors, while redacting credentials from allowed upstream log fields.

These timings are individual observations, not a service guarantee. Current bilingual verification is documented in [MVP-QA.md](MVP-QA.md). Ignored local diagnostic files are not shipped as sample data or used as a fallback.
