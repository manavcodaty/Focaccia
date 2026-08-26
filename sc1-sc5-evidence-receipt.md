# SC1-SC5 Cloud Evidence Receipt

Overall status: `BLOCKED`

Evaluated commit: `2bc12adc21a7e5103557278c82f3eae1b7b40c89`

Evidence completeness: 0 of 10 target observations

## Criterion counts

| Criterion | Numerator | Observed denominator | Required denominator | Status |
| --- | ---: | ---: | ---: | --- |
| SC1 | 0 | 0 | 10 | `BLOCKED` |
| SC2 | 0 | 0 | 10 | `BLOCKED` |
| SC3 | 0 | 0 | 10 | `BLOCKED` |
| SC4 | 0 | 0 | 10 | `BLOCKED` |
| SC5 | 0 | 0 | 10 | `BLOCKED` |

## Traceable results

| Criterion | Run | Status | Workflow | Raw artifacts |
| --- | --- | --- | --- | --- |
| SC1 | `validation-gate-32925825401` | `BLOCKED` | [workflow run](https://github.com/manavcodaty/Focaccia/actions/runs/32925825401) | `artifacts/validation-gate-blocked.json` |
| SC2 | `validation-gate-32925825401` | `BLOCKED` | [workflow run](https://github.com/manavcodaty/Focaccia/actions/runs/32925825401) | `artifacts/validation-gate-blocked.json` |
| SC3 | `validation-gate-32925825401` | `BLOCKED` | [workflow run](https://github.com/manavcodaty/Focaccia/actions/runs/32925825401) | `artifacts/validation-gate-blocked.json` |
| SC4 | `validation-gate-32925825401` | `BLOCKED` | [workflow run](https://github.com/manavcodaty/Focaccia/actions/runs/32925825401) | `artifacts/validation-gate-blocked.json` |
| SC5 | `validation-gate-32925825401` | `BLOCKED` | [workflow run](https://github.com/manavcodaty/Focaccia/actions/runs/32925825401) | `artifacts/validation-gate-blocked.json` |

## Failure categories

| Category | Count | Runs |
| --- | ---: | --- |
| `WORKFLOW_FAILURE` | 1 | `validation-gate-32925825401` |

## Failure details

| Run | Category | Reason code | Diagnostics | Workflow | Raw artifacts |
| --- | --- | --- | --- | --- | --- |
| `validation-gate-32925825401` | `WORKFLOW_FAILURE` | `PRE_CREATION_FAILURE` | {"diagnostic_codes":["NO_TARGET_OBSERVATIONS"]} | [workflow run](https://github.com/manavcodaty/Focaccia/actions/runs/32925825401) | `artifacts/validation-gate-blocked.json` |

## Blocked/not-tested scenarios

| Status | Record | Criteria | Counts toward target | Workflow | Raw artifacts |
| --- | --- | --- | --- | --- | --- |
| `BLOCKED` | `validation-gate-32925825401` | `SC1`, `SC2`, `SC3`, `SC4`, `SC5` | yes | [workflow run](https://github.com/manavcodaty/Focaccia/actions/runs/32925825401) | `artifacts/validation-gate-blocked.json` |

Zero target observations were recorded; this is a truthful `BLOCKED` receipt, not an empty success.

## Evidence boundary

Repeated fixture-driven runs assess controlled software repeatability only.

- real-camera capture remains unestablished
- camera QR scanning remains unestablished
- physical radio loss remains unestablished
- participant FAR/FRR/EER remains unestablished
- demographic fairness remains unestablished
- sophisticated PAD remains unestablished
- user acceptance remains unestablished
- public deployment remains unestablished

Latency is never inferred from zero or missing fields.

Only canonical stripped, structurally decoded PNG image evidence is supported; the reducer accepts only IHDR, IDAT, and IEND chunks and verifies PNG chunk framing, CRCs, exact zlib-decoded scanline structure, hash, path, media type, and attestation, but cannot independently determine whether pixel content contains secrets; visual redaction and secret review is an attested trust boundary, not automated proof.
