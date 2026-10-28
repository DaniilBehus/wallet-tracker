[English](../../../../../qa/docs/defects/BUG-023-race-verdict.md) · **Slovenčina**

<a id="bug-023--registration-race-violation-was-ignored-by-final-verdict"></a>

# BUG-023 · Porušenie pri súbežnej registrácii sa ignorovalo v konečnom verdikte

[← Späť na README](../../../README.md#qa-evidence) · [Register chýb](../../../log/BUGS.md) · [Ďalej: index správ →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Porušenie invariantu pri súbežnej registrácii sa nahlásilo, ale nespôsobilo zlyhanie konečného verdiktu runnera.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Chyba |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Vysoká |
| Priorita | Samostatne nezaznamenaná |
| Komponent | `qa/race/run.js` |
| Nájdené / dotknutá zostava | kontrola 2026-10-09; presná zostava len tam, kde je zaznamenaná nižšie |
| Prostredie / frekvencia | Samostatne nezaznamenané; nevyvodzujte frekvenciu z neskorších zelených behov |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie dáta

2026-10-09, negatívna kontrola race runnera v pamäti

<a id="reproduction"></a>

## Reprodukcia

1. Nastavte, aby iba scenár E dostal 201 a 500; spustite skutočnú orchestráciu runnera so syntetickými klientmi v pamäti.

Tento krok opakuje datovaný historický postup; nejde o novo vykonaný test.

<a id="expected-and-requirement"></a>

## Očakávané správanie a požiadavka

Zaznamenané porušenie scenára E spôsobí nenulový návratový kód príkazu.

<a id="actual-observation"></a>

## Skutočné pozorovanie

E zaznamenal jedno porušenie, ale konečný súčet E vynechal,
vypísal úspech a skončil s kódom 0.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `qa/race/run.js`](../../../../../qa/race/run.js)
- [Úplný pôvodný register, zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — nájdite nadpis `BUG-023`.

<a id="resolution-and-verification"></a>

## Vyriešenie a overenie

Aktuálny stav registra: **CLOSED**. Datované zosúladenie zaznamenáva: [negatívny verdikt iba pre E a kontroly vynucovaných scenárov](../test-report-validator-controls.md); úloha race prešla v aktuálnom API CI. D zostáva iba meraním.

Pôvodné skúmanie nižšie môže používať skorší štítok `IN PROGRESS` alebo „local/uncommitted“. Je zachované ako historický dôkaz, nie ako konkurenčný aktuálny stav. Táto migrácia dokumentácie nespustila nový scenár.

<a id="technical-investigation-and-dated-history"></a>

## Technické skúmanie a datovaná história

<details>
<summary>Otvoriť pôvodnú podrobnú správu/pozorovanie</summary>

<a id="bug-023--registration-race-violation-was-ignored-by-final-verdict--high--in-progress"></a>

### BUG-023 · Porušenie pri súbežnej registrácii sa ignorovalo v konečnom verdikte · High · IN PROGRESS

| Nájdené v | 2026-10-09, negatívna kontrola race runnera v pamäti |
| Komponent | `qa/race/run.js` |

**Kroky reprodukcie:** nastavte, aby iba scenár E dostal 201 a 500; spustite skutočnú
orchestráciu runnera so syntetickými klientmi v pamäti.
**Očakávané:** zaznamenané porušenie scenára E spôsobí nenulový návratový kód príkazu.
**Skutočnosť pred opravou:** E zaznamenal jedno porušenie, ale konečný súčet E vynechal,
vypísal úspech a skončil s kódom 0.
**Príčina:** druhý ručne zostavený súčet nezodpovedal správe scenárov.
**Oprava:** lokálna a necommitnutá; jeden register teraz riadi správu aj vynucovaný
verdikt, validuje dôkazy párov a výslovne označuje D iba ako meranie.
**Regresia:** zlyhanie iba E končí s kódom 1; každé ďalšie vynucované zlyhanie končí s kódom 1;
všetky dobré vynucované prípady s duplicitami D končia s kódom 0; prechádza 23/23 kontrol validátora.
**→ Žiadne pravidlo — jednorazový prípad.**

</details>
