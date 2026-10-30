[English](../../../../../qa/docs/defects/BUG-019-oversized-json-error.md) · **Slovenčina**

<a id="bug-019--oversized-json-is-reported-as-an-internal-server-failure"></a>

# BUG-019 · Príliš veľký JSON sa hlásil ako interné zlyhanie servera

[← Späť na README](../../../README.md#qa-evidence) · [Register chýb](../../../log/BUGS.md) · [Ďalej: index správ →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Príliš veľký JSON dostal odpoveď o internej chybe namiesto zamýšľanej odpovede o príliš veľkom tele požiadavky.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Chyba |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Stredná |
| Priorita | Samostatne nezaznamenaná |
| Komponent | `src/server.js` — parsovanie JSON a globálny handler chýb |
| Nájdené / dotknutá zostava | S21; presná zostava len tam, kde je zaznamenaná nižšie |
| Prostredie / frekvencia | Samostatne nezaznamenané; nevyvodzujte frekvenciu z neskorších zelených behov |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie dáta

S21, izolovaná HTTP validačná sonda

<a id="reproduction"></a>

## Reprodukcia

1. Odošlite na lokálny testovací server syntakticky platný JSON výdavok s poznámkou dlhou 110000 znakov ASCII cez POST.

Tento krok opakuje datovaný historický postup; nejde o novo vykonaný test.

<a id="expected-and-requirement"></a>

## Očakávané správanie a požiadavka

Riadená odpoveď o príliš veľkom tele požiadavky (413), nie INTERNAL.

<a id="actual-observation"></a>

## Skutočné pozorovanie

500 s error.code INTERNAL; body-parser hlási entity.too.large.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `src/server.js`](../../../../../src/server.js)
- [Úplný pôvodný register, zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — nájdite nadpis `BUG-019`.

<a id="resolution-and-verification"></a>

## Vyriešenie a overenie

Aktuálne rozhodnutie: **CLOSED**. Pole opravy v registri: publikované v `2face59`. Tento stav sa vzťahuje iba na zdokumentovaný nález a jeho vlastný regresný dôkaz.

Newman `POST /transactions with a body over the parser limit →
413, not 500 (BUG-019)`; pytest `test_ai_draft_with_the_feature_off_and_an_oversized_body`.
Oba kontrolujú stav a kód; pomocný nástroj Newman navyše kontroluje „never a 500“.

<a id="technical-investigation-and-dated-history"></a>

## Technické skúmanie a datovaná história

<details>
<summary>Otvoriť pôvodnú podrobnú správu/pozorovanie</summary>

<a id="bug-019--oversized-json-is-reported-as-an-internal-server-failure--medium--closed"></a>

### BUG-019 · Príliš veľký JSON sa hlásil ako interné zlyhanie servera · Medium · CLOSED

| | |
|---|---|
| Nájdené v | S21, izolovaná HTTP validačná sonda |
| Komponent | `src/server.js` — parsovanie JSON a globálny handler chýb |

**Kroky reprodukcie:** odošlite na lokálny testovací server syntakticky platný JSON výdavok
s poznámkou dlhou 110000 znakov ASCII cez POST.
**Očakávané:** riadená odpoveď o príliš veľkom tele požiadavky (413), nie INTERNAL.
**Skutočnosť:** 500 s error.code INTERNAL; body-parser hlási entity.too.large.
**Príčina:** entity.parse.failed sa spracúva, entity.too.large nie, takže predvolená cesta
500 nahrádza stav klientskej chyby z parsera.
**Oprava:** S23, necommitnuté. `src/server.js` mapuje `entity.too.large` na 413
`PAYLOAD_TOO_LARGE` v jedinom rendereri chýb, takže telo sa nikdy nedostane
do logu UNHANDLED. Globálny limit parsera je nezmenený; trasa návrhu AI
sama odmieta telá nad 8 KiB (400).
**Regresia:** Newman `POST /transactions with a body over the parser limit →
413, not 500 (BUG-019)`; pytest `test_ai_draft_with_the_feature_off_and_an_oversized_body`.
Oba kontrolujú stav a kód; pomocný nástroj Newman navyše kontroluje „never a 500“.
**→ Pravidlo R14.**

</details>
