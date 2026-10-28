[English](../../../../../qa/docs/defects/BUG-029-evaluator-report-collision.md) · **Slovenčina**

<a id="bug-029--concurrent-evaluator-reports-can-overwrite-each-other"></a>

# BUG-029 · Súbežné správy evaluátora sa mohli navzájom prepísať

[← Späť na README](../../../README.md#qa-evidence) · [Register chýb](../../../log/BUGS.md) · [Ďalej: index správ →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Evaluátory s rovnakou pevnou počiatočnou časovou značkou mohli zapísať správu pod rovnakým základným názvom a prepísať vzájomné dôkazy.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Chyba |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Vysoká |
| Priorita | Samostatne nezaznamenaná |
| Komponent | zapisovač správ `qa/ai/evaluate.js` |
| Nájdené / dotknutá zostava | kontrola s pevným časom 2026-10-10; presná zostava len tam, kde je zaznamenaná nižšie |
| Prostredie / frekvencia | Samostatne nezaznamenané; nevyvodzujte frekvenciu z neskorších zelených behov |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie dáta

2026-10-10, kontrola kópie evaluátora s pevným časom

<a id="reproduction"></a>

## Reprodukcia

1. Spustite dva evaluátory súbežne s rovnakou počiatočnou časovou značkou a skontrolujte každú vypísanú cestu k správe JSON/Markdown.

Tento krok opakuje datovaný historický postup; nejde o novo vykonaný test.

<a id="expected-and-requirement"></a>

## Očakávané správanie a požiadavka

Každý beh si zachová vlastný úplný pár správ; pohodlný pohľad na poslednú správu označí jednu dokončenú správu.

<a id="actual-observation"></a>

## Skutočné pozorovanie

Oba behy vypísali rovnakú cestu, takže neskorší zápis mohol nahradiť skorší dôkaz.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `qa/ai/evaluate.js`](../../../../../qa/ai/evaluate.js)
- [Zaznamenaný zdroj: `qa/docs/test-report-evaluator-concurrency.md`](../test-report-evaluator-concurrency.md)
- [Úplný pôvodný register, zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — nájdite nadpis `BUG-029`.

<a id="resolution-and-verification"></a>

## Vyriešenie a overenie

Aktuálny stav registra: **CLOSED**. Datované zosúladenie zaznamenáva: [kontroly odlišných správ pri pevnom čase a čiastočného zápisu](../test-report-evaluator-concurrency.md); offline AI CI prešlo. Publikovanie dvoch súborov stále nie je atomické.

Pôvodné skúmanie nižšie môže používať skorší štítok `IN PROGRESS` alebo „local/uncommitted“. Je zachované ako historický dôkaz, nie ako konkurenčný aktuálny stav. Táto migrácia dokumentácie nespustila nový scenár.

<a id="technical-investigation-and-dated-history"></a>

## Technické skúmanie a datovaná história

<details>
<summary>Otvoriť pôvodnú podrobnú správu/pozorovanie</summary>

<a id="bug-029--concurrent-evaluator-reports-can-overwrite-each-other--high--in-progress"></a>

### BUG-029 · Súbežné správy evaluátora sa mohli navzájom prepísať · High · IN PROGRESS

| Nájdené v | 2026-10-10, kontrola kópie evaluátora s pevným časom |
| Komponent | zapisovač správ `qa/ai/evaluate.js` |

**Kroky reprodukcie:** spustite dva evaluátory súbežne s rovnakou počiatočnou
časovou značkou a skontrolujte každú vypísanú cestu k správe JSON/Markdown.
**Očakávané:** každý beh si zachová vlastný úplný pár správ; pohodlný pohľad
na poslednú správu označí jednu dokončenú správu.
**Skutočnosť pred opravou:** oba behy vypísali rovnakú cestu, takže neskorší
zápis mohol nahradiť skorší dôkaz.
**Príčina:** základný názov obsahoval iba režim a milisekundový počiatočný
čas a zápisy nahrádzali existujúce súbory.
**Oprava:** lokálna a necommitnutá; pridať náhodnú identitu behu, publikovať
dokončené dočasné súbory pod výlučnými konečnými názvami a zabezpečiť, aby
pohľad na poslednú správu pomenoval dokončenú správu, ktorú zobrazuje.
Zlyhaný zápis páru čistí iba svoje vlastné súbory a neoznamuje úspech.
**Regresia:** behy s pevným časom zachovali odlišné páry JSON/Markdown;
vložené zlyhanie druhého súboru nezanechalo čiastočný pár ani riadok úspechu.
Publikovanie dvoch súborov nie je atomická transakcia a „posledný“ znamená
posledného dokončeného zapisovača, nie najneskorší štart.
**→ Žiadne pravidlo — jednorazový prípad.** [Podrobnosti](../test-report-evaluator-concurrency.md).

</details>
