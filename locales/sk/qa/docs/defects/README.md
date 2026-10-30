[English](../../../../../qa/docs/defects/README.md) · **Slovenčina**

<a id="full-qa-findings"></a>
# Úplné zistenia QA

[← Späť na README](../../../README.md#qa-evidence) · [Register aktuálnych stavov](../../../log/BUGS.md) · [Ďalej: testovací plán →](../test-plan.md)

Pre každé zaznamenané ID BUG, LIMIT a TRACE-AUDIT existuje jedna úplná správa. Aktuálny stav určuje výhradne [register](../../../log/BUGS.md); tieto správy zachovávajú pôvodné pozorovanie a datované vyšetrovanie. Nezaznamenané prostredie, frekvencia, priorita alebo koreňová príčina zostávajú výslovne neznáme. Archív registra spred prepracovania je [tu](../../../log/BUGS-archive-before-2026-10-26.md).

| ID / úplná správa | Zaznamenaný problém alebo hranica | Typ |
|---|---|---|
| [BUG-001](BUG-001-save-button-contrast.md) | Neviditeľné tlačidlo Save — biely text na bielom pozadí | Chyba |
| [BUG-002](BUG-002-paid-loan-counter.md) | Úplne splatený úver stále ukazuje jednu zostávajúcu splátku | Chyba |
| [BUG-003](BUG-003-pay-button-stuck.md) | Po odmietnutej platbe zostane na tlačidle Pay text zaneprázdneného stavu | Chyba |
| [BUG-004](BUG-004-bcrypt-blocks-event-loop.md) | 20 nesprávnych hesiel za sekundu znemožní používanie aplikácie všetkým | Chyba |
| [BUG-005](BUG-005-e2e-timeout-on-slow-runs.md) | Jeden test e2e prekročí časový limit pri behoch približne ~3× pomalších než obvykle | Chyba |
| [BUG-006](BUG-006-load-runner-exit-127.md) | Záťažový runner vrátil 127 po behu, v ktorom všetky prahy prešli | Chyba |
| [BUG-007](BUG-007-test-script-never-ran.md) | Testovací skript sa vôbec nespustil a sada ho označila ako úspešný | Chyba |
| [BUG-008](BUG-008-api-runner-exit-127.md) | API runner skončí s 127 pri úspešnom behu, takže prvý build CI by bol červený | Chyba |
| [BUG-009](BUG-009-segfault-on-node-20.md) | Server v CI na Node 20 spadne na segfault, takže prvý build bol červený | Chyba |
| [BUG-010](BUG-010-runner-green-on-no-server.md) | API runner skončí s 0, keď server vôbec nenaštartuje, takže CI ho označilo za úspešný | Chyba |
| [BUG-011](BUG-011-startup-database-lock.md) | Dva servery sa spustia súčasne nad jednou databázou a jeden pri štarte skončí | Chyba |
| [BUG-012](BUG-012-deferred-transaction-500.md) | Dva procesy zapisujúce do jednej databázy odpovedajú 500 | Chyba |
| [BUG-013](BUG-013-mobile-edit-overlay.md) | Panel úpravy sa otvoril pod spodnou navigáciou | Chyba |
| [BUG-014](BUG-014-short-phone-categories.md) | Kategórie sa na nízkom telefóne zmenšia na pás vysoký 18 px | Chyba |
| [BUG-015](BUG-015-uncategorised-expense-edit.md) | Úprava výdavku bez kategórie posiela nulovú kategóriu | Chyba |
| [BUG-016](BUG-016-registration-race.md) | Súbežné registrácie rovnakého e-mailu vracajú 500 | Chyba |
| [BUG-017](BUG-017-password-byte-limit.md) | Konce hesiel po 72 bajtoch sa potichu ignorujú | Chyba |
| [BUG-018](BUG-018-loan-cent-precision.md) | Veľký úver stratí jeden celý cent v zostávajúcej sume | Chyba |
| [BUG-019](BUG-019-oversized-json-error.md) | Príliš veľký JSON sa hlási ako interné zlyhanie servera | Chyba |
| [BUG-020](BUG-020-early-year-dates.md) | Platné dátumy zo skorých rokov vytvárajú chybne formátované nasledujúce dátumy | Chyba |
| [BUG-021](BUG-021-schedule-edit-ui.md) | Splátkové kalendáre sa nedajú upravovať cez rozhranie | Chyba |
| [BUG-022](BUG-022-modal-focus-trap.md) | Prekrytie výdavku neohraničuje klávesnicový fokus | Chyba |
| [BUG-023](BUG-023-race-verdict.md) | Konečný verdikt ignoroval porušenie v súbežnej registrácii | Chyba |
| [BUG-024](BUG-024-required-gate-inputs.md) | Povinné vstupy validátora mohli chýbať napriek úspešnému výsledku | Chyba |
| [BUG-025](BUG-025-race-cleanup-ownership.md) | Čistenie po race mohlo odstrániť databázu iného behu | Chyba |
| [BUG-026](BUG-026-api-pagination-validation.md) | Nebezpečné stránkovanie a ID obchádzali validáciu | Chyba |
| [BUG-027](BUG-027-json-text-conversion.md) | JSON poznámky/ikony, ktorý sa nedá previesť, vracal interné chyby | Chyba |
| [BUG-028](BUG-028-evaluator-setup-race.md) | Súbežná príprava evaluatora môže skončiť pred overovaním kvóty | Chyba |
| [BUG-029](BUG-029-evaluator-report-collision.md) | Súbežné správy evaluatora sa môžu navzájom prepísať | Chyba |
| [BUG-030](BUG-030-static-exception-validation.md) | Zastarané alebo nadbytočné výnimky statickej brány prechádzali cez C9 | Chyba |
| [BUG-031](BUG-031-static-coverage-wording.md) | Znenie statickej inventarizačnej brány nadhodnocovalo pokrytie runtime | Chyba |
| [BUG-032](BUG-032-ci-evidence-retention.md) | CI a lokálne overovanie sa rozchádzali; správy sa neuchovávali | Chyba |
| [BUG-033](BUG-033-e2e-database-isolation.md) | Hlavné E2E opakovane používalo rovnakú databázu medzi behmi a ignorovalo DB_PATH | Chyba |
| [BUG-034](BUG-034-node-native-runtime-floor.md) | Deklarovaná spodná hranica Node 22 umožňovala načítať binding SQLite vyžadujúci Node-API 10 | Chyba |
| [BUG-035](BUG-035-pagination-drift.md) | Stránkovanie podľa offsetu môže po zápise iného klienta opakovať alebo preskočiť výdavky | Chyba |
| [TRACE-AUDIT-001](TRACE-AUDIT-001-semantic-links.md) | Odchýlka verejnej sémantickej sledovateľnosti | Zistenie auditu |
| [LIMIT-001](LIMIT-001-serialised-database-work.md) | Každá požiadavka čaká za databázovou prácou — pri zápisovej záťaži 23× pomalšie | Akceptované obmedzenie |
| [LIMIT-002](LIMIT-002-unkeyed-duplicate-post.md) | Dva rovnaké POST vytvoria dva výdavky (požiadavky bez kľúča; uloženia s kľúčom vracajú uložený výsledok — D-035) | Akceptované obmedzenie |
