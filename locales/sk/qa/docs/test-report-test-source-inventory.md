[English](../../../../qa/docs/test-report-test-source-inventory.md) · **Slovenčina**

<a id="current-test-source-inventory--2026-10-15"></a>

# Aktuálny inventár testovacích zdrojov — 2026-10-15

Úvodný záznam ORD-106 nižšie zostáva ako historický dôkaz. Jeho tvrdenie, že všetky nové vykonateľné cesty zlyhávajú bezpečne, bolo **nahradené** zisteniami ORD-107 o objavovaní a datovanou opravou ORD-108 na konci tejto správy.

[← Späť na README](../../README.md#qa-evidence) · [Odvodený inventár](../../../../qa/docs/test-source-inventory.json) · [Katalóg prípadov](test-cases.md)

<a id="scope-and-result"></a>

## Rozsah a výsledok

**STATIC_SOURCE_INVENTORY / NOT_RUN.** [Checker](../../../../scripts/test-source-inventory.js) skladá už prijatý [inventár zdrojov API](../../../../qa/docs/postman-api-inventory.json) s [revidovaným manifestom](../../../../qa/traceability/test-source-manifest.json) zostávajúcich testovacích zdrojov. Na objavovanie prípadov neimportuje ani nevykonáva testovacie moduly. Aktuálny výsledok má zdrojovú deklaráciu pre každé z **280 odlišných hlavných ID katalógu**:

| Hlavná skupina | Prípady | Hranica zdroja |
| --- | ---: | --- |
| API | 141 | Existujúci súhrn Postman; 271 uzlov kolekcie je iný počet. |
| Browser E2E + regresie | 90 + 3 | Hlavné súbory `qa/e2e/*.spec.js`, bez syntetického importu a samostatného AI. |
| Python + Selenium | 17 + 9 | Explicitné deklarácie `@case` a `pytest.param(...marks=case(...))`. |
| Databáza + kontrakt + záťaž | 6 + 11 + 3 | Migračné/kontraktové deklarácie a tri k6 skripty prepojené s runnerom. |

Checker prechádza **137** aktuálnych JS/Python ciest pod `qa/` a `scripts/`. Každá má odlišnú rolu, revidovaný SHA-256 celého súboru po normalizácii LF a prípadné doslovné deklarácie testov alebo väzby na hlavné prípady. Eviduje **20 explicitných identít parametrov/viewportov** vrátane troch ID bezpečnostných payloadov, tabuľky validácie Python, variantov Selenium desktop/telefón a limitov a štyroch viewportov AI rozloženia. Inštancia parametra/runtime nie je ďalším ID katalógu. Bezpečnostný cyklus má jednu doslovnú deklaráciu testu, ale tri samostatne prepojené ID katalógu.

Zdroje mimo hlavného katalógu zostávajú oddelené: 26 zdrojových súborov AI obsahuje 249 doslovných zdrojových deklarácií prepojených s existujúcim [registrom prípadov AI](ai-test-plan.md), bez tvrdenia, že každá deklarácia sémanticky spĺňa prípad registra; dva zdroje [prístupnosti](accessibility-baseline.md) majú šesť deklarácií; tri zdrojové súbory syntetického importu obsahujú 14 predbežných deklarácií. Kontraktový súbor má popri svojich 11 hlavných kontraktových prípadoch aj jeden predbežný scenár importu a tri pomenované pomocné kontroly DATE/VALIDATION. Ďalších 14 súborov pomocných kontrol má 129 doslovných deklarácií; runnery, fixtures, page objects a nástroje sú v manifeste pomenované po súboroch. [Analýza syntetického importu](analysis-synthetic-import.md) zostáva predbežná: nevyvodzuje sa integrácia so skutočnou bankou/providerom ani schválenie vlastníkom.

<a id="fail-closed-checks-and-shared-plan"></a>

## Kontroly bezpečného odmietnutia a spoločný plán

Manifest pripína presné cesty a bajty zdroja. Nové, odstránené, presunuté alebo upravené vykonateľné súbory, neanotovaný test pridaný do pripnutého súboru, zmenený riadok katalógu, chýbajúca hlavná väzba, duplicitné/neznáme/nesprávnej skupiny ID, odstránený pomocný súbor, chýbajúce rozšírenie parametrov, zmenená samostatná rola/ukazovateľ registra, chybný manifest a zastaraný generovaný JSON zlyhajú. Checker prijíma revidované väzby mnohých k mnohým a ekvivalentný text zdroja LF/CRLF. Podporované formy deklarácií sú **doslovné jednoriadkové JS názvy `test()`/`it()` a Python názvy `def test_...`**; rozšírenia cyklov a parametrov sa zaznamenávajú explicitne, nevyvodzujú sa všeobecným JS/Python parserom. Presné hashe sú dôkazom identity, nie orákulom očakávaného správania.

Spoločný [plán overenia](../../../../scripts/verification-plan.js) teraz plánuje F13 sledovateľnosť, úplné API `--check`, `--check` tohto inventára zdrojov a ich čisté kontroly pred existujúcimi runtime úlohami skupiny API. [Kontroly orchestrácie CI](../../../../qa/verify/verify-ci.test.js) odmietajú vynechanú, oslabenú, duplicitnú alebo oneskorenú bránu. Existujúce Newman, race, artefakty, závislosti workflow a ďalšie úlohy zostali zachované; CI už volá túto spoločnú skupinu API. **Tu sa spustil iba `--plan`; vzdialené CI ani celá skupina API sa nespustili.**

```text
node --test qa/gates/test-source-inventory.test.js qa/gates/traceability.test.js qa/gates/postman-inventory.test.js qa/gates/postman-token-inventory.test.js qa/gates/postman-categories-inventory.test.js qa/gates/postman-transactions-inventory.test.js qa/gates/postman-api-inventory.test.js qa/gates/login-oracle-controls.test.js
node --test qa/verify/verify-ci.test.js
node scripts/test-source-inventory.js --check
node scripts/postman-api-inventory.js --check
node scripts/traceability.js
node scripts/check.js
node scripts/verify-ci.js --plan
```

Výsledky: prešlo **68/68** čistých kontrol inventára/sledovateľnosti/Login a **13/13** kontrol orchestrácie CI; oba generované inventáre boli aktuálne; F13 hlásilo 280 ID / 78 definícií pravidiel; `scripts/check.js` prešiel 8/8. Plán hlásil `NOT_RUN` pre každú úlohu podľa zámeru. Čisté kontroly používajú mutácie v pamäti alebo vlastné izolované dočasné podradené fixtures; táto dávka nespustila produktový server, Newman, prehliadač, databázu, záťažový beh ani volanie providera.

<a id="boundary"></a>

## Hranica

Štruktúrna evidencia deklarácií je pre tento revidovaný snapshot zdroja úplná, **nie** dôkaz, že sa vykonalo všetkých 280 očakávaných správaní alebo že sú sémanticky postačujúce. Prijatý inventár API si zachováva zverejnené limity orákula. Samostatné identity zdrojov AI sa nepovyšujú na hlavné prípady katalógu ani tvrdenia o osobných zručnostiach. Celé F19 zostáva **OPEN** do nezávislej revízie a ďalších vrstiev; skorší projektový počet 17/25 sa nemení. Z lokálnych statických kontrol nevyplýva zelené CI, UAT ani vydanie.

<a id="2026-10-15--ord-108-discovery-and-config-correction"></a>

## 2026-10-15 — ORD-108 oprava objavovania a konfigurácie

Nezávislá revízia ORD-107 zopakovala dve obídenia úvodného checkera: `qa/e2e/new.spec.ts` a `new.spec.mjs` sa neobjavili a `qa/e2e/reports/new.spec.js` sa preskočil, pretože každý adresár pomenovaný `reports` bol ignorovaný. Jej izolovaný fixture našiel 0/3 ciest. Pred zmenou skenera nový čistý svedok zlyhal na `new.spec.ts` podľa očakávania. Rozpracovaná revízia tiež našla analogické obídenie cez názov `qa/e2e/__pycache__/new.spec.js`. Po oprave fixture zachytáva `.js`, `.ts`, `.mjs`, `.mts`, `.cjs`, `.cts`, `.jsx`, `.tsx`, zodpovedajúce formy `.test.*`, Python `.py` a vnorené prehliadačové špecifikácie v `reports/` a `__pycache__/`. Objavený neznámy test zlyhá pri validácii zdroja, kým nie je revidovaný; žiadny syntetický test sa nevykonal.

Podľa názvu sa vylučuje iba kanonický adresár generovaných výstupov `qa/reports/`; vnorený zdrojový adresár pomenovaný `reports` sa skenuje. `node_modules` sa vylučuje v akejkoľvek hĺbke, pretože ho vylučuje nainštalovaný Playwright collector. `__pycache__` sa skenuje: cache súbory Python `.pyc` nezodpovedajú podporovaným príponám zdroja, ale Playwright `.spec.js` tam môže byť vykonateľný. Symlinky zdroja sa odmietajú, nenasledujú. Nové názvy testov v podporovaných koreňoch zdroja sa nemôžu ticho absorbovať do aktuálneho revidovaného manifestu.

Manifest má teraz **šesť samostatných, bajtovo pripnutých záznamov konfigurácie vykonania**: `package.json`, `package-lock.json`, `pytest.ini` a koreňové konfigurácie Playwright pre main, AI a prístupnosť. Nie sú to scenáre. Checker tiež objavuje nových koreňových kandidátov `playwright[.label].config.(js|ts|mjs|mts|cjs|cts|jsx|tsx)`; koreňových a `qa/python/` alebo `qa/selenium/` kandidátov `pytest.ini`, `pyproject.toml`, `tox.ini` a `setup.cfg`. Zmenení, chýbajúci alebo noví kandidáti zlyhajú do revízie. Pripnuté skripty balíka viažu súčasné príkazy runnerov; zdroje runnerov JS/Python zostávajú v inventári zdroja. Konfigurácie sa čítajú ako bajty, ale nikdy sa neimportujú ani sémanticky nevykladajú. Ľubovoľné alternatívne názvy konfigurácie, externé CLI override a dynamické vykonanie nezastúpené v týchto ohraničených cestách zostávajú mimo tejto statickej záruky.

Regenerovaný artefakt eviduje **137 zdrojových súborov + 6 konfigurácií** (143 identít súborov), **280 hlavných ID katalógu** s rovnakými počtami skupín a **20 revidovaných identít parametrov**. Tri kontroly objavovania/konfigurácie zvýšili čistú dávku zameranú na inventár zo 68 na **71/71 PASS**; kontroly CI zostávajú **13/13 PASS**. Oba inventárne príkazy `--check`, F13 statické 280/78, `scripts/check.js` 8/8 a spoločný `--plan` prešli; všetkých 22 úloh plánu zostáva `NOT_RUN`. Sú to lokálne statické výsledky, nie dôkazy CI, prehliadača, HTTP, databázy, sémantického pokrytia, UAT ani vydania. Celé F19 zostáva **OPEN** a skorší súčet auditu 17/25 je nezmenený do nezávislej cielenej revízie.

<a id="2026-10-16--local-source-accountability-acceptance"></a>

## 2026-10-16 — lokálna akceptácia evidencie zdroja

Po obnovených kontrolách ORD-108 cielená nezávislá agentova revízia prijala opravené hranice objavovania a konfigurácie. Lokálna koordinácia potom prijala pôvodné kritérium F19 **obojstrannej evidencie zdroja** pre aktuálne revidované korene `qa/` a `scripts/`: každé z **280** aktívnych hlavných ID katalógu má väzbu na zdroj a podporované zdrojové scenáre sú prepojené alebo výslovne klasifikované. Artefakt eviduje **137 zdrojových súborov, šesť samostatných identít konfigurácie a 20 revidovaných identít parametrov**. Obnovené čisté kontroly prešli **71/71** inventár/sledovateľnosť/Login a **13/13** orchestrácia CI; oba inventárne `--check` príkazy prešli. Spoločný plán označil všetkých **22 úloh `NOT_RUN`**.

Ide o lokálnu agentovú revíziu vo fáze **CHANGED**, nie o akceptáciu vlastníka ani ľudský audit. Kritérium zdroja F19 je lokálne opravené (projektové technické nálezy **18/25 podľa počtu**, nie podľa úsilia alebo pokroku vydania). Neznamená to 280 behaviorálnych úspechov, úplné sémantické orákulá, úplné runtime vykonanie kombinovaného stromu, vzdialené CI pre presné SHA, UAT vlastníka ani pripravenosť na vydanie. Ľubovoľné alternatívne názvy konfigurácie, externé CLI override a dynamické vykonanie mimo podporovaných ciest nie sú zaručené. [Stav QA](../../docs/qa-status.md) udržiava tieto brány vydania a otvorené chyby oddelené.
