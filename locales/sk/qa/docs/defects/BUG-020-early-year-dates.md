[English](../../../../../qa/docs/defects/BUG-020-early-year-dates.md) · **Slovenčina**

<a id="bug-020--valid-early-year-dates-produce-malformed-next-dates"></a>

# BUG-020 · Platné dátumy zo skorých rokov vytvárali chybné nasledujúce dátumy

[← Späť na README](../../../README.md#qa-evidence) · [Register chýb](../../../log/BUGS.md) · [Ďalej: index správ →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Prijaté dátumy zo skorých rokov a konca rozsahu mohli vytvárať chybné nasledujúce dátumy vrátane hodnôt mimo štvorcifernej domény.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Chyba |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Stredná |
| Priorita | Samostatne nezaznamenaná |
| Komponent | `src/dates.js` — clampToMonth / dayAfter / nextDue |
| Nájdené / dotknutá zostava | S21 + kontroly 2026-10-10; presná zostava len tam, kde je zaznamenaná nižšie |
| Prostredie / frekvencia | Samostatne nezaznamenané; nevyvodzujte frekvenciu z neskorších zelených behov |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie dáta

S21, čisté sondy hraníc dátumových pomocných funkcií

<a id="reproduction"></a>

## Reprodukcia

1. Zavolajte isValidDate('0001-01-31'), dayAfter pre tento dátum a nextDue(15, '0001-01-31').

Tento krok opakuje datovaný historický postup; nejde o novo vykonaný test.

<a id="expected-and-requirement"></a>

## Očakávané správanie a požiadavka

Prijaté dátumy zachovajú YYYY-MM-DD; nasledujúca splatnosť nie je pred vstupom.

<a id="actual-observation"></a>

## Skutočné pozorovanie

Pre `0001-01-31` prijaté dátumové pomocné funkcie vrátili reťazce ako `1-02-01` a nasledujúcu splatnosť pred vstupom. Na opačnej hranici mohlo `9999-12-31` prekročiť štvorcifernú doménu.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `src/dates.js`](../../../../../src/dates.js)
- [Zaznamenaný zdroj: `qa/docs/test-report-date-boundaries.md`](../test-report-date-boundaries.md)
- [Úplný pôvodný register, zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — nájdite nadpis `BUG-020`.

<a id="resolution-and-verification"></a>

## Vyriešenie a overenie

Aktuálny stav registra: **CLOSED**. Datované zosúladenie zaznamenáva: [správu o dátumových hraniciach](../test-report-date-boundaries.md) a úlohy dátumov/kontraktu v skupine API CI; tvrdí sa iba uvedená štvorciferná doména.

Pôvodné skúmanie nižšie môže používať skorší štítok `IN PROGRESS` alebo „local/uncommitted“. Je zachované ako historický dôkaz, nie ako konkurenčný aktuálny stav. Táto migrácia dokumentácie nespustila nový scenár.

<a id="technical-investigation-and-dated-history"></a>

## Technické skúmanie a datovaná história

<details>
<summary>Otvoriť pôvodnú podrobnú správu/pozorovanie</summary>

<a id="bug-020--valid-early-year-dates-produce-malformed-next-dates--medium--in-progress"></a>

### BUG-020 · Platné dátumy zo skorých rokov vytvárali chybné nasledujúce dátumy · Medium · IN PROGRESS

| | |
|---|---|
| Nájdené v | S21, čisté sondy hraníc dátumových pomocných funkcií |
| Komponent | `src/dates.js` — clampToMonth / dayAfter / nextDue |

**Kroky reprodukcie:** zavolajte isValidDate('0001-01-31'), dayAfter pre tento dátum
a nextDue(15, '0001-01-31').
**Očakávané:** prijaté dátumy zachovajú YYYY-MM-DD; nasledujúca splatnosť nie je pred vstupom.
**Skutočnosť pred opravou:** true, '1-02-01', '1-01-15' v tomto poradí. Posledný dátum
je skorší. Na opačnej hranici sa `9999-12-31` mohlo zmeniť na `10000-01-01`.
Tá istá chyba dovolila POST/PATCH plánovanej platby uspieť a uložiť riadok,
ktorého vypočítaná ďalšia splatnosť ležala mimo deklarovanej štvorcifernej domény.
**Príčina:** parsovaný číselný rok sa vložil bez doplnenia na štyri cifry;
lexikografické porovnávanie potom stratilo záruku pevnej šírky dátumu.
Aritmetika tiež neodmietala prekročenie hornej hranice pred zápisom plánovanej platby.
**Oprava:** lokálna a necommitnutá. Čisté pomocné funkcie zachovávajú štvorciferné
roky0000–9999 a vyhadzujú kódovanú chybu rozsahu, ak nástupca nie je dostupný.
Vytvorenie/úprava plánovanej platby validuje vypočítanú ďalšiu splatnosť pred zápisom;
starý hraničný riadok vyvolá riadenú 400 pri zozname. Žiadny uložený riadok
sa nemigruje ani nemaže.
**Regresia:** úvodné čisté kontroly 1/3, konečné 4/4; skutočná jednorazová HTTP
kontrola pred opravou zlyhala na POST/PATCH/GET a po nej prešla. Úplný kontrakt 15/15,
340 validovaných odpovedí. [Podrobnosti](../test-report-date-boundaries.md).
Samostatná historická matica 2020–2032: 147219 kontrol,
0 nesúladov. Táto matica nemôže certifikovať roky mimo svojho rozsahu.
**→ Pravidlo R14.**

</details>
