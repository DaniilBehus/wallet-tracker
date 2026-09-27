# Draft then explicit save — sequence

[← Back to README](../../README.md#start-here) · [Analysis index](README.md) · [Next: database model →](database.md)

[SVG preview](draft-save-sequence.svg) · [Editable Mermaid source](draft-save-sequence.mmd)

<!-- diagram-source: draft-save-sequence.mmd -->

```mermaid
sequenceDiagram
    actor Person
    participant UI as Browser review
    participant API as Authenticated API
    participant Service as Draft service
    participant Provider as Extraction adapter
    participant DB as SQLite
    Person->>UI: Describe one paid EUR expense; request draft
    UI->>API: POST /api/ai/expense-draft
    API->>Service: createDraft(userId, body, rawBytes, signal)
    Service->>Service: Validate request, enabled mode, live consent
    alt Rejected before dispatch
        Service-->>API: ApiError (validation / unavailable / consent)
        API-->>UI: Fixed error; no provider call or financial write
    else Valid request
        Service->>DB: Read owned categories; reserve quota after slot
        Service->>Provider: extract(description, date, refs, schema)
        alt Provider failure or invalid output
            Provider-->>Service: Failure / timeout / unusable output
            Service-->>API: Map to fixed 502 / 503 / 504
            API-->>UI: Error; edit or manual entry
        else Usable response (including refusal)
            Provider-->>Service: Structured extraction or refusal
            Service->>Service: Validate output; deterministic normalisation
            Service-->>API: ready / needs_input / unsupported
            API-->>UI: 200 editable draft; no transaction written
        end
        Note over Service,DB: Quota may be consumed on failure; no stored AI draft
    end
    opt A reviewable draft arrived in the current UI session
        Person->>UI: Review / correct fields; explicitly Save expense
        Note over Person,UI: Cancel / edit description invalidates the draft request<br/>Unsupported cannot be saved from that response
        UI->>API: POST /api/transactions + Idempotency-Key
        API->>API: Validate key and canonical payload shape
        API->>DB: BEGIN IMMEDIATE; lookup (user_id, key)
        alt New key; current category/date validation passes
            API->>DB: Insert expense + request record atomically; COMMIT
            API-->>UI: 201 created expense
        else Same key and same canonical payload; expense exists
            API-->>UI: Original 201 body + Idempotency-Replayed: true
            Note over API,DB: No insert; an edited expense is not reverted
        else Same key, different payload
            API-->>UI: 409 IDEMPOTENCY_CONFLICT
        else Same payload but expense deleted
            API-->>UI: 409 IDEMPOTENCY_REPLAY_UNAVAILABLE
        end
        opt No reliable confirmation (lost response / 5xx / timeout)
            UI-->>Person: Outcome uncertain; fields and payload frozen
            Person->>UI: Check / retry this save
            UI->>API: Same POST, same payload, same key
            Note over API,DB: Re-enter keyed decision; never create a duplicate for this key
        end
    end
```

**Simplifications:** JSON parsing and authentication are grouped in API. Full
HTTP precedence and error codes remain in [contract §4](../../spec/ai-expense-entry.md#43-status-precedence-and-errors).
Context/quota failures are handled like other pre-provider errors; concurrency
slots are released in `finally`. Extraction adapter means OpenAI in enabled
live mode or local demo fixtures, not Gemini in the application. Cancellation
may abort waiting but cannot guarantee that upstream work never occurred.

The Save decision assumes valid key and canonical shape; invalid requests are
400, a new key still validates category ownership and date bounds. API errors
roll back the database transaction. A definitive refusal returns to editable
review. An uncertain outcome freezes the exact operation; abandoning it leaves
the person to verify the Month screen, not a claim of rollback. A new deliberate
purchase uses a different key and can create a second identical expense.

## Source and coverage

| Boundary | Authoritative source / regression coverage |
|---|---|
| AI-R01–02, 14, 18: draft and failure isolation | [AI route](../../src/routes/ai.js), [draft service](../../src/ai/service.js), [limits](../../src/ai/limits.js), [contract](../../spec/ai-expense-entry.md), [HTTP tests](../../qa/ai/tests/integration.test.js) |
| AI-R15–16: stale response, uncertain save and frozen retry | [UI](../../public/ai-expense.js), [component state tests](../../qa/ai/tests/ui-state.test.js), [browser suite](../../qa/e2e/ai/) |
| AI-R16–17: replay, conflict, deletion tombstone, edit preservation | [keyed route](../../src/routes/transactions.js), [contract §8](../../spec/ai-expense-entry.md#8-keyed-save-d-035), [HTTP keyed-save tests](../../qa/ai/tests/idempotency.test.js) |

**Source-reading note:** the opening comment of `idempotency.test.js` cites
AI-R09, but AI-R09 concerns dates; its actual replay assertions cover AI-R16–17.
The model follows the contract and assertions. No normative file or test is
changed by this documentation package.
