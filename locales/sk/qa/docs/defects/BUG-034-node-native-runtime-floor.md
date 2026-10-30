[English](../../../../../qa/docs/defects/BUG-034-node-native-runtime-floor.md) · **Slovenčina**

<a id="bug-034--declared-node-22-floor-could-load-a-sqlite-binding-requiring-node-api-10"></a>

# BUG-034 · Deklarované minimum Node 22 mohlo načítať SQLite binding vyžadujúci Node-API 10

[← Späť na README](../../../README.md#qa-evidence) · [Register chýb](../../../log/BUGS.md) · [Ďalej: index správ →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Deklarované minimum Node 22 mohlo načítať natívny SQLite binding pri verzii Node-API nižšej, než tento binding vyžaduje.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Chyba |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Vysoká |
| Priorita | Samostatne nezaznamenaná |
| Komponent | podmienka engine balíka, základ Node v CI, štart databázy |
| Nájdené / dotknutá zostava | runtime kontroly 2026-10-11; presná zostava len tam, kde je zaznamenaná nižšie |
| Prostredie / frekvencia | Samostatne nezaznamenané; nevyvodzujte frekvenciu z neskorších zelených behov |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie dáta

2026-10-11 kontroly kompatibility runtime

<a id="reproduction"></a>

## Reprodukcia

Úplný očíslovaný postup reprodukcie nebol v historickom pozorovaní zaznamenaný. Pozri datované dôkazy nižšie; nevydávajte spätne zostavený postup za vykonaný test.

<a id="expected-and-requirement"></a>

## Očakávané správanie a požiadavka

Uvádzané minimum Node musí zodpovedať požiadavke bindingu na Node-API a na nepodporovanom runtime musí prísť jasné zlyhanie pred načítaním natívneho modulu.

<a id="actual-observation"></a>

## Skutočné pozorovanie

Metadáta balíka prijímali Node 22.9, hoci nainštalovaný SQLite binding vyžadoval Node-API 10, ktoré sa vo vetve 22 začína pri Node 22.14. Presná príčina historického natívneho pádu nebola izolovaná.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `qa/docs/test-report-runtime.md`](../test-report-runtime.md)
- [Úplný pôvodný register, zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — nájdite nadpis `BUG-034`.

<a id="resolution-and-verification"></a>

## Vyriešenie a overenie

Aktuálny stav registra: **CLOSED**. Datované zosúladenie zaznamenáva: [kontroly ochrany verzie/Node-API](../test-report-runtime.md); aktuálne CI používa deklarované minimum Node 22.14.0. Budúce verzie runtime ani mechanizmus historického natívneho pádu nie sú preukázané.

Pôvodné skúmanie nižšie môže používať skorší štítok `IN PROGRESS` alebo „local/uncommitted“. Je zachované ako historický dôkaz, nie ako konkurenčný aktuálny stav. Táto migrácia dokumentácie nespustila nový scenár.

<a id="technical-investigation-and-dated-history"></a>

## Technické skúmanie a datovaná história

<details>
<summary>Otvoriť pôvodnú podrobnú správu/pozorovanie</summary>

<a id="bug-034--declared-node-floor-could-load-an-incompatible-native-binding--high--in-progress"></a>

### BUG-034 · Deklarované minimum Node mohlo načítať nekompatibilný natívny binding · High · IN PROGRESS

| Nájdené v | 2026-10-11 kontroly kompatibility runtime |
| Komponent | podmienka engine balíka, základ Node v CI, štart databázy |

**Problém:** `>=22` prijímalo Node 22.9, kým nainštalovaný SQLite binding
vyžaduje Node-API 10, dostupné prvýkrát vo vetve 22 pri 22.14. Pozorovaný
natívny pád je v súlade s týmto nesúladom; presná príčina natívneho zlyhania
nebola izolovaná.
**Očakávané:** pravdivé metadáta a minimum CI plus jasná chyba pred načítaním
natívneho bindingu alebo vytvorením dátového adresára na nepodporovanom runtime.
**Oprava:** lokálna a necommitnutá; balík a koreň lock súboru používajú
`^22.14.0 || >=23.6.0`, CI pripína 22.14.0 a štart databázy najprv volá
ochranu stabilnej verzie/Node-API používajúcu iba vstavané moduly.
**Regresia:** cielené [runtime kontroly](../test-report-runtime.md)
pred opravou zlyhali a pokrývajú hranice verzií/API, zapojenie workflow
a poradie importov v podradenom procese. Presné konečné lokálne výsledky sú v
tejto správe. Úplné vzdialené CI a kompatibilita budúcich verzií zostávajú neoverené.
**→ Žiadne pravidlo — jednorazový prípad.**

</details>
