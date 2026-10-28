[English](../../../../qa/docs/test-report-contract.md) · **Slovenčina**

<a id="openapi-and-real-response-checks--local-report"></a>

# Kontroly OpenAPI a skutočných odpovedí — lokálna správa

[← Späť na README](../../README.md#qa-evidence) · [Sprievodca API a požiadavky](../../docs/api/README.md) · [Ďalej: kontraktové prípady →](test-cases.md#contract-checks--openapi-and-real-http)

Zaznamenané 2026-09-28 UTC na lokálnom pracovnom strome založenom na
`efa1c11bab1b6cceac5e112cbe195e89b2ff2440`. Ide o lokálny dôkaz,
nie o nový výsledok GitHub CI, UAT vlastníka ani meranú kvalitu modelu.
Historické správy zostávajú nezmenené. Workflow API má iba dva ďalšie
lokálne kroky; v kontrolnom bode 2026-09-28 publikovanie a vykonanie na
GitHube ešte čakali. Základ `b270355c8c850282b10cc0a7bdeb81c88b784765`
bol publikovaný 2026-10-08; validačný výsek nižšie zostáva lokálny
a necommitnutý.

Skorší lokálny validačný bod (2026-10-09, necommitnutý): rozšírený
kontraktový príkaz prešiel **14/14 testami a 335 validovanými skutočnými
HTTP odpoveďami**. Pozri [cielenú správu o validácii API](test-report-api-validation.md)
pre nové dôkazy negatívne pred opravou/pozitívne po nej. Datovaná matica
2026-09-28 a meranie 244 odpovedí nižšie zostávajú historické, nie súčasné
počty.

Aktuálny lokálny kontrolný bod (2026-10-10, necommitnutý): **15/15 testov
a 340 validovaných skutočných HTTP odpovedí**. Pridaná
[správa o dátumových hraniciach](test-report-date-boundaries.md) zaznamenáva
kontroly štvormiestneho roka a pretečenia plánovaných platieb; historické
počty vyššie sa neprepočítavajú.

<a id="scope-and-environment"></a>

## Rozsah a prostredie

Windows, Node 24.13.1, npm 11.8.0, Python 3.13.15 z existujúceho virtuálneho
prostredia; Playwright Chromium a Selenium headless Chrome. Projekt stále
sľubuje Node 22+, nie iba 24. Jedinou opravou architektúry je zastarané
znenie Node 20+ na už existujúce minimum engine balíka 22+ s príslušným
SHA256; nemení sa žiadne obchodné pravidlo ani zmrazená akceptácia kategórií.

[Dokument OpenAPI](../../../../spec/openapi.json) pokrýva explicitné trasy
skutočného servera a pripojených routerov. Cielený skener inventára
dokumentuje podporovanú syntax a odmieta nepodporované formy deklarácií.
Swagger Parser validuje schému/lokálne referencie; samostatné kontroly
vynucujú sémantiku, ktorú jeho validátor Swagger2 nepoužíva pre OpenAPI3.

[Kontraktové testy](../../../../qa/contract/contract.test.js) spúšťajú dva skutočné
lokálne servery (vypnutý režim a pripravené demo). Každý používa dočasný
súbor SQLite, nové syntetické účty, náhodné tajomstvo JWT, povolené
premenné prostredia a dočasný port iba na loopbacku. Nenačítava sa `.env`
ani existujúca databáza; zdedené kľúče providera a živá konfigurácia
nemôžu vybrať živého providera. Existujúca sieťová ochrana sa načíta
pred aplikačným kódom. Demo factory sa importuje bez spustenia trvalého
demo launchera.

Prísny Ajv8 s formátmi validuje skutočný vybraný stav/médium/hlavičku/telo,
bez konverzie typov, predvolených hodnôt, odstránenia polí alebo záložnej
schémy. Pridáva sa iba neškodná anotácia príkladu OpenAPI. Zachytenia/logy
zostávajú v RAM, nie v sledovanom JSON; asercie nezverejňujú hodnoty
odpovedí. Validácia kontroluje nemennosť zachytení a vyžaduje úspech
pri každej operácii, nie iba odmietnutie chýbajúcej autentifikácie.

<a id="observed-status-matrix"></a>

## Pozorovaná matica stavov

`check:openapi`: PASS 19/19 operácií odvodených zo zdroja, 273 lokálnych
referencií.
`test:contract`: PASS 11 pomenovaných testov, 244 validovaných skutočných
HTTP odpovedí, 19/19 operácií s aspoň jednou pozorovanou 2xx. Súčet
požiadaviek obsahuje nastavenie testov; nie je počtom testovacích prípadov
ani produkčnej prevádzky.

| Operácia | POZOROVANÉ | Zdokumentované NEVYKONANÉ |
|---|---|---|
| DELETE /api/transactions/{id} | 204,400,401,404 | 413,500 |
| GET /api/ai/capabilities | 200,401 | 400,413,500 |
| GET /api/categories | 200,401 | 400,413,500 |
| GET /api/health | 200 | 400,413,500 |
| GET /api/schedules | 200,401 | 400,413,500 |
| GET /api/settings | 200,401 | 400,413,500 |
| GET /api/summary | 200,400,401 | 413,500 |
| GET /api/transactions | 200,400,401,404 | 413,500 |
| PATCH /api/categories/{id} | 200,400,401,404 | 413,500 |
| PATCH /api/schedules/{id} | 200,400,401,404,409 | 413,500 |
| PATCH /api/schedules/{id}/pay | 200,400,401,404,409 | 413,500 |
| PATCH /api/transactions/{id} | 200,400,401,404 | 413,500 |
| POST /api/ai/expense-draft | 200,400,401,422,429,503 | 403,413,500,502,504 |
| POST /api/auth/login | 200,401,429 | 400,413,500 |
| POST /api/auth/register | 201,400,409,413 | 500 |
| POST /api/categories | 201,400,401,409 | 413,500 |
| POST /api/schedules | 201,400,401,404 | 413,500 |
| POST /api/transactions | 201,400,401,404,409 | 413,500 |
| PUT /api/settings | 200,400,401 | 413,500 |

AI 503 znamená pozorované `AI_UNAVAILABLE`, nie zaneprázdneného providera.
Tri stavy návrhu 200 ready/needs_input/unsupported sa vykonali s pripravenými
fixtures. Súhlas so živou službou 403, upstream 502/504 a `AI_PROVIDER_BUSY`
503 sú zdokumentované, nie pozorované touto offline sadou. Všeobecná 500
sa úmyselne nevyvoláva. AI tu nezapisuje výdavky; počítadlá kvót sa môžu
meniť. Rozpočtové testy pokrývajú null/nulu/strop a všetky štyri
nezávislé celkové/kategóriové stavy.

<a id="validator-controls-not-production-defects"></a>

## Kontroly validátora, nie produkčné chyby

Každá kontrola zachytenia najprv prejde na skutočnom HTTP základe, zmení
iba kópiu, overí konkrétny typ/kľúčové slovo odmietnutia, potvrdí
neprítomnosť mutácie a znovu hashuje/validuje nezmenený originál.
Uložené bajty kontraktu sú pred testovacím príkazom aj po ňom nezmenené.
Netvrdí sa produkčná mutácia ani vymyslená chyba.

| Poškodenie kópie | Vyžadované zlyhanie |
|---|---|
| Odstránenie sumy výdavku | body / required |
| Nahradenie celočíselnej sumy reťazcom | body / type |
| Vymyslenie enumu stavu limitu | body / enum |
| Pridelenie kódu CONFLICT stavu 401 | body / enum |
| Odstránenie Retry-After pri 429 | header |
| Výber nezdokumentovanej 418 | status |
| Nahradenie média JSON text/plain | media |
| Vloženie obsahu pri 204 | empty204 |

Kontroly inventára vynechajú health alebo zmenia pay PATCH na POST a musia
zlyhať pri parite. Kontroly skenera pridávajú citované, all/chained/computed/
dynamic a whitespace formy trás: podporované statické formy zväčšia
inventár a zlyhajú pri parite; nepodporované formy zlyhajú explicitne.
Čistá skopírovaná matica pokrytia obsahujúca iba 401 pre jednu operáciu
zlyhá pri bráne úspechu; nie je to falošné HTTP pozorovanie.

Prvé čiastočné spustenie implementácie malo dve chyby testovacieho rámca
(vyhľadávanie súhrnu použilo id namiesto category_id; kontrola správy
odmietnutia nesúhlasila). Obe boli opravené v kóde QA. Žiadne produkčné
správanie ani asercia sa neoslabili.

<a id="dependencies-and-audit-delta"></a>

## Závislosti a zmena auditu

Tri presné piny iba pre vývoj: `@apidevtools/swagger-parser@12.1.0`,
`ajv@8.20.0`, `ajv-formats@3.0.1`. Parser13 by zvýšil sľúbené minimum
Node; parser12/ref-parser14.0.1 zostáva kompatibilný. Produkčné záznamy
lock súboru sú sémanticky nezmenené. Existujúce Ajv6.15.0/traverse0.4.1,
ktoré používa Newman, sa presunuli pod har-validator bez zmeny verzie;
koreňové Ajv8/traverse1 sú nové vývojové nástroje.

Audit závislostí pred inštaláciou a po nej zachoval rovnakých 21 názvov
balíkov s upozorneniami: 8 stredných, 12 vysokých, 1 kritický; zmena grafu
nepridala žiadne nové upozornenie. To neznamená, že strom závislostí
neobsahuje zraniteľnosti. Nespustila sa oprava auditu ani nesúvisiaci
upgrade. Gitleaks nie je lokálne dostupný; netvrdí sa sken tajomstiev
celej histórie.

<a id="full-local-regression"></a>

## Úplná lokálna regresia

Všetkých dvanásť príkazov sa úspešne dokončilo 2026-09-28 UTC. Jediné
preskočenie je existujúci prípad privilégií Windows symlinku súboru
v AI sade; uvádza sa nižšie. Príkaz Playwright používa dvoch workerov bez
zmeny výberu testov, asercí alebo opakovaní. k6 nie je súčasťou tohto behu.

| Príkaz | Skutočný výsledok |
|---|---|
| npm run check | PASS: 8 brán, 0 preskočených/neúspešných |
| npm run check:openapi | PASS: 19/19 operácií zdroja, 273 lokálnych referencií |
| npm run test:contract | PASS: 11/11 testov, 244 skutočných HTTP kontrol, vrátane kontrol skopírovanej matice iba so 401 |
| npm run test:db | PASS: 6/6 |
| npm run test:api | PASS: 271 požiadaviek, 939 asercí, 271 vykonaných skriptov, nula zlyhaní/chýb skriptov |
| npm run test:python | PASS: 27/27 položiek pytest |
| npm run test:e2e -- --workers=2 | PASS: 186/186, 93 scenárov v dvoch viewportoch |
| npm run test:race | PASS: 120 párov na scenár; všetky počty porušení invariantov sú nula |
| npm run test:ai | 236 PASS, 1 preskočený, 0 neúspešných; spolu 237 |
| npm run eval:ai | PASS: režim fixture, 116/116 riadkov; MODEL_QUALITY=NOT_MEASURED |
| npm run test:ai:e2e | PASS: 50/50, loopback fake adaptér a pripravené demo |
| npm run test:selenium | PASS: 11/11 položiek pytest v headless Chrome |

Preskočenie AI: symbolické odkazy na súbory N1.4b vyžadujú privilégium
na tomto účte Windows; kontroly directory junction a hard linku sa spustili
a prešli. Samostatné integračné/prehliadačové testy AI skúšajú skutočný
adaptér s loopback fake, aj keď názvy testov hovoria o živom režime;
žiadny nie je volaním skutočného providera.

Race runner nameral dva riadky bez kľúča vo všetkých 120 pároch
duplicitného POST. Tento scenár je výslovne meraný, nie asercia
idempotencie. Registračné páry boli jeden 201/jeden 409 bez porušení;
výsledky pay/edit a edit/delete boli súdržné vrátane úmyselne vynúteného
poradia edit-first.

Generované správy (Newman HTML, pytest XML, výstup prehliadača, súhrny
fixture a race) sú ignorované lokálne artefakty, nie nové sledované
zachytenia. Existujúce API/race/e2e runnery používali svoje identifikované
syntetické databázy; v tomto testovacom checkoute neexistovala skutočná
predvolená databáza wallet ani `.env`.

<a id="limitations"></a>

## Obmedzenia

- Lokálne výsledky nie sú GitHub CI_GREEN ani výsledok publikovania.
  Nové kroky CI zachovávajú existujúcu úlohu API, úlohy/oprávnenia/spúšťače;
  surové zachytenia sa nenahrávajú ako dôkazy.
- Brána parsera nie je testom runtime odpovedí; HTTP test nedokazuje
  každý zdokumentovaný stav ani každú možnú kombináciu obchodných vstupov.
- Hodnotenie fixture meria aplikáciu/evaluátor, nie LLM. Kvalita skutočného
  providera, platené volania a správanie živých chýb zostávajú nemerané.
- Netvrdí sa opakovanie k6, penetračný test, akceptácia na skutočnom
  zariadení/vo viacerých prehliadačoch/UAT ani sken tajomstiev celej
  histórie. Existujúce upozornenia na závislosti zostávajú.
- Bežné opakovanie výdavku bez kľúča môže zdvojiť riadky; zaplatenie
  plánovanej platby tiež úmyselne nie je idempotentné. Kontrakt výdavku
  s kľúčom je samostatný.
- Hraničný prípad year10000 pre next_due na úrovni zdroja je zverejnený,
  nie zopakovaný cez HTTP ani ticho opravený v produkcii v rámci tejto
  validačnej vrstvy.

Hlavný katalóg má 280 aktívnych ID a 515 vykonaní vrstiev (512 súčasných
lokálnych, 3 historické k6). Jeho 11 kontraktových položiek sa nerozširuje
na 244 prípadov; iterácie race a samostatný register/korpus AI sa
nepridávajú k tomuto súčtu.
