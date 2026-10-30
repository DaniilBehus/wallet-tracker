[English](../../../../docs/analysis/draft-save-sequence.md) · **Slovenčina**

<!-- locale-links-v1: source-relative links rebased for locales/sk -->

<a id="draft-then-explicit-save--modular-map-and-sequence"></a>
# Návrh a následné výslovné uloženie — modulárna mapa a sekvencia

[← Späť na README](../../README.md#start-here) · [Prehľad analýzy](README.md) · [Ďalej: dátový model →](database.md)

[Otvoriť modulárnu mapu](draft-save-sequence.svg) · [Zachovaný formálny sekvenčný SVG](formal/draft-save-sequence.svg) · [Upraviteľný zdroj Mermaid](draft-save-sequence.mmd)

Viditeľný SVG zoskupuje tvorbu návrhu, ľudskú kontrolu a trvalé uloženie
s kľúčom. Blok Mermaid nižšie a zachovaný formálny SVG ukazujú podrobnú
sekvenciu; šípky modulárnej mapy vysvetľujú, nepoužívajú notáciu Mermaid.

<!-- diagram-source: draft-save-sequence.mmd -->

```mermaid
sequenceDiagram
    actor Person as Osoba
    participant UI as Kontrola v prehliadači
    participant API as Autentifikované API
    participant Service as Služba návrhov
    participant Provider as Adaptér extrakcie
    participant DB as SQLite
    Note over UI,API: Každá odpoveď nesie X-Request-Id,<br/>jedno UUID na požiadavku HTTP
    Person->>UI: Opísať jeden zaplatený výdavok v EUR, vyžiadať návrh
    UI->>API: POST /api/ai/expense-draft
    API->>Service: createDraft(userId, body, rawBytes, signal, requestId)
    Service->>Service: Validovať požiadavku a referenčný dátum, režim, súhlas v živom režime
    alt Odmietnuté pred odoslaním
        Service-->>API: ApiError (validácia, nedostupnosť, súhlas)
        API-->>UI: Pevne určená chyba, bez volania poskytovateľa a finančného zápisu
    else Platná požiadavka
        Service->>DB: Čítať vlastné kategórie, rezervovať kvótu po získaní miesta súbežnosti
        Service->>Provider: extract(prompt, schema, signal)
        alt Zlyhanie poskytovateľa alebo nepoužiteľný výstup
            Provider-->>Service: Zlyhanie, časový limit alebo nepoužiteľný výstup
            Service-->>API: Mapované na pevne určené 502, 503 alebo 504
            API-->>UI: Chyba, upraviť opis alebo zadať ručne
        else Použiteľná odpoveď vrátane odmietnutia
            Provider-->>Service: Štruktúrovaná extrakcia alebo odmietnutie
            Service->>Service: Validovať výstup, deterministická normalizácia
            Service-->>API: Výsledok s request_id rovným requestId
            API-->>UI: Výsledok 200<br/>ready alebo needs_input: upraviteľná kontrola<br/>unsupported: odmietnutie, nemožno uložiť
        end
        Note over Service,DB: Návrh AI sa neukladá. Kvóta sa môže minúť aj pri zlyhaní.<br/>Riadok logu ai_draft nesie rovnaké ID požiadavky.
    end
    opt Návrh ready alebo needs_input dorazil v aktuálnej relácii rozhrania
        Person->>UI: Skontrolovať a opraviť polia, výslovne uložiť výdavok
        Note over Person,UI: Zrušenie alebo úprava opisu<br/>zneplatní požiadavku na návrh.<br/>Výsledok unsupported sa nedá uložiť.
        UI->>API: POST /api/transactions + Idempotency-Key
        API->>API: Validovať kľúč a kanonický tvar obsahu
        API->>DB: BEGIN IMMEDIATE, vyhľadať (user_id, key)
        alt Nový kľúč, kategória a dátum sú platné
            API->>DB: Vložiť výdavok a záznam požiadavky, COMMIT
            API-->>UI: 201 vytvorený výdavok
        else Nový kľúč, kategória alebo dátum odmietnuté
            API->>DB: ROLLBACK, vyhodiť odmietnutie
            API-->>UI: 404 neznáma kategória alebo 400 dátum
        else Rovnaký kľúč a obsah, výdavok stále existuje
            API->>DB: COMMIT, nič sa nevloží
            API-->>UI: Pôvodné telo 201 + Idempotency-Replayed: true
            Note over API,DB: Upravený výdavok sa nevracia do pôvodného stavu
        else Rovnaký kľúč, odlišný obsah
            API->>DB: ROLLBACK, vyhodiť konflikt
            API-->>UI: 409 IDEMPOTENCY_CONFLICT
        else Rovnaký obsah, výdavok bol medzitým vymazaný
            API->>DB: ROLLBACK, vyhodiť konflikt
            API-->>UI: 409 IDEMPOTENCY_REPLAY_UNAVAILABLE
        end
        opt Bez spoľahlivého potvrdenia (stratená odpoveď, 5xx, časový limit)
            UI-->>Person: Výsledok neistý, polia a obsah sú zmrazené
            Person->>UI: Skontrolovať alebo zopakovať toto uloženie
            UI->>API: Rovnaký POST, rovnaký obsah, rovnaký kľúč
            Note over API,DB: Znovu vstúpi do rozhodovania podľa kľúča, pre tento kľúč nikdy druhý výdavok
        end
    end
```

**Zjednodušenia:** parsovanie JSON a autentifikácia sú zoskupené v API.
Úplné poradie spracovania HTTP a chybové kódy zostávajú v
[kontrakte §4](../../spec/ai-expense-entry.md#43-status-precedence-and-errors).
Zlyhania kontextu/kvóty sa spracujú ako ostatné chyby pred volaním
poskytovateľa; miesta pre súbežné požiadavky sa uvoľnia v `finally`.
Adaptér extrakcie znamená OpenAI v zapnutom živom režime alebo lokálne
pripravené dáta v demo režime, nie Gemini v aplikácii. Zrušenie môže prerušiť
čakanie, ale nezaručuje, že vzdialená práca vôbec nezačala.

Uloženie s kľúčom prebieha v jednej transakcii better-sqlite3 otvorenej
pomocou `BEGIN IMMEDIATE`: vetva s návratom ju potvrdí — nový výdavok alebo
opakovanie bez vloženia — a vetva, ktorá vyhodí chybu, ju vráti späť —
odmietnutá kategória či dátum a oba konflikty. Žiadny výsledok preto
nenechá zámok na zápis držaný. Kľúč alebo obsah nesprávneho tvaru sa odmietnu
kódom 400 ešte pred otvorením transakcie. Definitívne odmietnutie vráti
používateľa k upraviteľnej kontrole. Neistý výsledok zmrazí presnú operáciu;
upustenie od nej znamená, že človek musí overiť obrazovku mesiaca, nie že
nastal rollback. Nový vedomý nákup používa iný kľúč a môže vytvoriť druhý
rovnaký výdavok.

**ID požiadavky:** každá odpoveď nesie `X-Request-Id`. Služba návrhov
dostane rovnaké ID, vráti ho ako `request_id` a zapíše na riadok logu
`ai_draft`, takže podpora nájde návrh podľa ID z odpovede
([návod](../support/runbook.md#3-find-one-request-by-its-reference)).
Hlavné obrazovky pri chybe zobrazia prvých osem znakov ako *Referenciu*;
kontrola návrhu AI ich nezobrazuje.

<a id="source-and-coverage"></a>
## Zdroje a pokrytie

| Hranica | Autoritatívny zdroj / regresné pokrytie |
|---|---|
| AI-R01–02, 14, 18: oddelenie návrhu a zlyhania | [trasa AI](../../../../src/routes/ai.js), [služba návrhov](../../../../src/ai/service.js), [limity](../../../../src/ai/limits.js), [kontrakt](../../spec/ai-expense-entry.md), [testy HTTP](../../../../qa/ai/tests/integration.test.js) |
| AI-R15–16: zastaraná odpoveď, neisté uloženie a zmrazené opakovanie | [rozhranie](../../../../public/ai-expense.js), [testy stavu komponentu](../../../../qa/ai/tests/ui-state.test.js), [prehliadačová sada](../../../../qa/e2e/ai) |
| AI-R16–17: opakovanie, konflikt, záznam po vymazaní, zachovanie úprav | [trasa s kľúčom](../../../../src/routes/transactions.js), [kontrakt §8](../../spec/ai-expense-entry.md#8-keyed-save-d-035), [HTTP testy uloženia s kľúčom](../../../../qa/ai/tests/idempotency.test.js) |
| ID v každej odpovedi, znovu použité pri návrhu | [log požiadaviek](../../../../src/requestlog.js), [trasa AI](../../../../src/routes/ai.js), [služba návrhov](../../../../src/ai/service.js), [TC-PY-007, TC-PY-012](../../../../qa/python/test_request_log.py) |

**Poznámka k čítaniu zdroja:** úvodný komentár v `idempotency.test.js`
uvádza AI-R09, ale AI-R09 sa týka dátumov; jeho skutočné tvrdenia o opakovaní
pokrývajú AI-R16–17. Model sa riadi kontraktom a tvrdeniami testov.
Tento dokumentačný balík nemení žiadny normatívny súbor ani test.
