[English](../../../../../qa/docs/defects/BUG-008-api-runner-exit-127.md) · **Slovenčina**

<a id="bug-008--the-api-runner-exits-127-on-a-green-run-so-the-first-ci-build-would-be-red"></a>

# BUG-008 · API runner vracia 127 pri zelenom behu, takže prvé zostavenie CI by bolo červené

[← Späť na README](../../../README.md#qa-evidence) · [Register defektov](../../../log/BUGS.md) · [Ďalej: index hlásení →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

API runner po úspešnom behu vrátil kód 127, čo by nesprávne označilo zostavenie CI za neúspešné.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Defekt |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Vysoká |
| Priorita | P0 — pokazí pipeline, ktorá kontroluje všetko ostatné |
| Komponent | `qa/api/run.js` — `cleanUp` |
| Zistené / dotknutá verzia | S14; presná verzia len tam, kde je uvedená nižšie |
| Prostredie / frekvencia | Windows 11, Node v24.13.1, better-sqlite3 13.0.3; frekvencia len tam, kde je uvedená nižšie |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie údaje

S14, ručná kontrola návratového kódu `npm run test:api`

<a id="reproduction"></a>

## Reprodukcia

1. ``` npm run test:api ; echo $? ```

Tento krok pripomína historický postup; nejde o novospustený test.

<a id="expected-and-requirement"></a>

## Očakávanie a požiadavka

0. Každé tvrdenie prešlo.

<a id="actual-observation"></a>

## Skutočné pozorovanie

127 pri behu 93 požiadaviek a 340 tvrdení bez zlyhaní.
Reprodukované aj priamo pomocou `node qa/api/run.js`,
takže výsledok neskresľuje npm.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `qa/api/run.js`](../../../../../qa/api/run.js)
- [Zaznamenaný zdroj: `qa/reports/api-report.html`](../../../../../qa/reports/api-report.html)
- [Úplný pôvodný register zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — vyhľadajte nadpis `BUG-008`.
- [GitHub Issue #8](https://github.com/DaniilBehus/wallet-tracker/issues/8) — externé metadáta sa môžu líšiť; stav dokumentácie určuje lokálny register.

<a id="resolution-and-verification"></a>

## Oprava a overenie

**CLOSED.** Runner už nemaže vlastný súbor SQLite, kým ho iný proces stále drží otvorený. Staré súbory `data/api-*.db` odstraňuje na *začiatku* behu, po výsledku ukončí server a počká naň a nechá vypísať bufferovaný výstup. Zaznamenaný regresný beh skončil s **93 požiadavkami / 340 tvrdeniami, nulou zlyhaní a kódom 0**, zachoval 963 KB HTML report a port 3001 zostal zatvorený. Spúšťač sa podarilo izolovať; prečo Windows ukončil proces mažúci súbor namiesto vrátenia `EBUSY`, zostalo neznáme.

<a id="technical-investigation-and-dated-history"></a>

## Technické vyšetrovanie a datovaná história

<details>
<summary>Otvoriť pôvodné podrobné hlásenie/pozorovanie</summary>

<a id="original-report-bug-008--the-api-runner-exits-127-on-a-green-run-so-the-first-ci-build-would-be-red"></a>

### Pôvodné hlásenie: BUG-008 · API runner vracia 127 pri zelenom behu, takže prvé zostavenie CI by bolo červené

[← Späť na README](../../../README.md#qa-evidence) · [Ďalej: API runner →](../../../../../qa/api/run.js)

![závažnosť](https://img.shields.io/badge/severity-High-orange?style=flat-square)
![stav](https://img.shields.io/badge/state-CLOSED-brightgreen?style=flat-square)

| | |
|---|---|
| **Závažnosť** | Vysoká |
| **Priorita** | P0 — pokazí pipeline, ktorá kontroluje všetko ostatné |
| **Stav** | CLOSED 2026-09-03 |
| **Zistené pomocou** | ručná kontrola návratového kódu `npm run test:api` |
| **Komponent** | `qa/api/run.js` — `cleanUp` |
| **Dopad na** | `.github/workflows/ci.yml`, úloha **api**, od ktorej závisí úloha e2e |
| **Prostredie** | Windows 11, Node v24.13.1, better-sqlite3 13.0.3 |
| **Opravené v** | Opravené. Pôvodný commit nie je súčasťou tejto verejnej snímky. |
<a id="summary"></a>

## Zhrnutie

93 požiadaviek, 340 tvrdení, žiadne zlyhanie — a runner končí s kódom **127**.

CI číta toto číslo a nič iné. Krok `- run: npm run test:api`
by zlyhal a spolu s ním aj úloha e2e, takže **prvé zostavenie
po prvom pushi by bolo červené na kroku, ktorý prešiel**.

Zistené pred pushom, nie po ňom; len preto je dopad menší,
než mohol byť.

<a id="steps-to-reproduce"></a>

## Kroky na reprodukciu

```
npm run test:api ; echo $?
```

Reprodukované aj priamo cez `node qa/api/run.js`,
takže npm pri ukončení nič neskresľuje.

<a id="expected"></a>

## Očakávanie

0. Návratový kód je výsledok; inak príkaz nemôže slúžiť ako brána.

<a id="actual"></a>

## Skutočnosť

127, opakovane, pri úplne zelenom behu.

<a id="why-this-is-high-and-bug-006-is-low"></a>

## Prečo je tento prípad High a BUG-006 Low

Rovnaký príznak, iný rozsah dopadu. [BUG-006](BUG-006-load-runner-exit-127.md)
bol v záťažovom runneri, od ktorého nič nezávisí — obťažoval.
Tento je zapojený do CI a červené prvé zostavenie repozitára,
ktorý niekto číta ako ukážku práce, stojí viac než bežne nesprávne číslo.

<a id="root-cause--isolated-not-inferred"></a>

## Príčina — izolovaná, nie odvodená

BUG-006 pripísal vinu `child.kill()`. **Bolo to nesprávne**
a práve tu sa ukázalo prečo. Šesť samostatných minimalizovaných
pokusov, každý v jednom skripte — päť v tabuľke, šiesty nižšie:

| # | Čo vykonal | Návratový kód |
|---|---|---|
| 1 | spustil server, ukončil ho, normálne sa vrátil | **0** |
| 2 | spustil, ukončil a potom vykonal `rmSync` databázy | **127** |
| 3 | ako 2, so synchrónnym logovaním | **127** — končí *vnútri* `rmSync` |
| 4 | spustil, **neukončil server**, vykonal `rmSync` živej databázy servera | **127** |
| 5 | spustil, ukončil, **počkal na udalosť `exit`**, potom `rmSync` | **0** |

Test 1 vylučuje samotné ukončenie procesu. Test 4 usvedčuje
mazanie aj bez ukončenia procesu.

<details>
<summary>Test 3 ukazuje, kde proces končí</summary>

```
about to kill
killed, killed flag = true
  rmSync killtest3.db
OBSERVED EXIT CODE: 127
```

Skript zapisuje cez `fs.writeSync(1, …)`, takže výstup sa nemohol
stratiť skrátením stdout. Chýbajú `    ok` aj `    threw <code>`:
`fs.rmSync` sa nevrátil ani nevyhodil výnimku. Proces bol ukončený
vnútri tohto volania.

</details>

<details>
<summary>Test 6 — ide o SQLite alebo ľubovoľný otvorený súbor?</summary>

```
rmSync a PLAIN file another process holds open
  ok — deleted
survived
EXIT (plain open file): 0
```

Obyčajný súbor otvorený iným procesom sa zmaže bez problémov
a volajúci proces prežije. Spúšťač je teda špecifický pre databázu,
ktorú `better-sqlite3` stále drží otvorenú, nie pre otvorené súbory všeobecne.

</details>

**Mechanizmus je teda takýto:** `fs.rmSync` na databáze `better-sqlite3`,
ktorú iný proces drží otvorenú, ukončí volajúci proces bez výnimky
a bez návratu. Predchádzajúce ukončenie podprocesu nepomôže,
pretože je asynchrónne a súbor zostáva ešte chvíľu otvorený —
presne tak vyzeral `cleanUp`.

**Čo zostáva neznáme:** *prečo* sa proces ukončí namiesto vrátenia
`EBUSY`. Uvádza sa to bez hádania. Spúšťač je presne priradený
jednému riadku, čo na opravu stačí; zvyšok by bol len domnienka.

<a id="what-this-corrects-in-bug-006"></a>

## Čo to opravuje v BUG-006

Oprava BUG-006 — prestať ukončovať podproces, čistiť pri začiatku
ďalšieho behu — fungovala, pretože odstránila mazanie. Zásluha
sa však pripísala odstráneniu ukončovania. Správna oprava
z nesprávneho dôvodu zanechá falošné pravidlo („neukončovať
podprocesy“), ktoré sa časom odmietne ako povera, spolu so skutočnou ochranou.

Záťažový runner nepotrebuje zmenu kódu. Po úplnom záťažovom behu
sa znova potvrdilo, že porty 3100–3102 sú voľné.

<a id="fix"></a>

## Oprava

- **Vlastná databáza behu sa nikdy nemaže.** Staré súbory
  `data/api-*.db` sa odstraňujú na **začiatku** behu, keď nemôžu
  ovplyvniť výsledok, ktorý ešte nenastal.
- **Server sa ukončí a počká sa naň** — `server.once('exit', …)`
  pred návratom.

Naraz musia platiť tri podmienky a iba toto poradie splní všetky:

| Požiadavka | Čo ju poruší |
|---|---|
| podproces musí skončiť | bez ukončenia zostane po každom behu osirelý proces držiaci port 3001 |
| proces sa musí ukončiť sám | živý podproces drží slučku udalostí aktívnu → verzia bez ukončenia **visela päť minút** |
| návratový kód sa musí zachovať | `process.exit()` skráti bufferovaný stdout → pri pokuse zmizol celý súhrn aj 963 KB HTML report |

Tretí bod stojí za zapamätanie: `process.exit()` je zdanlivo
samozrejmý spôsob ukončenia procesu, ktorý sa sám nezastaví,
ale potichu zahodí výstup zapísaný, no ešte neodoslaný do pipe.

<a id="regression"></a>

## Regresia

```
npm run test:api           requests 93 (0 failed), assertions 340 (0 failed)
exit code                  0
qa/reports/api-report.html 963 KB, written
port 3001 afterwards       no LISTENING socket
data/api-*.db              swept at the start of the next run
```

<a id="-rule-r8-rewritten"></a>

## → Pravidlo R8 (prepísané)

Nemažte databázu, ktorú iný proces stále drží otvorenú — na tejto
platforme to ukončí mazajúci proces namiesto vrátenia chyby.
Všeobecnejšie: čistenie nesmie zmeniť výsledok. Vykonajte ho
na začiatku ďalšieho behu.


</details>
