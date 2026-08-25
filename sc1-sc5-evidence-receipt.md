# SC1-SC5 Cloud Evidence Receipt

Overall status: `BLOCKED`

Evaluated commit: `d3bf4eeda9f2db139804495afb24c008c1a40445`

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

## Failure categories

| Category | Count | Runs |
| --- | ---: | --- |
| `REMOTE_DISPATCH_PROHIBITED` | 1 | `blocked-preflight-001` |

## Failure details

| Run | Category | Reason code | Diagnostics | Workflow | Raw artifacts |
| --- | --- | --- | --- | --- | --- |
| `blocked-preflight-001` | `REMOTE_DISPATCH_PROHIBITED` | `UNSAFE_PUBLISHED_ARTIFACTS` | {"diagnostic_codes":["NOT_AUTHORIZED_TO_DISPATCH","NOT_AUTHORIZED_TO_PUSH","NO_TARGET_OBSERVATIONS"]} | not dispatched | `artifacts/preflight-control-evidence.json` |

## Blocked/not-tested scenarios

| Status | Record | Criteria | Counts toward target | Workflow | Raw artifacts |
| --- | --- | --- | --- | --- | --- |
| `BLOCKED` | `blocked-preflight-001` | preflight control | no | not dispatched | `artifacts/preflight-control-evidence.json` |

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
