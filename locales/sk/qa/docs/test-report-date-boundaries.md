[English](../../../../qa/docs/test-report-date-boundaries.md) · **Slovenčina**

<a id="four-digit-calendar-dates--local-qa-evidence-2026-10-10"></a>

# Štvorciferné kalendárne dátumy — lokálne dôkazy QA, 2026-10-10

[← Späť na README](../../README.md#qa-evidence) · [Príkazy behov](../../docs/testing.md) · [Čisté dátumové kontroly](../../../../qa/dates/date-boundaries.test.js) · [Skutočné HTTP kontroly](../../../../qa/contract/contract.test.js)

Ide o **lokálne, necommitnuté** dôkazy na jednorazových
fixtúrach, nie výsledok GitHub CI či UAT vlastníka.
Nepoužila sa aplikačná databáza, `.env` ani poskytovateľ.
Bežná doména dátumov API zostáva proleptický gregoriánsky
kalendár v rokoch **0000–9999 vrátane**; osobitné pravidlá
referenčného dátumu AI sa nemenili.

<a id="before-and-after"></a>

## Pred opravou a po nej

| Hranica | Pred opravou | Po oprave |
|---|---|---|
| `clampToMonth(0, 2, 31)` | `0-02-29` | `0000-02-29` |
| `dayAfter('0001-01-31')` | `1-02-01` | `0001-02-01` |
| `nextDue(15, '0001-01-31')` | `1-01-15`, pred vstupom | `0001-02-15` |
| Nasledovník `9999-12-31` | Päťciferný rok `10000` | Výslovný `RangeError` s `DATE_OUT_OF_RANGE` |
| POST plánu s ďalšou splatnosťou za rokom 9999 | HTTP 201; vložený riadok | HTTP 400 `VALIDATION_FAILED`; nevloží sa riadok |
| PATCH plánu vytvárajúci takú splatnosť | HTTP 200; zmenený riadok | HTTP 400 `VALIDATION_FAILED`; starý riadok bez zmeny |
| GET s pripraveným starým hraničným riadkom | HTTP 200 s neplatnou ďalšou splatnosťou | HTTP 400 `VALIDATION_FAILED`; nevráti sa neplatný dátum |

Čistá kontrola zlyhala **2/3 pred** opravou pomocných
funkcií, potom prešla **4/4** po dokončení hraničných
a horných hodinových testov. Skutočná HTTP kontrola pred
opravou zlyhala presne s piatimi pozorovaniami: POST
201 namiesto 400 a vložený riadok; PATCH 200 namiesto
400 a zmenený riadok; starý GET 200 namiesto 400.
Po oprave prešla **1/1**. Kontraktový harness použil
autentifikovaného syntetického používateľa, loopback
server Express a dočasnú databázu SQLite; starý riadok
sa vložil iba do nej a test ho odstránil.

Všetky dátumy vytvorené pomocnými funkciami majú teraz
šírku `YYYY-MM-DD`. Pokryté zostávajú priestupný deň
roku nula, rok `0001`, prechody `0099/0100`
a `0999/1000`, skrátenie na konci mesiaca, bežné
priestupné roky a platný `9999-12-31`. `monthBounds`
a `parseDate` zachovávajú štvorciferný vstup;
`today()` dopĺňa platné roky nulami a pri roku 10000
z hodín vyhodí rovnakú chybu rozsahu. `next_due` sa
stále vypočítava, neukladá. Vytvorenie plánu ho
kontroluje pred vložením; úprava kontroluje účinnú
uloženú/požadovanú dvojicu pred aktualizáciou
v existujúcej transakcii; zoznam mapuje iba túto
identifikovanú chybu rozsahu na štandardnú odpoveď
400. Žiadny dátum sa potichu neskracuje na 9999,
nevzniká `null` ani nové výstupné pole a existujúce
riadky sa nemigrujú ani nemažú.

Celý lokálny kontraktový príkaz prešiel **15/15
testov a 340 validovaných skutočných HTTP odpovedí**
naprieč **21/21 zdrojovými operáciami**.
`npm run check:openapi` prešiel **21/21 operácií
a 298 lokálnych referencií**. Predchádzajúci
checkpoint 14/335 a staršia matica 11/244 zostávajú
historické, nie premenované na aktuálne výsledky.

Ďalšie povinné lokálne príkazy prešli na kombinovanom
strome: `test:gates` **23/23**, `check` **8/8**,
Newman `test:api` **274 požiadaviek / 945 asercí**,
`test:db` **6/6**, `test:python` **27/27**,
`test:import` **11/11** a `test:ai` **240 prešlo /
1 preskočený pre oprávnenie Windows / 0 zlyhalo**.
`eval:ai` ohodnotil **116/116 riadkov fixtúr**,
výslovne `MODEL_QUALITY=NOT_MEASURED`. Jeden
záverečný beh `test:race` dokončil **120 dvojíc
v každom zo siedmich scenárov** s nulou vynucovaných
porušení; obyčajné duplicitné POSTy bez kľúča
sa pozorovali v **120/120** dvojiciach iba na meranie.
Žiadny z výsledkov nie je vzdialený beh CI.

Táto oprava nemení užšie pravidlá referenčného dátumu
funkcie AI. Simulované serverové hodiny na poslednom
podporovanom dni sa skontrolovali v čistej pomocnej
funkcii, ale volajúci mimo plánov, ktorí samostatne
vyžadujú neexistujúci zajtrajšok (napríklad dátumové
okno konceptu AI), sa v tomto rozsahu nemenili;
ich HTTP správanie pri týchto veľmi vzdialených
hodinách sa nemeralo. Browserové sady ani vzdialené
CI sa pri tejto etape bez UI nespustili.
