[English](../../../docs/testing.md) · **Slovenčina**

<a id="running-the-tests"></a>
# Spúšťanie testov

[← Späť na README](../README.md#qa-evidence) · [Ďalej: testovací plán →](../qa/docs/test-plan.md)

Rozdiel medzi datovanými výsledkami, týmto nezakomitovaným zdrojovým stromom, pripravenosťou vydania a prijatím vlastníkom vysvetľuje [aktuálny stav QA](qa-status.md).

Najprv nainštalujte závislosti aplikácie pomocou `npm ci`. Použite stabilný Node.js `^22.14.0 || >=23.6.0` s Node-API 10+; nainštalovaný binding SQLite toto API vyžaduje. Ochrana runtime odmietne nepodporované verzie ešte pred načítaním natívnej knižnice alebo vytvorením databázového priečinka. CI fixuje presnú verziu 22.14.0 na overenie spodnej hranice kompatibility, nie ako bezpečnostné odporúčanie; pri bežnom používaní zvoľte aktuálne opravené podporované vydanie LTS. Potrebujete aj Python 3.12+ pre pytest, Chromium pre Playwright a Google Chrome pre Selenium. Prehliadač nainštalujte pomocou `npx playwright install chromium` (v Linuxe `--with-deps chromium`, ak sú potrebné systémové závislosti). Pred spustením `npm test` pripravte Python pomocou príkazov nižšie. k6 sa inštaluje samostatne.

```bash
npm run check        # invariants: spec hash, no float money, testids, e2e discipline, coverage gates
npm run verify:ci -- --plan # inspect all enforced groups; every task is NOT_RUN
npm run verify:ci  # all CI groups in order; requires gitleaks and browser/Python setup
npm run test:verify # negative controls for plan, fail-fast, evidence and CI wiring
node --test qa/runtime/runtime.test.js # version/API boundaries and early native guard
npm run test:gates   # local controls for required inputs, race safety and exceptions
npm run test:dates   # pure YYYY-MM-DD bounds, year 0000, rollover and overflow controls
npm run check:openapi # schema/local refs and source-derived route/auth/response inventory
npm run test:contract # contract and supporting controls; inspect the run report
npm run test:api     # Newman collection; inspect the generated report
npm run test:import  # offline synthetic batch and test-only loopback-adapter tests
npm run test:db      # migrations against temporary databases
npm run test:python  # isolated Python/httpx API items; writes JUnit XML
npm run test:e2e     # managed phone and desktop browser projects
npm run test:e2e:runner # isolated Node controls for the main E2E database lifecycle
npm run test:selenium # headless Chrome; -- --headed shows it
npm run test:race    # two server processes, one database, concurrent writes
npm test             # legacy subset, NOT the complete CI-equivalent verification
npm run test:load    # k6; needs k6 installed separately

npm run test:ai      # offline tests; one Windows file-symlink control may skip
npm run eval:ai      # fixture evaluation; MODEL_QUALITY=NOT_MEASURED
npm run test:ai:e2e  # AI browser scenarios with a local fake provider
npm run test:a11y    # WCAG-tagged axe checks, keyboard regression, local rendered-contrast evidence
```

Nič netreba spúšťať vopred: každá vrstva spúšťa vlastný server s izolovanou databázou. Fixture pytest navyše prideľuje loopback port a tajný JWT kľúč pre každý beh. Scenáre UI používajú explicitné alebo web-first čakania namiesto ľubovoľných prestávok prehliadača; pripravenosť pri štarte sa zisťuje ohraničeným opakovaným volaním health endpointu.

Bežné `npm start` sa viaže na `127.0.0.1`, pokiaľ nie je zámerne nastavený `WALLET_HOST`; prázdna hodnota ani všeobecný `HOST` väzbu nerozširujú. Riadený runner E2E zahadzuje zdedené `WALLET_HOST`/`HOST` a pred spustením dočasnej prehliadačovej relácie vyžaduje produkčnú trojargumentovú loopback signatúru listen. [Cielená lokálna správa o modálnom okne/bindovaní](../qa/docs/test-report-modal-bind.md) odlišuje kontroly zdrojov, správanie prehliadača a hranice nasadenia.

Na cielenú regresiu stránkovania spustite `node qa/e2e-runner/run.js qa/e2e/pagination.spec.js` a `node --test qa/contract/contract.test.js`. [Lokálna správa F05](../qa/docs/test-report-pagination-consistency.md) rozlišuje posun pôvodného offsetu, voliteľné HTTP správanie kurzora a ohraničené obnovenie Month; tieto behy nenahrádzajú úplné overenie kombinovaného stromu ani vzdialené CI.

Na cielené regresie finančných zápisov a zastaraných odpovedí spustite `node qa/e2e-runner/run.js qa/e2e/double-submit.spec.js qa/e2e/month.spec.js --grep 'support_control:'` a `node --test qa/contract/contract.test.js`. [Lokálna správa F06/F10](../qa/docs/test-report-write-lifecycle.md) zaznamenáva riadené zlyhania pred opravou, lokálne výsledky a jedno nevyriešené zlyhanie fixture v úplnom behu. Tieto doplnkové prehliadačové kontroly nie sú ďalšími ID prípadov katalógu ani náhradou úplnej riadenej sady.

Na kontroly UI úpravy splátkového kalendára spustite `node qa/e2e-runner/run.js qa/e2e/schedules.spec.js --grep 'support_control:' --workers=4` a `node --test qa/contract/contract.test.js`. [Lokálna správa F09](../qa/docs/test-report-schedule-editing.md) odlišuje počiatočné zlyhanie pre chýbajúci ovládací prvok, diagnostikované zlyhanie selektora editora, opravené perzistentné správanie v prehliadači a čakajúce nezávislé brány/brány vydania. Tieto kontroly katalóg dopĺňajú, nemenia jeho číslovanie.

Hlavná sada Playwright sa musí spúšťať cez `npm run test:e2e` (alebo rovnaký riadený runner v spoločnom pláne CI), nie priamo cez `playwright test`. Nadradený proces pri každom vyvolaní spúšťa loopback server Wallet s vypnutou AI a novým dočasným priečinkom SQLite. Specifikácie vytvárajú samostatných používateľov, ale *v rámci* jedného behu zdieľajú tento jeden server/databázu aj jeho obmedzovač prihlásenia podľa IP. Nadradený proces pred odstránením výhradne vlastného predvoleného priečinka čaká na ukončenie prehliadača aj servera; nikdy neotvára ani nemaže starú `data/e2e.db` či aplikačnú `data/wallet.db`. Do potomkov sa nenačítava ani neposiela `.env`, kľúč poskytovateľa alebo cieľ externého API. Obsadený port spôsobí zlyhanie namiesto opätovného použitia cudzieho servera.

Pri zámernom prepísaní `DB_PATH` zadajte **nový** súbor `.db` v existujúcom kanonickom priečinku. Existujúce súbory, odkazy/aliasy, sprievodné súbory SQLite a cesty aplikácie/starého E2E sa odmietnu pred štartom. Runner si nový súbor rezervuje výhradne a po skončení ho volajúcemu **ponechá**; tento priečinok nikdy rekurzívne neodstráni. `QA_BASE_URL` sa odmieta; `QA_E2E_PORT` môže vybrať voľný lokálny port (predvolene 3002). Súbežné príkazy nemôžu zdieľať pevný port. Nútené ukončenie nadradeného procesu môže zanechať vlastnený dočasný priečinok, ktorý neskoršie behy automaticky neodstraňujú. [Lokálne kontroly a obmedzenia](../qa/docs/test-report-e2e-isolation.md) nepreukazujú vzdialené CI.

Na ohraničenú regresiu Save/Enter spustite `node qa/e2e-runner/run.js qa/e2e/double-submit.spec.js`; [cielená správa F22](../qa/docs/test-report-retry-busy.md) presne zaznamenáva vykonané mobilné/desktopové prípady a negatívne kontroly. CI ponecháva jedno diagnostické opakovanie Playwright, ale úspech až po opakovaní má stav `flaky` a končí tam nenulovým návratovým kódom. `retain-on-first-failure` uchováva trace prvého neúspešného pokusu. Každé vyvolanie vytvára nový ignorovaný `qa/reports/playwright-main/results-<run-id>.json`; kontrolujte jeho `stats`, výsledky testov a stavy pokusov **z daného behu**, nie starší JSON ponechaný na disku. Artefakt zlyhania e2e nahráva tento vzor JSON, HTML správu a traces na sedem dní; toto lokálne zapojenie nie je dôkazom vzdialeného nahratia.

`verify:ci` používa jeden [spoločný inventár úloh](../../../scripts/verification-plan.js) pre lokálny runner aj šesť existujúcich skupín úloh CI: kontrolu tajných údajov v histórii, API, Python, Playwright/prístupnosť, Selenium a offline AI/prehliadač. Predvolený režim neumožňuje preskočením dosiahnuť zelený výsledok: chýbajúci `gitleaks` alebo iný predpoklad spôsobí zlyhanie aktuálnej úlohy a označí všetky neskoršie ako `NOT_RUN`. `--plan` nič nespúšťa a uvádza `NOT_RUN`, nie PASS. Na ohraničenú vrstvu použite `-- --group api` alebo `-- --group python`; PASS skupiny neznamená PASS celého plánu. k6 a hodnotenie živého modelu zostávajú samostatnou meranou/autorizovanou prácou.

Runner spúšťa priamo zavedené offline/dočasné skripty. Nenačítava `.env` ani potomkom neposiela zdedenú adresu externého API, kľúč poskytovateľa alebo cestu databázy; Python zostáva voliteľný cez `PYTHON`. Každý pokus o beh vytvára krátky ignorovaný súhrn v `qa/reports/verification/` s jedinečnou identitou, HEAD, príznakom nezakomitovaných zmien a odtlačkom obsahu zdrojov. Hash pri vyvolaní pokrýva súbory evidované Gitom, vrátane neignorovaných nesledovaných súborov; nepotvrdzuje ignorované súbory, závislosti, prostredie, históriu Gitu ani neskoršie úpravy zdrojov. Do adresára dôkazov s povoleným zoznamom pre daný beh sa kopírujú iba skontrolované API HTML/JUnit, Python JUnit a race JSON. Chýbajúca alebo nebezpečná povinná správa spôsobí zlyhanie aj úspešného producenta. [Cielená lokálna správa](../qa/docs/test-report-ci-verification.md) zaznamenáva, čo sa skutočne vykonalo a čo zostáva vzdialene neoverené.

[Správa o kontrolách validátorov](../qa/docs/test-report-validator-controls.md) zaznamenáva negatívnu kontrolu pred opravou a pozitívnu po nej pre vlastnú kontrolu aj race runner. Príkaz race teraz zlyhá pri chýbajúcom dôkaze vykonania alebo porušení ktoréhokoľvek vynucovaného scenára vrátane registrácie E. Scenár D hlási duplicitné opakovania, ale zámerne iba meria: úspešný príkaz race **neznamená**, že opakovania bez kľúča sú idempotentné. Každý beh vlastní a odstraňuje iba svoj overený dočasný databázový priečinok po ukončení oboch serverov. Pevné porty 3110/3111 znamenajú, že súbežné príkazy race nie sú podporované.

Lokálna príprava vrstvy Python (Python 3.12+):

```bash
python -m venv .venv
.venv\Scripts\python -m pip install -r qa/python/requirements.txt  # Windows
npm run test:python
```

V macOS/Linux nainštalujte rovnaké závislosti pomocou `.venv/bin/python -m pip install -r qa/python/requirements.txt`. Runner rozpozná lokálne virtuálne prostredie.

Scenáre end-to-end a pytest, ktoré volajú pomocné funkcie katalógu, nesú ID (`TC-…`) zo súboru [`qa/docs/test-cases.md`](../qa/docs/test-cases.md). Pomocná funkcia pri vyvolaní odmietne neznáme ID; nevyžaduje však, aby ju vyvolával každý scenár. [Vykonateľná sledovateľnosť zostáva neúplná](qa-status.md#open-gates).

| Dôkaz | Čo tu nájdete |
|---|---|
| [`qa/docs/test-design.md`](../qa/docs/test-design.md) | Ako sa zmena mení na množinu prípadov — deväť krokov, každý s príkladom z tejto aplikácie |
| [`qa/docs/test-plan.md`](../qa/docs/test-plan.md) | Rozsah, vstupné a výstupné kritériá, riziká |
| [`qa/docs/test-cases.md`](../qa/docs/test-cases.md) | Datovaný katalóg prípadov s ID a väzbami na pravidlá/chyby; nejde o generovaný aktuálny inventár vykonateľných testov ani nový výsledok CI |
| [`docs/api/README.md`](api/README.md) | Kontrakt OpenAPI, syntetické príklady a požiadavky kontrol kontraktu |
| [`qa/docs/test-report-contract.md`](../qa/docs/test-report-contract.md) | Lokálna matica pozorovaných stavov, kontroly validátorov, výsledky regresie a obmedzenia |
| [`qa/docs/test-report-api-validation.md`](../qa/docs/test-report-api-validation.md) | Aktuálne HTTP regresie bezpečných celých čísel a prevodu textu; zachovaná kompatibilita vstupov |
| [`qa/docs/test-report-evaluator-concurrency.md`](../qa/docs/test-report-evaluator-concurrency.md) | Atómová syntetická príprava, súbežné nemenné správy a dôkazy offline regresie W9 |
| [`qa/docs/test-report-date-boundaries.md`](../qa/docs/test-report-date-boundaries.md) | Štvorciferný rozsah dátumov, odmietnutie pretečenia kalendára a dočasné HTTP dôkazy |
| [`qa/docs/test-report-runtime.md`](../qa/docs/test-report-runtime.md) | Spodná hranica Node/Node-API, skorá ochrana natívneho načítania a hranice cielených lokálnych dôkazov |
| [`qa/db/`](../../../qa/db) | Kontroly migrácie existujúcej databázy na dočasných súboroch |
| [`qa/docs/defects/`](../../../qa/docs/defects) | Úplné správy o chybách z testovacích vrstiev |
| [`qa/api/`](../../../qa/api) | Kolekcia Postman; prostredie obsahuje dve premenné bez literálov |
| [`qa/python/`](../../../qa/python) | Scenáre pytest + httpx; skutočný potomok Express, dočasné SQLite, health kontrola a JUnit XML |
| [`qa/e2e/`](../../../qa/e2e) | Špecifikácie Playwright a page objects |
| [`qa/docs/test-report-e2e-isolation.md`](../qa/docs/test-report-e2e-isolation.md) | Kontroly životného cyklu hlavnej E2E databázy a zostávajúce obmedzenia |
| [`qa/docs/test-report-retry-busy.md`](../qa/docs/test-report-retry-busy.md) | Cielené skutočné prípady Save/Enter, riadené zlyhanie pri busy a dôkazy opakovania po prvom zlyhaní |
| [`qa/docs/accessibility-baseline.md`](../qa/docs/accessibility-baseline.md) | Brána prístupnosti, lokálne dôkazy skenovania, oprava klávesnice a nevyriešené kontrastné ciele |
| [`qa/selenium/`](../../../qa/selenium) | Kontroly Selenium WebDriver + pytest s Page Objects, explicitnými čakaniami a dôkazmi zlyhania |
| [`qa/race/`](../../../qa/race) | Kontroly súbežnosti nad dvoma skutočnými serverovými procesmi |
| [`qa/load/`](../../../qa/load) | Skripty k6; každý meria rovnaký endpoint v pokoji a pod záťažou |
| [`qa/ai/`](../../../qa/ai) | Vrstva AI: falošní poskytovatelia, ochrana siete, evaluator, demo runner, korpus a fixtures |
| [`qa/docs/ai-test-plan.md`](../qa/docs/ai-test-plan.md) | Riziká AI, vrstvy a register prípadov TC-AI |
| [`qa/docs/ai-case-study.md`](../qa/docs/ai-case-study.md) | Čo testovanie AI zadávania skutočne odhalilo a čo fixtures nemôžu preukázať |

Sada end-to-end vyberá prvky iba cez `getByTestId` a `getByRole`, čaká iba cez web-first assertions a každá špecifikácia si vytvára vlastného používateľa cez API, takže nič nezávisí od poradia vykonávania. Nie sú to iba konvencie — `check.js` spôsobí zlyhanie buildu pri výskyte `.locator()` alebo `waitForTimeout`. Ďalšie tri statické brány globálne porovnávajú deklarácie trás a požiadaviek (C6), doslovné testids a adresovateľnosť cez page objects (C7) a literály stavov v zdrojoch s deklaráciami assertions (C8). Nepreukazujú, že bol vykonaný každý endpoint/stav. C9 odmieta zastarané, nadbytočné, duplicitné alebo nevysvetlené výnimky. Dôkazy runtime sú oddelené: [správa o kontrakte a matica operácií/stavov](../qa/docs/test-report-contract.md#observed-status-matrix) rozlišujú pozorované odpovede od buniek NOT EXERCISED. Výnimka 500 je nevykonaná statická medzera, nie dôkaz nemožnosti riadeného testovania 500. [Cielená správa o statických bránach](../qa/docs/test-report-static-gates.md) zaznamenáva negatívne kontroly, lokálny výsledok a hranice skenera.

Samostatný príkaz prístupnosti spúšťa vlastný offline demo server a dočasnú databázu. Zlyháva pri automaticky zistených porušeniach axe označených WCAG, pripája úplný JSON vrátane nejednoznačných výsledkov a kontroluje ohraničené správanie klávesnice a známych kontrastov plných povrchov. Jeho HTML správa a snímky zostávajú v ignorovaných `qa/reports/playwright-a11y/` a `test-results/a11y/`. Doplnenie workflow je zakomitované v lokálnom HEAD `b270355`; ani tento commit, ani tento dokument nepreukazujú čerstvo overený vzdialený beh aktuálneho nezakomitovaného stromu.

<a id="contract-checks-and-the-full-regression"></a>
## Kontroly kontraktu a úplná regresia

`npm test` stále nezahŕňa OpenAPI/kontrakt, syntetický import, AI, vyhodnotenie fixtures, Selenium ani prístupnosť; nie je ekvivalentom CI. `verify:ci` plánuje tieto vynucované vrstvy spolu s kontrolou tajných údajov v histórii. k6 navyše vyžaduje samostatnú inštaláciu a nie je vynucovanou úlohou CI. Zakomitované zapojenie workflow nie je dôkazom nového behu GitHub pre tento nezakomitovaný strom. [Testy syntetických dávok](../../../qa/import/synthetic-import.test.js) a [testy loopback HTTP adaptéra](../../../qa/import/provider-adapter.test.js) používajú dočasné offline fixtures a bežia v skupine API. Náhľad/potvrdenie pevného syntetického dema v prehliadači pokrýva [prehliadačová špecifikácia](../../../qa/e2e/synthetic-import.spec.js). Loopback adaptér existuje **iba ako testovací demonštrátor**; produkt nemá konektor externého poskytovateľa ani integráciu banky. Jeho obchodné predpoklady zostávajú [predbežné](../qa/docs/analysis-synthetic-import.md).

Testy kontraktu spúšťajú dva skutočné servery na loopback-only dočasných portoch s dočasným SQLite, náhodnými tajnými kľúčmi a prostredím s povoleným zoznamom. AI je vypnutá alebo používa pevné demo chránené proti externým sieťovým spojeniam. Zachytené údaje zostávajú v pamäti; stdout obsahuje maticu operácií/stavov, nie JWT ani surové telá. Pozri [sprievodcu API](api/README.md) a [lokálnu správu](../qa/docs/test-report-contract.md).
