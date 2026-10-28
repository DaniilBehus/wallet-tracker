**English** · [Slovenčina](../../../locales/sk/qa/docs/defects/BUG-017-password-byte-limit.md)

# BUG-017 · Password suffixes after 72 bytes are silently ignored

[← Back to README](../../../README.md#qa-evidence) · [Defect register](../../../log/BUGS.md) · [Next: report index →](README.md)

## Overview and impact

bcrypt ignored password bytes after its 72-byte limit, so distinct long passwords could authenticate as if they were the same.

## Metadata

| Field | Recorded value |
|---|---|
| Type | Defect |
| Status | **CLOSED** — current canonical register |
| Severity | High |
| Priority | Not recorded separately |
| Component | `src/auth.js` — password validation and bcrypt |
| Found / affected build | S21; exact build only where recorded below |
| Environment / frequency | Not separately recorded; do not infer a frequency from later green runs |

## Preconditions and test data

S21, isolated register/login boundary probe

## Reproduction

1. use a synthetic password of 72 ASCII `a` bytes followed by `A`; register, then login with the same 72 bytes followed by `B`.

This step restates the dated historical recipe; it is not a newly executed test.

## Expected and requirement

reject an unsupported length or distinguish accepted passwords.

## Actual observation

register 201, changed-suffix login 200. This is not arbitrary
password bypass: the first 72 bytes must be identical.

## Evidence

- [Recorded source: `src/auth.js`](../../../src/auth.js)
- [Recorded source: `public/app.js`](../../../public/app.js)
- [Recorded source: `qa/api/wallet.postman_collection.json`](../../../qa/api/wallet.postman_collection.json)
- [Recorded source: `qa/e2e/auth.spec.js`](../../../qa/e2e/auth.spec.js)
- [Complete original register, preserved as a dated archive](../../../log/BUGS-archive-before-2026-10-26.md) — find heading `BUG-017`.

## Resolution and verification

Current disposition: **CLOSED**. Register fix field: 53b310b. This status is limited to the documented finding and its own regression evidence.

TC-API-106 (72 ASCII bytes still accepted, 201), TC-API-107
(73 bytes → 400 `VALIDATION_FAILED`) and TC-API-108 (37 × `é` — 37 characters,
74 bytes → 400) in `qa/api/wallet.postman_collection.json`; TC-E2E-073 and
TC-E2E-074 in `qa/e2e/auth.spec.js` for the browser side. Both browser cases
also assert that **no** request is sent: the server's refusal contains the same
words as the client's, so a text-only assertion would pass with no rule in the
browser at all. Controls: with the server check disabled, 6 of 631 Newman
assertions fail and the 72-byte case still passes; with the client check
disabled, both browser cases fail. With both in place, Newman is 631 of 631 and
the auth file is 14 of 14 across the two viewports.

## Technical investigation and dated history

<details>
<summary>Open the original detailed report/observation</summary>

### BUG-017 · Password suffixes after 72 bytes are silently ignored · High · CLOSED

| | |
|---|---|
| Found in | S21, isolated register/login boundary probe |
| Component | `src/auth.js` — password validation and bcrypt |

**Steps to reproduce:** use a synthetic password of 72 ASCII `a` bytes followed
by `A`; register, then login with the same 72 bytes followed by `B`.
**Expected:** reject an unsupported length or distinguish accepted passwords.
**Actual:** register 201, changed-suffix login 200. This is not arbitrary
password bypass: the first 72 bytes must be identical.
**Root cause:** only a minimum character length is checked; bcrypt consumes
at most 72 bytes, which differs from JavaScript character length for Unicode.
**Decision D-045:** registration refuses a password over 72 UTF-8
bytes with a 400 and a message that says so. Login and stored hashes are left
exactly as they are. The alternative — re-hashing with a scheme that reads the
whole password — would have to run on accounts whose plaintext nobody has, so
it can only happen at the next sign-in, and until then the collision stays.
Refusing at the door removes it for every account that can still be created,
and no existing account can hold a longer password than the check now allows.
Bytes, not characters: bcrypt counts bytes, so "é" costs two and an emoji four.
**Fix:** applied in commit `53b310b`. `src/auth.js` rejects `Buffer.byteLength(password,
'utf8') > 72` in `register` with the ordinary `badRequest`, next to the existing
minimum-length check; `login` and `bcrypt.compare` are untouched. `public/app.js`
refuses the same thing before the request, counting with `TextEncoder` because
`password.length` counts characters, and names the limit in the toast.
**Regression:** TC-API-106 (72 ASCII bytes still accepted, 201), TC-API-107
(73 bytes → 400 `VALIDATION_FAILED`) and TC-API-108 (37 × `é` — 37 characters,
74 bytes → 400) in `qa/api/wallet.postman_collection.json`; TC-E2E-073 and
TC-E2E-074 in `qa/e2e/auth.spec.js` for the browser side. Both browser cases
also assert that **no** request is sent: the server's refusal contains the same
words as the client's, so a text-only assertion would pass with no rule in the
browser at all. Controls: with the server check disabled, 6 of 631 Newman
assertions fail and the 72-byte case still passes; with the client check
disabled, both browser cases fail. With both in place, Newman is 631 of 631 and
the auth file is 14 of 14 across the two viewports.
**→ Rule R14.**

</details>
