[English](../../../../../qa/docs/defects/BUG-007-test-script-never-ran.md) · **Slovenčina**

<a id="bug-007--a-test-script-never-ran-and-the-suite-reported-it-as-green"></a>

# BUG-007 · Testovací skript sa vôbec nespustil a sada hlásila zelený výsledok

[← Späť na README](../../../README.md#qa-evidence) · [Register defektov](../../../log/BUGS.md) · [Ďalej: index hlásení →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Testovací skript sa vôbec nevykonal, no jeho nadradená sada aj tak hlásila úspešný výsledok.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Defekt |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Stredná |
| Priorita | P1 — falošná istota vo vrstve, ktorej úlohou je práve poskytovať istotu |
| Komponent | `qa/api/wallet.postman_collection.json` — `08 · Settings and the month balance / Another user's income does not leak` |
| Zistené / dotknutá verzia | S14; presná verzia len tam, kde je uvedená nižšie |
| Prostredie / frekvencia | newman 6.2.2, Node v24.13.1; frekvencia len tam, kde je uvedená nižšie |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie údaje

S14, bežné spustenie sady po nesúvisiacej zmene

<a id="reproduction"></a>

## Reprodukcia

1. `npm run test:api` a prečítajte si súhrnný riadok.

Tento krok pripomína historický postup; nejde o novospustený test.

<a id="expected-and-requirement"></a>

## Očakávanie a požiadavka

93 požiadaviek a vykonanie všetkých ich tvrdení.

<a id="actual-observation"></a>

## Skutočné pozorovanie

```
requests   93  (0 failed)
assertions 337  (0 failed)
```

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `qa/api/wallet.postman_collection.json`](../../../../../qa/api/wallet.postman_collection.json)
- [Zaznamenaný zdroj: `qa/api/run.js`](../../../../../qa/api/run.js)
- [Úplný pôvodný register zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — vyhľadajte nadpis `BUG-007`.
- [GitHub Issue #7](https://github.com/DaniilBehus/wallet-tracker/issues/7) — externé metadáta sa môžu líšiť; stav dokumentácie určuje lokálny register.

<a id="resolution-and-verification"></a>

## Oprava a overenie

**CLOSED.** Názov `pm.test` s apostrofom sa zmenil na platný reťazec v úvodzovkách a runner teraz vypisuje počet vykonaných testovacích skriptov a viditeľne zlyhá, ak sa niektorý nespustí. Zaznamenaný regresný beh obnovil chýbajúcu kontrolu príjmu medzi používateľmi: počet tvrdení stúpol z **337 na 340** pri **93 vykonaných skriptoch**. Pri tomto prepise sa API test nespúšťal znova.

<a id="technical-investigation-and-dated-history"></a>

## Technické vyšetrovanie a datovaná história

<details>
<summary>Otvoriť pôvodné podrobné hlásenie/pozorovanie</summary>

<a id="original-report-bug-007--a-test-script-never-ran-and-the-suite-reported-it-as-green"></a>

### Pôvodné hlásenie: BUG-007 · Testovací skript sa vôbec nespustil a sada hlásila zelený výsledok

[← Späť na README](../../../README.md#qa-evidence) · [Ďalej: API runner →](../../../../../qa/api/run.js)

![závažnosť](https://img.shields.io/badge/severity-Medium-yellow?style=flat-square)
![stav](https://img.shields.io/badge/state-CLOSED-brightgreen?style=flat-square)

| | |
|---|---|
| **Závažnosť** | Stredná |
| **Priorita** | P1 — falošná istota vo vrstve, ktorej úlohou je práve poskytovať istotu |
| **Stav** | CLOSED 2026-09-03 |
| **Zistené pomocou** | API sada spustená ako bežná kontrola po nesúvisiacej zmene |
| **Komponent** | `qa/api/wallet.postman_collection.json` — `08 · Settings and the month balance / Another user's income does not leak` |
| **Dopad na** | hlásený počet tvrdení a jednu kontrolu izolácie medzi používateľmi |
| **Prostredie** | newman 6.2.2, Node v24.13.1 |
| **Opravené v** | Opravené. Pôvodný commit nie je súčasťou tejto verejnej snímky. |
<a id="summary"></a>

## Zhrnutie

Jedna požiadavka v kolekcii **nič netestovala** po celý čas svojej existencie,
a sada hlásila úspešný beh.

Požiadavka má overiť, že používateľ B nevidí príjem používateľa A —
izolácia medzi používateľmi podľa spec §4.3, jedna z najdôležitejších
vlastností tohto API.

<a id="what-the-run-said"></a>

## Čo hlásil beh

```
requests   93  (0 failed)
assertions 337  (0 failed)
```

Zelený výsledok, ktorý sa ako zelený citoval v dvoch starších záznamoch relácií.

Vlastná tabuľka newman pritom uvádzala `test-scripts 93 1`:

<details>
<summary>Zlyhanie, ktoré newman hlásil, ale nikto si ho neprečítal</summary>

```
  #   failure       detail

 1.   SyntaxError
                    missing ) after argument list
                    at test-script
                    inside "08 · Settings and the month balance / Another user's income does not leak"
```

</details>

Z počtu `337` chýbali tri tvrdenia — o 200, o schéme a o samotnej
vlastnosti — bez náznaku, že niečo chýba.

<a id="root-cause"></a>

## Príčina

Apostrof.

```js
pm.test('user B has their own income, not user A's', function () {
```

Reťazec je v jednoduchých úvodzovkách a názov obsahuje `user A's`,
čo ho predčasne ukončí. Všetko za tým je syntaktická chyba,
takže sa skript nespracuje ani nespustí.

Samotná kolekcia obsahuje správny protiklad: susedný test na riadku 875
je zapísaný `pm.test("user B's categories are not user A's rows", …)`.
Ten istý autor, ten istý súbor, jeden zápis bol správny.

<a id="why-nothing-caught-it"></a>

## Prečo sa to nezachytilo

Tri mechanizmy boli blízko, no zlyhali rovnakým spôsobom:

| | Prečo to nezachytilo |
|---|---|
| **Súhrnný riadok** | skript, ktorý zlyhá pred prvým `pm.test`, pridá nula tvrdení **a zároveň** nula zlyhaní. Neprítomnosť sa nedá odlíšiť od úspechu |
| **Návratový kód** | 127 — vyskytoval sa však aj pri úspešných behoch ([BUG-008](BUG-008-api-runner-exit-127.md)), takže neniesol signál |
| **Gate C8** | počíta overované stavy vyhľadaním `expectStatus(…)` v *texte* skriptu. Zhoduje sa aj skript, ktorý sa nikdy nevykoná. C8 číta zdroj, nie beh |

Všetky tri podávajú správu o behu, ale nevedia odlíšiť
„skontrolované a úspešné“ od „neskontrolované“.

<a id="fix"></a>

## Oprava

Má dve časti a druhá je rozhodujúca.

**1. Názov testu prešiel na dvojité úvodzovky** podľa susedného testu.

**2. `qa/api/run.js` vypisuje počet skriptov pri každom behu:**

```
requests   93  (0 failed)
assertions 340  (0 failed)
scripts    93  (0 failed to run)
```

a keď počet nevykonaných skriptov nie je nulový, vysvetlí význam:

```
  1 test script(s) did not execute. Their assertions are
  missing from the count above, not passing.
```

Vypisuje sa **vždy**, nie iba pri chybe. Číslo zobrazené len
v zlých dňoch sa nikto nenaučí čítať — zmysel `93/93` vedľa `340`
spočíva v ich spoločnom význame.

<a id="regression"></a>

## Regresia

Tri chýbajúce tvrdenia sa vrátili: **337 → 340** a kontrola príjmu
medzi používateľmi sa teraz vykonáva. Prechádza — aplikácia nikdy
nebola chybná. Chybné bolo tvrdenie, že sa skontrolovala.

<a id="-rule-r10"></a>

## → Pravidlo R10

Test, ktorý sa nespustí, hlási to isté čo úspešný test. Počítajte,
čo sa vykonalo, nielen čo zlyhalo — a vypisujte počet aj pri zelenom behu.


</details>
