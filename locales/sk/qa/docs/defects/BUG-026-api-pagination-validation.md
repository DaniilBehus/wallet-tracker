[English](../../../../../qa/docs/defects/BUG-026-api-pagination-validation.md) · **Slovenčina**

<a id="bug-026--unsafe-pagination-and-ids-bypassed-validation"></a>

# BUG-026 · Nebezpečné hodnoty stránkovania a ID obišli validáciu

[← Späť na README](../../../README.md#qa-evidence) · [Register chýb](../../../log/BUGS.md) · [Ďalej: index správ →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Nebezpečné hodnoty stránkovania a ID obišli HTTP validáciu a dostali sa na cesty interných chýb.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Chyba |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Vysoká |
| Priorita | Samostatne nezaznamenaná |
| Komponent | `src/validate.js`; trasy transakcií/kategórií |
| Nájdené / dotknutá zostava | HTTP kontrola 2026-10-09; presná zostava len tam, kde je zaznamenaná nižšie |
| Prostredie / frekvencia | Samostatne nezaznamenané; nevyvodzujte frekvenciu z neskorších zelených behov |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie dáta

2026-10-09, skutočná jednorazová HTTP kontraktová kontrola

<a id="reproduction"></a>

## Reprodukcia

1. Autentifikované GET `/api/transactions?offset=1e30`, potom skúste offset a vlastnené ID nad `Number.MAX_SAFE_INTEGER`.

Tento krok opakuje datovaný historický postup; nejde o novo vykonaný test.

<a id="expected-and-requirement"></a>

## Očakávané správanie a požiadavka

Nebezpečné celé čísla a zlyhania konverzie vracajú 400
`VALIDATION_FAILED`; bezpečné, ale neexistujúce vlastnené ID zostávajú 404.

<a id="actual-observation"></a>

## Skutočné pozorovanie

`offset=1e30` vrátil 500; `9007199254740992`
vrátilo 200 ako offset a 404 ako vlastnené ID. Objekt kategórie s nevolateľným
`toString` vrátil 500. Žiadny neplatný zápis nezmenil účtovnú knihu.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `src/validate.js`](../../../../../src/validate.js)
- [Zaznamenaný zdroj: `qa/docs/test-report-api-validation.md`](../test-report-api-validation.md)
- [Úplný pôvodný register, zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — nájdite nadpis `BUG-026`.

<a id="resolution-and-verification"></a>

## Vyriešenie a overenie

Aktuálny stav registra: **CLOSED**. Datované zosúladenie zaznamenáva: [HTTP zlyhania nebezpečných čísel a opravené regresie 400](../test-report-api-validation.md); kontraktové CI prešlo.

Pôvodné skúmanie nižšie môže používať skorší štítok `IN PROGRESS` alebo „local/uncommitted“. Je zachované ako historický dôkaz, nie ako konkurenčný aktuálny stav. Táto migrácia dokumentácie nespustila nový scenár.

<a id="technical-investigation-and-dated-history"></a>

## Technické skúmanie a datovaná história

<details>
<summary>Otvoriť pôvodnú podrobnú správu/pozorovanie</summary>

<a id="bug-026--unsafe-pagination-and-ids-bypassed-validation--high--in-progress"></a>

### BUG-026 · Nebezpečné hodnoty stránkovania a ID obišli validáciu · High · IN PROGRESS

| Nájdené v | 2026-10-09, skutočná jednorazová HTTP kontraktová kontrola |
| Komponent | `src/validate.js`; trasy transakcií/kategórií |

**Kroky reprodukcie:** autentifikované GET `/api/transactions?offset=1e30`,
potom skúste offset a vlastnené ID nad `Number.MAX_SAFE_INTEGER`.
**Očakávané:** nebezpečné celé čísla a zlyhania konverzie vracajú 400
`VALIDATION_FAILED`; bezpečné, ale neexistujúce vlastnené ID zostávajú 404.
**Skutočnosť pred opravou:** `offset=1e30` vrátil 500; `9007199254740992`
vrátilo 200 ako offset a 404 ako vlastnené ID. Objekt kategórie s nevolateľným
`toString` vrátil 500. Žiadny neplatný zápis nezmenil účtovnú knihu.
**Príčina:** `Number.isInteger` prijíma nebezpečne veľké hodnoty a `Number(raw)`
môže vyhodiť výnimku na objektoch JSON riadených používateľom.
**Oprava:** lokálna a necommitnutá; spoločné parsery vyžadujú bezpečné celé
čísla a mapujú výnimku pri konverzii na 400 pre konkrétne pole, pričom zachovávajú strop limitu.
**Regresia:** cielené pred opravou 0/2, po nej 2/2; úplný kontrakt 14/14 a 335
validovaných odpovedí; bezpečné maximum offsetu a kompatibilné konverzie kategórie
s kľúčom stále prechádzajú. [Podrobnosti](../test-report-api-validation.md).
**→ Žiadne pravidlo — jednorazový prípad.**

</details>
