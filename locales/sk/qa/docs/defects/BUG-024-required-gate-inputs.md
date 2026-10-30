[English](../../../../../qa/docs/defects/BUG-024-required-gate-inputs.md) · **Slovenčina**

<a id="bug-024--required-validator-inputs-could-disappear-with-a-green-result"></a>

# BUG-024 · Povinné vstupy validátora mohli zmiznúť pri zelenom výsledku

[← Späť na README](../../../README.md#qa-evidence) · [Register chýb](../../../log/BUGS.md) · [Ďalej: index správ →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Povinné vstupy validátora mohli zmiznúť, hoci statická brána stále vrátila úspech.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Chyba |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Vysoká |
| Priorita | Samostatne nezaznamenaná |
| Komponent | `scripts/check.js`, `scripts/coverage-gates.js` |
| Nájdené / dotknutá zostava | kontrola 2026-10-09; presná zostava len tam, kde je zaznamenaná nižšie |
| Prostredie / frekvencia | Samostatne nezaznamenané; nevyvodzujte frekvenciu z neskorších zelených behov |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie dáta

2026-10-09, negatívna kontrola súborového systému v pamäti

<a id="reproduction"></a>

## Reprodukcia

1. Zneprístupnite iba `spec/architecture.md` skutočným kontrolným funkciám bez zásahu do reálneho súboru.

Tento krok opakuje datovaný historický postup; nejde o novo vykonaný test.

<a id="expected-and-requirement"></a>

## Očakávané správanie a požiadavka

Chýbajúce povinné vstupy architektúry/hashov/zdroja/UI/E2E/kolekcie/page
object spôsobia zlyhanie vlastnej kontroly.

<a id="actual-observation"></a>

## Skutočné pozorovanie

C1 SKIP, potom `OK — 7 pass, 1 skip, 0 fail`, návratový kód 0.
Prázdne inventáre zdroja/UI tiež prešli vďaka nulovému počtu iterácií.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `scripts/check.js`](../../../../../scripts/check.js)
- [Zaznamenaný zdroj: `scripts/coverage-gates.js`](../../../../../scripts/coverage-gates.js)
- [Úplný pôvodný register, zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — nájdite nadpis `BUG-024`.

<a id="resolution-and-verification"></a>

## Vyriešenie a overenie

Aktuálny stav registra: **CLOSED**. Datované zosúladenie zaznamenáva: [kontroly chýbajúcich vstupov a prázdnych inventárov](../test-report-validator-controls.md); povinné statické brány prešli v aktuálnom API CI. Statické deklarácie nie sú behaviorálnym pokrytím.

Pôvodné skúmanie nižšie môže používať skorší štítok `IN PROGRESS` alebo „local/uncommitted“. Je zachované ako historický dôkaz, nie ako konkurenčný aktuálny stav. Táto migrácia dokumentácie nespustila nový scenár.

<a id="technical-investigation-and-dated-history"></a>

## Technické skúmanie a datovaná história

<details>
<summary>Otvoriť pôvodnú podrobnú správu/pozorovanie</summary>

<a id="bug-024--required-validator-inputs-could-disappear-with-a-green-result--high--in-progress"></a>

### BUG-024 · Povinné vstupy validátora mohli zmiznúť pri zelenom výsledku · High · IN PROGRESS

| Nájdené v | 2026-10-09, negatívna kontrola súborového systému v pamäti |
| Komponent | `scripts/check.js`, `scripts/coverage-gates.js` |

**Kroky reprodukcie:** zneprístupnite iba `spec/architecture.md`
skutočným kontrolným funkciám bez zásahu do reálneho súboru.
**Očakávané:** chýbajúce povinné vstupy architektúry/hashov/zdroja/UI/E2E/kolekcie/page
object spôsobia zlyhanie vlastnej kontroly.
**Skutočnosť pred opravou:** C1 SKIP, potom `OK — 7 pass, 1 skip, 0 fail`, návratový kód 0.
Prázdne inventáre zdroja/UI tiež prešli vďaka nulovému počtu iterácií.
**Príčina:** vetvy SKIP z čias scaffoldingu a prázdne cykly kolekcií.
**Oprava:** lokálna a necommitnutá; všetky zavedené povinné vstupy a neprázdne
inventáre zlyhajú pri neprítomnosti. Pre sondy sa neodstránil žiadny produkčný súbor.
**Regresia:** cielené kontroly chýbajúcich/prázdnych vstupov prešli; bežná kontrola má 8 úspešných,
0 preskočených, 0 neúspešných; inventár zdroja OpenAPI je 21/21.
**→ Žiadne pravidlo — jednorazový prípad.**

</details>
