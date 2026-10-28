[English](../../../../../qa/docs/defects/BUG-025-race-cleanup-ownership.md) · **Slovenčina**

<a id="bug-025--race-cleanup-could-remove-another-runs-database"></a>

# BUG-025 · Čistenie race mohlo odstrániť databázu iného behu

[← Späť na README](../../../README.md#qa-evidence) · [Register chýb](../../../log/BUGS.md) · [Ďalej: index správ →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Čistenie race runnera mohlo odstrániť databázu patriacu inému behu.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Chyba |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Stredná |
| Priorita | Samostatne nezaznamenaná |
| Komponent | `qa/race/run.js` |
| Nájdené / dotknutá zostava | kontrola 2026-10-09; presná zostava len tam, kde je zaznamenaná nižšie |
| Prostredie / frekvencia | Samostatne nezaznamenané; nevyvodzujte frekvenciu z neskorších zelených behov |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie dáta

2026-10-09, kontrola sentinelového súboru iného behu v pamäti

<a id="reproduction"></a>

## Reprodukcia

1. Sprístupnite starému mechanizmu čistenia runnera súbor `race-*` iného behu. Na túto sondu nepoužívajte skutočnú používateľskú ani aplikačnú databázu.

Tento krok opakuje datovaný historický postup; nejde o novo vykonaný test.

<a id="expected-and-requirement"></a>

## Očakávané správanie a požiadavka

Odstrániť sa môže iba vlastný dočasný adresár aktuálneho behu.

<a id="actual-observation"></a>

## Skutočné pozorovanie

Čistenie podľa prefixu sa pokúsilo odstrániť sentinel.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `qa/race/run.js`](../../../../../qa/race/run.js)
- [Úplný pôvodný register, zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — nájdite nadpis `BUG-025`.

<a id="resolution-and-verification"></a>

## Vyriešenie a overenie

Aktuálny stav registra: **CLOSED**. Datované zosúladenie zaznamenáva: [kontroly sentinelu iného behu a vlastného čistenia](../test-report-validator-controls.md); aktuálne race CI prešlo. Čistenie databázy iného behu nie je povolené.

Pôvodné skúmanie nižšie môže používať skorší štítok `IN PROGRESS` alebo „local/uncommitted“. Je zachované ako historický dôkaz, nie ako konkurenčný aktuálny stav. Táto migrácia dokumentácie nespustila nový scenár.

<a id="technical-investigation-and-dated-history"></a>

## Technické skúmanie a datovaná história

<details>
<summary>Otvoriť pôvodnú podrobnú správu/pozorovanie</summary>

<a id="bug-025--race-cleanup-could-remove-another-runs-database--medium--in-progress"></a>

### BUG-025 · Čistenie race mohlo odstrániť databázu iného behu · Medium · IN PROGRESS

| Nájdené v | 2026-10-09, kontrola sentinelu iného behu v pamäti |
| Komponent | `qa/race/run.js` |

**Kroky reprodukcie:** sprístupnite starému mechanizmu čistenia runnera súbor `race-*`
iného behu. Na túto sondu nepoužívajte skutočnú používateľskú ani aplikačnú databázu.
**Očakávané:** odstrániť sa môže iba vlastný dočasný adresár aktuálneho behu.
**Skutočnosť pred opravou:** čistenie podľa prefixu sa pokúsilo odstrániť sentinel.
**Príčina:** čistenie vyberalo každý zodpovedajúci názov v `data/`, nie vlastnenú cestu.
**Oprava:** lokálna a necommitnutá; alokovať jedinečný kanonický adresár, validovať
jeho rodiča a názov a odstrániť len tento adresár po zastavení oboch podradených procesov.
Ak ukončenie alebo čistenie zlyhá, ponechať adresár a vrátiť zlyhanie.
**Regresia:** sentinel v pamäti zostal nedotknutý; sentinel v skutočnom jednorazovom
fixture zostal nedotknutý; jeden skutočný beh so 120 pármi na scenár prešiel
a odstránil vlastný adresár.
**→ Žiadne pravidlo — jednorazový prípad.**

</details>
