[English](../../../../../qa/docs/defects/BUG-016-registration-race.md) · **Slovenčina**

<a id="bug-016--concurrent-registrations-of-the-same-email-return-500"></a>

# BUG-016 · Súbežné registrácie rovnakého e-mailu vracali 500

[← Späť na README](../../../README.md#qa-evidence) · [Register chýb](../../../log/BUGS.md) · [Ďalej: index správ →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Dve súbežné registrácie rovnakého e-mailu mohli vrátiť internú chybu servera namiesto riadenej odpovede o duplicitnom účte.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Chyba |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Vysoká |
| Priorita | Samostatne nezaznamenaná |
| Komponent | registrácia v `src/auth.js`, `src/schema.sql` users.email UNIQUE |
| Nájdené / dotknutá zostava | S21; presná zostava len tam, kde je zaznamenaná nižšie |
| Prostredie / frekvencia | Samostatne nezaznamenané; nevyvodzujte frekvenciu z neskorších zelených behov |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie dáta

S21, päť párov súbežných registračných požiadaviek

<a id="reproduction"></a>

## Reprodukcia

1. Odošlite dve súbežné požiadavky POST /api/auth/register s rovnakým novým syntetickým e-mailom a platným heslom; zopakujte s čerstvými e-mailmi.

Tento krok opakuje datovaný historický postup; nejde o novo vykonaný test.

<a id="expected-and-requirement"></a>

## Očakávané správanie a požiadavka

Jedna 201, jeden riadený konflikt duplicitného e-mailu, nie INTERNAL.

<a id="actual-observation"></a>

## Skutočné pozorovanie

Všetkých 5 párov vracia 201 + 500; server vidí SQLITE_CONSTRAINT_UNIQUE.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `src/auth.js`](../../../../../src/auth.js)
- [Zaznamenaný zdroj: `src/schema.sql`](../../../../../src/schema.sql)
- [Zaznamenaný zdroj: `qa/race/run.js`](../../../../../qa/race/run.js)
- [Úplný pôvodný register, zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — nájdite nadpis `BUG-016`.

<a id="resolution-and-verification"></a>

## Vyriešenie a overenie

Aktuálne rozhodnutie: **CLOSED**. Pole opravy v registri: e291ea9. Tento stav sa vzťahuje iba na zdokumentovaný nález a jeho vlastný regresný dôkaz.

Scenár E v `qa/race/run.js` — dve registrácie jednej čerstvej
adresy, odoslané naraz dvom serverovým procesom zdieľajúcim jednu databázu, 120 párov
na beh. Invariant: jedna 201 a jedna 409, v ľubovoľnom poradí; akékoľvek 5xx alebo druhá
201 sú porušením. Kontrola: po odstránení mapovania scenár hlási
`201 · 500` a porušenie v každom páre (3 z 3 v kontrolnom behu), so
`SQLITE_CONSTRAINT_UNIQUE` v serverovom logu; s opravou 0 porušení.

<a id="technical-investigation-and-dated-history"></a>

## Technické skúmanie a datovaná história

<details>
<summary>Otvoriť pôvodnú podrobnú správu/pozorovanie</summary>

<a id="bug-016--concurrent-registrations-of-the-same-email-return-500--high--closed"></a>

### BUG-016 · Súbežné registrácie rovnakého e-mailu vracali 500 · High · CLOSED

| | |
|---|---|
| Nájdené v | S21, päť párov súbežných registračných požiadaviek |
| Komponent | registrácia v `src/auth.js`, `src/schema.sql` users.email UNIQUE |

**Kroky reprodukcie:** odošlite dve súbežné požiadavky POST /api/auth/register
s rovnakým novým syntetickým e-mailom a platným heslom; zopakujte s čerstvými e-mailmi.
**Očakávané:** jedna 201, jeden riadený konflikt duplicitného e-mailu, nie INTERNAL.
**Skutočnosť:** všetkých 5 párov vracia 201 + 500; server vidí SQLITE_CONSTRAINT_UNIQUE.
**Príčina:** obe kontroly SELECT skončia pred asynchrónnym bcrypt.hash; prehrávajúci
INSERT poruší UNIQUE, čo sa nemapuje na konfliktovú chybu aplikácie.
**Oprava:** aplikovaná v commite `e291ea9`. Vloženie a štartovacie kategórie
sú teraz v jednej `db.transaction`, takže účet už nemôže existovať bez potrebných
riadkov; `SQLITE_CONSTRAINT_UNIQUE` z tohto zápisu sa prekladá na rovnaký
`conflict` ako predbežné čítanie — 409, nie 500. Predbežné čítanie zostáva
rýchlou cestou, ktorá sa vyhne hashovaniu zjavného duplikátu; už sa nepovažuje
za ochranu, pretože ňou nemôže byť: `bcrypt.hash` uvoľní vykonávanie a obe
požiadavky cez neho prejdú skôr, než ktorákoľvek zapíše.
**Regresia:** scenár E v `qa/race/run.js` — dve registrácie jednej čerstvej
adresy, odoslané naraz dvom serverovým procesom zdieľajúcim jednu databázu, 120 párov
na beh. Invariant: jedna 201 a jedna 409, v ľubovoľnom poradí; akékoľvek 5xx
alebo druhá 201 sú porušením. Kontrola: po odstránení mapovania scenár hlási
`201 · 500` a porušenie v každom páre (3 z 3 v kontrolnom behu), so
`SQLITE_CONSTRAINT_UNIQUE` v serverovom logu; s opravou 0 porušení.
**→ Pravidlo R14.**

</details>
