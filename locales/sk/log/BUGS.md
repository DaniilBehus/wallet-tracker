[English](../../../log/BUGS.md) · **Slovenčina**

<a id="defect-limit-and-traceability-register"></a>
# Register chýb, obmedzení a zistení sledovateľnosti

[← Späť na README](../README.md#qa-evidence) · [Index úplných správ](../qa/docs/defects/README.md) · [Ďalej: stav QA →](../docs/qa-status.md)

Toto je **jediný register aktuálnych stavov** pre 35 chýb, dve akceptované hranice návrhu a jedno zistenie auditu sledovateľnosti. Každé ID odkazuje na jednu úplnú správu. Úplná správa uchováva datované vyšetrovanie; ak starší odsek uvádza `IN PROGRESS` alebo „uncommitted“, ide o historický stav, nie dnešný stav Gitu. Úplný register spred prepracovania zostáva zachovaný [bez straty pozorovaní](BUGS-archive-before-2026-10-26.md). Pri tejto migrácii dokumentácie sa žiadny test neopakoval.

Závažnosť a priorita sú odlišné: závažnosť sa tu zaznamenáva tam, kde sa uplatňuje; priorita sa uvádza iba vtedy, ak bola osobitne zaznamenaná. `LIMIT` nie je chyba a audit sledovateľnosti je zistenie týkajúce sa dokumentácie. Zelený nesúvisiaci beh CI neuzatvára necharakterizované zlyhanie.

<a id="current-register"></a>
## Aktuálny register

| ID / úplná správa | Problém alebo hranica | Závažnosť | Stav | Zaznamenaný stav opravy |
|---|---|---|---|---|
| [BUG-001](../qa/docs/defects/BUG-001-save-button-contrast.md) | Neviditeľné tlačidlo Save — biely text na bielom pozadí | Vysoká (High) | **CLOSED / UZAVRETÉ** | opravené |
| [BUG-002](../qa/docs/defects/BUG-002-paid-loan-counter.md) | Úplne splatený úver stále ukazuje jednu zostávajúcu splátku | Vysoká (High) | **CLOSED / UZAVRETÉ** | opravené |
| [BUG-003](../qa/docs/defects/BUG-003-pay-button-stuck.md) | Po odmietnutej platbe zostane na tlačidle Pay text zaneprázdneného stavu | Stredná (Medium) | **CLOSED / UZAVRETÉ** | opravené |
| [BUG-004](../qa/docs/defects/BUG-004-bcrypt-blocks-event-loop.md) | 20 nesprávnych hesiel za sekundu znemožní používanie aplikácie všetkým | Vysoká (High) | **CLOSED / UZAVRETÉ** | opravené |
| [BUG-005](../qa/docs/defects/BUG-005-e2e-timeout-on-slow-runs.md) | Jeden test e2e prekročí časový limit pri behoch približne ~3× pomalších než obvykle | Nízka (Low) | **OPEN / OTVORENÉ** | — |
| [BUG-006](../qa/docs/defects/BUG-006-load-runner-exit-127.md) | Záťažový runner vrátil 127 po behu, v ktorom všetky prahy prešli | Nízka (Low) | **CLOSED / UZAVRETÉ** | opravené |
| [BUG-007](../qa/docs/defects/BUG-007-test-script-never-ran.md) | Testovací skript sa vôbec nespustil a sada ho označila ako úspešný | Stredná (Medium) | **CLOSED / UZAVRETÉ** | opravené |
| [BUG-008](../qa/docs/defects/BUG-008-api-runner-exit-127.md) | API runner skončí s 127 pri úspešnom behu, takže prvý build CI by bol červený | Vysoká (High) | **CLOSED / UZAVRETÉ** | opravené |
| [BUG-009](../qa/docs/defects/BUG-009-segfault-on-node-20.md) | Server v CI na Node 20 spadne na segfault, takže prvý build bol červený | Vysoká (High) | **CLOSED / UZAVRETÉ** | opravené |
| [BUG-010](../qa/docs/defects/BUG-010-runner-green-on-no-server.md) | API runner skončí s 0, keď server vôbec nenaštartuje, takže CI ho označilo za úspešný | Kritická (Critical) | **CLOSED / UZAVRETÉ** | opravené |
| [BUG-011](../qa/docs/defects/BUG-011-startup-database-lock.md) | Dva servery sa spustia súčasne nad jednou databázou a jeden pri štarte skončí | Stredná (Medium) | **CLOSED / UZAVRETÉ** | opravené |
| [BUG-012](../qa/docs/defects/BUG-012-deferred-transaction-500.md) | Dva procesy zapisujúce do jednej databázy odpovedajú 500 | Vysoká (High) | **CLOSED / UZAVRETÉ** | opravené |
| [BUG-013](../qa/docs/defects/BUG-013-mobile-edit-overlay.md) | Panel úpravy sa otvoril pod spodnou navigáciou | Stredná (Medium) | **CLOSED / UZAVRETÉ** | opravené |
| [BUG-014](../qa/docs/defects/BUG-014-short-phone-categories.md) | Kategórie sa na nízkom telefóne zmenšia na pás vysoký 18 px | Vysoká (High) | **CLOSED / UZAVRETÉ** | publikované v `2face59` |
| [BUG-015](../qa/docs/defects/BUG-015-uncategorised-expense-edit.md) | Úprava výdavku bez kategórie posiela nulovú kategóriu | Stredná (Medium) | **CLOSED / UZAVRETÉ** | a399e79 |
| [BUG-016](../qa/docs/defects/BUG-016-registration-race.md) | Súbežné registrácie rovnakého e-mailu vracajú 500 | Vysoká (High) | **CLOSED / UZAVRETÉ** | e291ea9 |
| [BUG-017](../qa/docs/defects/BUG-017-password-byte-limit.md) | Konce hesiel po 72 bajtoch sa potichu ignorujú | Vysoká (High) | **CLOSED / UZAVRETÉ** | 53b310b |
| [BUG-018](../qa/docs/defects/BUG-018-loan-cent-precision.md) | Veľký úver stratí jeden celý cent v zostávajúcej sume | Kritická (Critical) | **CLOSED / UZAVRETÉ** | bd516ac |
| [BUG-019](../qa/docs/defects/BUG-019-oversized-json-error.md) | Príliš veľký JSON sa hlási ako interné zlyhanie servera | Stredná (Medium) | **CLOSED / UZAVRETÉ** | publikované v `2face59` |
| [BUG-020](../qa/docs/defects/BUG-020-early-year-dates.md) | Platné dátumy zo skorých rokov vytvárajú chybne formátované nasledujúce dátumy | Stredná (Medium) | **CLOSED / UZAVRETÉ** | publikované · CI overené |
| [BUG-021](../qa/docs/defects/BUG-021-schedule-edit-ui.md) | Splátkové kalendáre sa nedajú upravovať cez rozhranie | Vysoká (High) | **CLOSED / UZAVRETÉ** | publikované · CI · UAT vlastníka |
| [BUG-022](../qa/docs/defects/BUG-022-modal-focus-trap.md) | Prekrytie výdavku neohraničuje klávesnicový fokus | Stredná (Medium) | **CLOSED / UZAVRETÉ** | publikované · CI overené |
| [BUG-023](../qa/docs/defects/BUG-023-race-verdict.md) | Konečný verdikt ignoroval porušenie v súbežnej registrácii | Vysoká (High) | **CLOSED / UZAVRETÉ** | publikované · CI overené |
| [BUG-024](../qa/docs/defects/BUG-024-required-gate-inputs.md) | Povinné vstupy validátora mohli chýbať napriek úspešnému výsledku | Vysoká (High) | **CLOSED / UZAVRETÉ** | publikované · CI overené |
| [BUG-025](../qa/docs/defects/BUG-025-race-cleanup-ownership.md) | Čistenie po race mohlo odstrániť databázu iného behu | Stredná (Medium) | **CLOSED / UZAVRETÉ** | publikované · CI overené |
| [BUG-026](../qa/docs/defects/BUG-026-api-pagination-validation.md) | Nebezpečné stránkovanie a ID obchádzali validáciu | Vysoká (High) | **CLOSED / UZAVRETÉ** | publikované · CI overené |
| [BUG-027](../qa/docs/defects/BUG-027-json-text-conversion.md) | JSON poznámky/ikony, ktorý sa nedá previesť, vracal interné chyby | Vysoká (High) | **CLOSED / UZAVRETÉ** | publikované · CI overené |
| [BUG-028](../qa/docs/defects/BUG-028-evaluator-setup-race.md) | Súbežná príprava evaluatora môže skončiť pred overovaním kvóty | Vysoká (High) | **CLOSED / UZAVRETÉ** | publikované · CI overené |
| [BUG-029](../qa/docs/defects/BUG-029-evaluator-report-collision.md) | Súbežné správy evaluatora sa môžu navzájom prepísať | Vysoká (High) | **CLOSED / UZAVRETÉ** | publikované · CI overené |
| [BUG-030](../qa/docs/defects/BUG-030-static-exception-validation.md) | Zastarané alebo nadbytočné výnimky statickej brány prechádzali cez C9 | Stredná (Medium) | **CLOSED / UZAVRETÉ** | publikované · CI overené |
| [BUG-031](../qa/docs/defects/BUG-031-static-coverage-wording.md) | Znenie statickej inventarizačnej brány nadhodnocovalo pokrytie runtime | Stredná (Medium) | **CLOSED / UZAVRETÉ** | publikované · znenie statickej kontroly overené |
| [BUG-032](../qa/docs/defects/BUG-032-ci-evidence-retention.md) | CI a lokálne overovanie sa rozchádzali; správy sa neuchovávali | Stredná (Medium) | **CLOSED / UZAVRETÉ** | publikované · artefakty CI overené |
| [BUG-033](../qa/docs/defects/BUG-033-e2e-database-isolation.md) | Hlavné E2E opakovane používalo rovnakú databázu medzi behmi a ignorovalo DB_PATH | Stredná (Medium) | **CLOSED / UZAVRETÉ** | publikované · CI overené |
| [BUG-034](../qa/docs/defects/BUG-034-node-native-runtime-floor.md) | Deklarovaná spodná hranica Node 22 umožňovala načítať binding SQLite vyžadujúci Node-API 10 | Vysoká (High) | **CLOSED / UZAVRETÉ** | publikované · CI overené |
| [BUG-035](../qa/docs/defects/BUG-035-pagination-drift.md) | Stránkovanie podľa offsetu môže po zápise iného klienta opakovať alebo preskočiť výdavky | Stredná (Medium) | **CLOSED / UZAVRETÉ** | publikované · CI overené |
| [TRACE-AUDIT-001](../qa/docs/defects/TRACE-AUDIT-001-semantic-links.md) | Odchýlka verejnej sémantickej sledovateľnosti | — | **CLOSED / UZAVRETÉ** | publikované · statické odkazy overené |
| [LIMIT-001](../qa/docs/defects/LIMIT-001-serialised-database-work.md) | Každá požiadavka čaká za databázovou prácou — pri zápisovej záťaži 23× pomalšie | — | **ACCEPTED / AKCEPTOVANÉ** | — |
| [LIMIT-002](../qa/docs/defects/LIMIT-002-unkeyed-duplicate-post.md) | Dva rovnaké POST vytvoria dva výdavky (požiadavky bez kľúča; uloženia s kľúčom vracajú uložený výsledok — D-035) | — | **ACCEPTED / AKCEPTOVANÉ** | — |

<a id="current-dispositions--2026-10-19"></a>
## Aktuálne rozhodnutia — 2026-10-19

Toto datované zosúladenie je zachované v [archíve pôvodného registra](BUGS-archive-before-2026-10-26.md#current-dispositions--2026-10-19). Je zdrojom aktuálnych stavov uvedených vyššie pre aplikáciu zostavenú na `7b1cb328` a jej konkrétne dôkazy; netvrdí, že táto úprava dokumentácie spustila produkt. Neskoršie UAT vlastníka pre BUG-021 a publikované dôkazy CI sú uvedené v jeho [úplnej správe](../qa/docs/defects/BUG-021-schedule-edit-ui.md). BUG-005 zostáva **OPEN lokálne s nepreukázanou príčinou**; verejná Issue #5 je uzavretá a ponecháva si protirečivý štítok `state:open`. Navrhovaná oprava metadát je súkromná a **nebola použitá**.

<a id="historical-evidence-and-interpretation"></a>
## Historické dôkazy a ich interpretácia

- [Úplný pôvodný register a datované dodatky](BUGS-archive-before-2026-10-26.md): všetky pozorovania, merania, komentáre a dátumy spred prepracovania zostávajú dostupné.
- [Stav QA](../docs/qa-status.md) oddeľuje lokálne testovacie dôkazy, publikované CI, UAT vlastníka a akceptované medzery.
- [Testovací plán](../qa/docs/test-plan.md) definuje vývojárske brány, brány vydania a UAT vlastníka.

Autoritou pre stav v dokumentácii je iba táto stránka. Úplné správy pre kontext uvádzajú svoj stav v čase migrácie; ak sa externá Issue alebo datovaný odsek líši, pred zmenou tohto registra zosúlaďte dôkazy.
