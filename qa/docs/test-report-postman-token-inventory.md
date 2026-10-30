**English** · [Slovenčina](../../locales/sk/qa/docs/test-report-postman-token-inventory.md)

# Token-handling Postman inventory — bounded F19 family

[← Back to README](../../README.md#qa-evidence) · [Current Token inventory](postman-token-inventory.json) · [Next: Health pilot →](test-report-postman-inventory.md)

**2026-10-13; local, uncommitted checkout at HEAD `b270355`.** The accepted [standalone validator](../../scripts/postman-inventory.js) was reused unchanged. This report covers only folder `02 · Token handling` and catalogue section `## API · Token handling`: five requests, five cases TC-API-010–014, five reviewed declaration edges. It is not a Newman run, a new PASS result, full F19 coverage, remote CI evidence or owner acceptance.

## Reviewed source links

The [reviewed mapping](../traceability/postman-token.json) pins each exact folder/name/method/raw-URL selector, the full request/event fingerprint, the shared collection helper/auth context, a case-row fingerprint and a meaningful test marker. The [derived JSON](postman-token-inventory.json) was regenerated from the unchanged collection/catalogue and that mapping; it says `PARTIAL_STATIC_SOURCE_INVENTORY`, `NOT_RUN`, `NOT_CHECKED`, and has no declared-only or source-only gap **inside this five-case scope**. Request order and LF/CRLF are not identity.

| Case | Source-reviewed oracle and limit |
|---|---|
| TC-API-010 | `GET /api/categories` overrides inherited bearer auth with `noauth`, has no Authorization header and calls `expectError(401, 'UNAUTHORIZED')`. |
| TC-API-011 | Same route sends the explicit `Token` scheme rather than `Bearer` and expects 401. |
| TC-API-012 | A prerequest script changes the last signature character; the test compares unchanged header/payload and a changed signature string, then expects 401. This was inspected, **not executed** here. |
| TC-API-013 | The collection checks a JWT-shaped value, a numeric `exp` earlier than `Date.now()`, then 401. [Runner source](../api/run.js) constructs a token with an expiry ten days in the past and injects it as `tokenExpired`. In its self-managed-server mode, it uses the same `SECRET` for signing and the child server. An external `QA_BASE_URL` is a different mode and does not prove a matching secret. The runner is **not** one of the validator's three fingerprinted inputs: this paragraph is separate read-only source inspection, not a new automatic runner guard. |
| TC-API-014 | A newly registered user B's bearer token requests transactions and asserts 200, `total: 0` and empty items. At this early point user A has not been populated with a transaction; this is **not** a complete populated-A cross-user isolation test. |

The collection-level `expectError` helper checks response status, error schema/code and non-500; `expectOk` checks status and response schema. A static edge is still not automatic semantic proof of every catalogue sentence or behavior of auth middleware on other routes.

## Commands and controls

Using local Node 22.14.0:

- `node scripts/postman-inventory.js --collection qa/api/wallet.postman_collection.json --catalogue qa/docs/test-cases.md --mapping qa/traceability/postman-token.json --output qa/docs/postman-token-inventory.json` generated **5 requests / 5 cases / 5 edges**, static `NOT_RUN`.
- `node --test qa/gates/postman-token-inventory.test.js`: **6/6 PASS**. In-memory negatives reject unknown/nonpilot IDs, missing edge/row, removed/moved request, altered Authorization header, altered corruption prerequest or numeric-exp assertion, duplicate selector/annotation and empty/malformed inputs. Positive controls accept request reorder, LF/CRLF and a legitimate second request for one case.
- `node --test qa/gates/postman-inventory.test.js`: unchanged Health controls **8/8 PASS**. The derived Token JSON was deep-compared to a fresh build from source bytes.

Collection SHA-256: `2f231d50879f2264bd904cc4a12577ab47474147a9687b4fb0f61907fd4f120b`; catalogue: `a2d1ff0cb206113ac82ec8f6014a5d17d7627265a26602dd6cb81f52962b512d`; Token mapping: `2928afc2eb72d499803237b0420088aa8ece8f9e63b65b61725c10ca053f4bca`; generated Token JSON: `cb39d06ef73e22b92d939c279141b5a121cf791f90987fff6b6c6498640449c4`. Separately inspected `qa/api/run.js` SHA-256: `d918fcbaa5255be13771840af1d5709665e886bcbd05feac0e83ae2bb8c7af0c` — its hash is recorded for provenance, not enforced by this validator.

No collection script, catalogue row, runner, validator, product code or CI file was edited. Historical PASS rows remain historical. Other API families and other test layers are `NOT_CHECKED`; full F19 remains OPEN, and no commit or push was made.
