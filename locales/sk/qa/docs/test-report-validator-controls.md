[English](../../../../qa/docs/test-report-validator-controls.md) · **Slovenčina**

<a id="validator-controls-and-race-database-ownership--2026-10-09"></a>

# Kontroly validátora a vlastníctvo databázy pri pretekoch — 2026-10-09

[← Späť na README](../../README.md#qa-evidence) · [Príkazy behov](../../docs/testing.md) · [Runner pretekov](../../../../qa/race/run.js) · [Negatívne kontroly](../../../../qa/gates/validator-controls.test.js)

Testovaný build: `b270355c8c850282b10cc0a7bdeb81c88b784765`
plus tu opísané lokálne, necommitnuté zmeny. Ide o lokálny
dôkaz, nie výsledok GitHub Actions ani test produkčnej záťaže.

<a id="confirmed-defects-and-repair"></a>

## Potvrdené chyby a oprava

| Chyba | Pred opravou | Lokálna oprava |
|---|---|---|
| [BUG-023](../../log/BUGS.md) | E hlásilo jedno porušenie, no runner skončil s kódom 0 a vypísal úspech. | Jeden register scenárov tvorí súhrn aj verdikt; E sa vynucuje. Každý scenár musí uviesť očakávaný počet pozorovaných dvojíc. |
| [BUG-024](../../log/BUGS.md) | Chýbajúca architektonická poznámka dala C1 SKIP a exit 0. Prázdne inventáre zdroja/UI mohli prejsť nulovou iteráciou. | Povinné súbory a neprázdne inventáre zlyhávajú. Skutočne voliteľné kontroly platformy sú mimo týchto ôsmich povinných brán. |
| [BUG-025](../../log/BUGS.md) | Sentinel v pamäťovom súborovom systéme s názvom podobným inému behu pretekov odstránilo premazávanie podľa prefixu. | Prideliť jedinečný vlastnený adresár; pred odstránením iba tohto adresára po vypnutí detských procesov ho vyriešiť a validovať. Pri neúplnom vypnutí/čistení ho zachovať a zlyhať. |

Kontroly precvičujú skutočné `main` runnera aj skutočné
funkcie samokontroly/pokrytia cez pamäťové rozhranie súborového
systému/servera. Pri negatívnych prípadoch sa žiadny skutočný
architektonický súbor, kolekcia, zdrojový strom ani databáza
nepremenovali ani nezmazali. Záverečné kontroly sa spustili
aj voči nezmenenému zdroju `b270355` cez `git show`
iba na čítanie, bez prepnutia checkoutu: **5 prešlo,
18 zlyhalo**. Zlyhania zahŕňajú skutočne falošne zelené
prípady (E-only exit 0, chýbajúci vstup C1, nulový dôkaz
vykonania a zmazanie sentinelu iného behu); kontroly
nového správania vlastneného adresára prirodzene zlyhávajú,
lebo na základe tento mechanizmus nie je. Zmenený zdroj
prechádza **23/23**. Pozitívna kontrola má všetky
vynucované scenáre čisté, kým D hlási duplikát; skončí
s kódom 0. Každé samostatné porušenie A/B1/B2/B3/C/E
skončí kódom 1. Každý samostatný prázdny výsledok
A/B1/B2/B3/C/D/E skončí kódom 1. Neplatné hodnoty
`RACE_PAIRS` `0`, `-1`, `NaN`, `1.5` zlyhajú
pred spustením scenárov. Samostatné kontroly dokazujú,
že neúplné vypnutie detského procesu zachová vlastnenú DB,
zmenená identita adresára odmietne čistenie a fyzická
jednorazová fixtúra zachová nesúvisiaci sentinel.

<a id="real-local-verification"></a>

## Skutočné lokálne overenie

- `npm run test:gates`: 23/23 prešlo.
- `npm run check`: 8 pass, 0 skip, 0 fail.
- `npm run check:openapi`: 21/21 zdrojových operácií
  a 298 lokálnych referencií.
- `npm run test:race`: po 120 dvojíc v A, B1, B2, B3,
  C, D a E; všetkých šesť vynucovaných scenárov má
  **0 porušení**. D nameralo **120/120 duplicitných
  riadkov** z dvojitého POST bez kľúča. Súhrnný verdikt
  `PASS`; jeho jedinečný vlastnený adresár databázy sa
  po zastavení oboch procesov odstránil.

Runner stále používa pevné porty 3110/3111, takže dva
skutočné behy nemôžu bežať súbežne. Jeho kompaktný
ignorovaný `qa/reports/race-summary.json` je lokálny;
CI nenahráva databázu, `.env` ani široký adresár reportov.
Zmena workflow dáva `test:gates` pred ťažšie sady API
a `test:race` po Newman v existujúcej úlohe API.
**CI túto necommitnutú zmenu ešte neoverilo.**
V tejto etape sa nezmenila žiadna trasa aplikácie,
peňažná logika ani závislosť.
