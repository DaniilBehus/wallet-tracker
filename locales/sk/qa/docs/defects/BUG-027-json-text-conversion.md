[English](../../../../../qa/docs/defects/BUG-027-json-text-conversion.md) · **Slovenčina**

<a id="bug-027--non-convertible-noteicon-json-returned-internal-errors"></a>

# BUG-027 · Nekonvertovateľný JSON poznámky/ikony vracal interné chyby

[← Späť na README](../../../README.md#qa-evidence) · [Register chýb](../../../log/BUGS.md) · [Ďalej: index správ →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Hodnoty JSON s nekonvertovateľnými poľami poznámky alebo ikony vracali interné chyby namiesto validačných zlyhaní.

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

1. Odošlite `{ "toString": null }` alebo pole, ktoré ho obsahuje, ako poznámku výdavku (POST bez kľúča, POST s kľúčom, PATCH) alebo ikonu kategórie.

Tento krok opakuje datovaný historický postup; nejde o novo vykonaný test.

<a id="expected-and-requirement"></a>

## Očakávané správanie a požiadavka

400 `VALIDATION_FAILED`, bez zápisu alebo rezervácie kľúča.

<a id="actual-observation"></a>

## Skutočné pozorovanie

Všetkých osem testovaných požiadaviek vrátilo 500. Číselné,
logické, bežné objektové/polové, null a reťazcové hodnoty sa stále konvertovali normálne.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `src/validate.js`](../../../../../src/validate.js)
- [Zaznamenaný zdroj: `qa/docs/test-report-api-validation.md`](../test-report-api-validation.md)
- [Úplný pôvodný register, zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — nájdite nadpis `BUG-027`.

<a id="resolution-and-verification"></a>

## Vyriešenie a overenie

Aktuálny stav registra: **CLOSED**. Datované zosúladenie zaznamenáva: [HTTP zlyhania nekonvertovateľného textu/ikony a opravené regresie 400](../test-report-api-validation.md); kontraktové CI prešlo.

Pôvodné skúmanie nižšie môže používať skorší štítok `IN PROGRESS` alebo „local/uncommitted“. Je zachované ako historický dôkaz, nie ako konkurenčný aktuálny stav. Táto migrácia dokumentácie nespustila nový scenár.

<a id="technical-investigation-and-dated-history"></a>

## Technické skúmanie a datovaná história

<details>
<summary>Otvoriť pôvodnú podrobnú správu/pozorovanie</summary>

<a id="bug-027--non-convertible-noteicon-json-returned-internal-errors--high--in-progress"></a>

### BUG-027 · Nekonvertovateľný JSON poznámky/ikony vracal interné chyby · High · IN PROGRESS

| Nájdené v | 2026-10-09, skutočná jednorazová HTTP kontraktová kontrola |
| Komponent | `src/validate.js`; trasy transakcií/kategórií |

**Kroky reprodukcie:** odošlite `{ "toString": null }` alebo pole, ktoré ho obsahuje,
ako poznámku výdavku (POST bez kľúča, POST s kľúčom, PATCH) alebo ikonu kategórie.
**Očakávané:** 400 `VALIDATION_FAILED`, bez zápisu alebo rezervácie kľúča.
**Skutočnosť pred opravou:** všetkých osem testovaných požiadaviek vrátilo 500. Číselné,
logické, bežné objektové/polové, null a reťazcové hodnoty sa stále konvertovali normálne.
**Príčina:** priama konverzia `String(value)` mohla vyhodiť výnimku pre hodnotu JSON,
ktorej konverznú metódu zatienil vstup klienta.
**Oprava:** lokálna a necommitnutá; jeden validátor nullable textu zachytáva iba
zlyhanú konverziu, používa sa pri kanonikalizácii s kľúčom aj ukladaní
bez zmeny prijatého tvaru payloadu/hasha.
**Regresia:** osem neplatných odpovedí má teraz 400; prijaté rozdelenia typov,
opakovanie s kľúčom a kanonická ekvivalencia null/vynechaného poľa prechádzajú. Úplný kontrakt 14/14,
335 validovaných odpovedí. [Podrobnosti](../test-report-api-validation.md).
**→ Žiadne pravidlo — jednorazový prípad.**

</details>
