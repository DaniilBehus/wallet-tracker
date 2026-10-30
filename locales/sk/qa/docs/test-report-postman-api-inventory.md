[English](../../../../qa/docs/test-report-postman-api-inventory.md) · **Slovenčina**

<a id="postman-api-source-inventory--2026-10-14"></a>

# Inventár zdrojov Postman API — 2026-10-14

[← Späť na README](../../README.md#qa-evidence) · [Katalóg prípadov](test-cases.md) · [Odvodený inventár](../../../../qa/docs/postman-api-inventory.json)

<a id="scope-and-result"></a>

## Rozsah a výsledok

**STATIC_SOURCE_INVENTORY / NOT_RUN.** Ide o kontrolu evidencie medzi zdrojom a prípadmi, nie o správu o vykonaní API. Opätovne používa štyri predtým revidované [mapovania Health, Token, Categories a Transactions](../../../../qa/traceability) bez ich zmeny a reviduje ďalších desať priečinkov kolekcie v jednom [dávkovom manifeste](../../../../qa/traceability/postman-api-batch.json). Zdrojom je [kolekcia Postman](../../../../qa/api/wallet.postman_collection.json); tvrdenia o prípadoch sa kontrolujú voči existujúcemu [katalógu](test-cases.md). Identity Editing, AI a syntetického importu sú v samostatnom [registri iba zo zdroja](../../../../qa/traceability/postman-api-extended-cases.json), nie v katalógu schválenom vlastníkom.

| Jednotka evidencie | Počet | Význam |
| --- | ---: | --- |
| Požiadavky kolekcie | 271 | 45 prijatých skôr + 226 revidovaných v tejto dávke. |
| Aktívne hlavné riadky TC-API | 141 | Každý má aspoň jednu väzbu asercie deklarovanej v zdroji. |
| Rozšírené prípady iba zo zdroja | 30 | 18 Editing + 12 AI/keyed; nie sú to požiadavky schválené vlastníkom. |
| Predbežné deklarácie importu | 3 | Offline syntetické údaje dodané volajúcim, nie integrácia s bankou/providerom. |

**226 nových uzlov požiadaviek** sa delí na 188 `business_assertion`, 30 `case_arrange`, 2 `case_cleanup`, 3 `supporting_control` a 3 `provisional_import`. Skorších 45 prijatých požiadaviek sú obchodné asercie, takže **kombinovaných 271** tried má počty 233, 30, 2, 3 a 3 v uvedenom poradí. Sú to triedy uzlov požiadaviek, nie počty prípadov ani úspešných testov. Login má šesť požiadaviek pokrývajúcich sedem riadkov katalógu, takže evidencia úmyselne nie je jeden k jednému. Úplný inventár nehlási neklasifikovanú požiadavku, chýbajúci hlavný prípad ani chýbajúcu rozšírenú deklaráciu; `completeApiAccounting` je true **iba pre tento štruktúrny inventár API**.

Jedna oprava pri revízii zdroja je podstatná: požiadavka s názvom `TC-API-131 · zero-spend limited category listed` je PATCH, ktorý nastavuje `monthly_limit_cents` na 20000 a kontroluje vrátené pole. Je to `case_arrange`, nie dôkaz, že sa zobrazuje kategória s nulovým čerpaním. Nasledujúce GET summary kontroluje ID kategórií, poradie a celkovú sumu a je obchodnou aserciou `TC-API-131`.

<a id="verification"></a>

## Overenie

Nižšie uvedené príkazy používajú dostupný runtime Node 22.14.0 v repozitári. Nespúšťajú server ani nevolajú API.

```text
node scripts/postman-api-inventory.js --check
node --test qa/gates/postman-api-inventory.test.js qa/gates/postman-transactions-inventory.test.js qa/gates/postman-categories-inventory.test.js qa/gates/postman-token-inventory.test.js qa/gates/postman-inventory.test.js
node scripts/traceability.js
node scripts/check.js
```

Kombinované čisté kontroly prešli **37/37** (8 nových, 29 existujúcich). Negatívne fixtures odmietajú odstránené, presunuté, pridané alebo zmenené požiadavky; drift tela/autentifikácie/prerequestu/asercie/pomocného nástroja; nesprávne alebo duplicitné ID katalógu, registra a mapovania; neznáme väzby alebo väzby nesprávnej skupiny; chýbajúci uzol nastavenia/kontroly; chybný/vnorený vstup; zastaraný generovaný výstup; a kolízie výstupu/zdroja. Pozitívne fixtures prijímajú požiadavky s odlišným telom a rovnakým zobrazovaným názvom ako odlišné úplné identity, viac požiadaviek na prípad, viac podporovaných prípadov na požiadavku, preusporiadanie a normalizáciu LF/CRLF. Sú to štruktúrne kontroly v pamäti, nie testy správania produktu. [Nový súbor kontrol](../../../../qa/gates/postman-api-inventory.test.js) a [checker](../../../../scripts/postman-api-inventory.js) obsahujú presné asercie.

Checker pripína spoločný kontext kolekcie a kontext priečinkov, úplné fingerprinty požiadaviek/eventov, hashe riadkov katalógu a štyri prijaté mapovania. Odvodený JSON obsahuje surové hodnoty SHA-256 a cesty k zdrojom relatívne k repozitáru. `reviewedClassificationsSha256` odhalí náhodný drift metadát manifestu, ale je to **kontrola vnútornej konzistencie**, nie nezávislý dôkaz, že človek zvolil správne orákulum. Úmyselná, no nesprávna reklasifikácia sa dá znovu pripnúť. Text zdrojového skriptu sa prehliada, nevykonáva, a nepodporované vnorené tvary kolekcie sa bezpečne odmietajú.

<a id="limits-and-unresolved-evidence"></a>

## Limity a nevyriešené dôkazy

- `TC-API-016` kontroluje prvé ID kategórie používateľa A, nie každé ID vo vlastníctve A. `TC-API-022` nedokazuje dátum na hranici časového pásma. `TC-API-034` nemá explicitný fixture vylúčenia mimo mesiaca ani dôkaz sekundárneho zoradenia pri rovnakom dni. `TC-API-039` nemá nezávislé spätné načítanie dokazujúce zachovanie cudzieho riadka. `limit=200` testuje hornú hranicu, nie prísľub presne 200 vrátených riadkov.
- `TC-API-047` vyberá v jednom spustení jeden scenár nasledujúceho februára; nevykoná priestupný aj nepriestupný rok. `TC-API-109` používa sumu `99999999` krát 1200, hoci katalóg hovorí „at amount ceiling“ (`100000000`). Aritmetická asercia nedokazuje tento presný fixture stropu. Asercie `forEach` v `TC-API-052/053` by na prázdnom zozname boli triviálne pravdivé bez predchádzajúcich fixtures. `TC-API-059` kontroluje cudziu platbu ako 404/nie 403 bez nezávislého spätného načítania stavu. `TC-API-060` predpokladá, že pevné ID `99999999` neexistuje, a očakáva 404.
- Tolerancia statického preusporiadania požiadaviek necertifikuje runtime predpoklady ani poradie nastavenia. Požiadavky AI/keyed kontrolujú deklarované lokálne režimy a ukladania, nie externého providera. Syntetický import je výslovne predbežný. V tejto dávke sa nespustil Newman, HTTP, produkt, prehliadač, databáza, CI ani UAT.

**Evidencia zdrojov iba pre API je úplná; celé F19 zostáva OPEN.** Skorší počet 17/25 je nezmenený. Ostatné testovacie vrstvy, runtime správanie a väzba na CI sú tu `NOT_CHECKED`. Žiadny historický štítok PASS nebol týmto inventárom povýšený ani prepísaný.

<a id="2026-10-15--targeted-login-oracle-repair-ord-104"></a>

## 2026-10-15 — cielená oprava Login orákula (ORD-104)

Nezávislá revízia ORD-103 prijala štruktúrny inventár 271 uzlov, ale **pozastavila tvrdenie o orákule všetkých 141 riadkov**: TC-API-071 používal čerstvý neregistrovaný e-mail s heslom iného účtu a TC-API-073 sa prihlásil na iný e-mail bez pozorovania resetu. Zdroj a jeho klasifikačné piny boli opravené; pôvodný záznam dávky vyššie zostáva ako história.

Priečinok Login teraz používa už registrovaný `emailA` ako `rlEmail` počas celej blokovacej sekvencie. Pokus so správnym heslom pri TC-API-071 je preto zmysluplný. Po vypršaní blokovania jedna 401 pre rovnaký účet založí nové okno. TC-API-073 sa úspešne prihlási do toho istého účtu, potom odošle päť sekvenčných požiadaviek s nesprávnym heslom, z ktorých každá musí vrátiť 401, a následne šiestu, ktorá musí vrátiť 429. Konzervatívna ochrana uplynutého času vyžaduje dokončenie týchto pozorovaní pred uplynutím pôvodného založeného okna; inak by prirodzené vypršanie mohlo vyzerať ako reset. Tým sa kontrolujú e-mailový aj klientsky IP bucket podľa pozorovania cez API, bez testovacieho endpointu resetu.

[Cielená čistá kontrola](../../../../qa/gates/login-oracle-controls.test.js) najprv zlyhala 4/4 na starom zdroji Login. Po oprave prešla 4/4: deterministický model s vymazaným počítadlom prechádza, zatiaľ čo modely bez vymazania, nesprávneho účtu a vypršaného okna zlyhávajú. Celá sada zdrojových kontrol prešla **41/41** (predchádzajúcich 37 + 4 nové); agregované `--check`, statická sledovateľnosť (280 ID katalógu / 78 definícií pravidiel) a `scripts/check.js` (8/8) prešli. Štyri predtým prijaté súbory mapovania boli nezmenené; ich odvodené JSON artefakty sa vygenerovali znovu iba preto, že sa zmenilo surové SHA-256 kolekcie.

Jedno úplné spustenie Newmana použilo existujúci `qa/api/run.js` so sanitizovaným prostredím podradeného procesu, vlastnou jednorazovou databázou a generovaným tajomstvom, vypnutým režimom AI, bez externej základnej URL a s loopback portom 52079. Nastavené `LOGIN_MAX_FAILURES=5` a `LOGIN_WINDOW_MS=12000`. Existujúce ignorované správy HTML/JUnit boli najprv skopírované do `qa/reports/ord-104-backup-2026-10-15/` a overené cez SHA-256; runner potom zapísal vlastné ignorované správy do `qa/reports/api-report.html` a `qa/reports/api-junit.xml`. Nepoužil sa skutočný účet, provider, databáza, CI ani externý endpoint.

| Miera Newmana | Vykonané | Neúspešné |
| --- | ---: | ---: |
| HTTP požiadavky | 280 | 0 |
| Asercie | 951 | 0 |
| Testovacie skripty | 274 | 0 |

280 runtime HTTP požiadaviek **nie je** 271 zdrojových uzlov kolekcie: cyklus Login a callback sondy TC-API-073 vydávajú opakované/dodatočné požiadavky. Toto úspešné lokálne spustenie podporuje opravené správanie 071/073 v uvedenom okne a fixture; necertifikuje každú inú očakávanú podmienku katalógu, CI, UAT ani všetky vrstvy F19. Celé F19 zostáva **OPEN** a 17/25 je nezmenené do nezávislej cielenej revízie a oddelených vrstiev.
