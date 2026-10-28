[English](../../../../../qa/docs/defects/BUG-011-startup-database-lock.md) · **Slovenčina**

<a id="bug-011--two-servers-started-at-once-on-one-database-and-one-dies-at-boot"></a>

# BUG-011 · Dva servery spustené naraz nad jednou databázou; jeden zlyhal pri štarte

[← Späť na README](../../../README.md#qa-evidence) · [Register chýb](../../../log/BUGS.md) · [Ďalej: index správ →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Spustenie dvoch serverov nad jednou databázou SQLite odhalilo v jednom procese zlyhanie zámku pri štarte.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Chyba |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Stredná |
| Priorita | Samostatne nezaznamenaná |
| Komponent | `src/db.js` — štartovacie pragmy |
| Nájdené / dotknutá zostava | S16; presná zostava len tam, kde je zaznamenaná nižšie |
| Prostredie / frekvencia | Samostatne nezaznamenané; nevyvodzujte frekvenciu z neskorších zelených behov |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie dáta

S16, prvý pokus `qa/race/` spustiť dva servery nad jedným súborom

<a id="reproduction"></a>

## Reprodukcia

1. Vymažte databázový súbor a potom v rovnakom okamihu spustite dva servery s rovnakou cestou `DB_PATH`. Pri zaťažení CPU jeden z nich zlyhá skôr, než začne počúvať.

Tento krok opakuje datovaný historický postup; nejde o novo vykonaný test.

<a id="expected-and-requirement"></a>

## Očakávané správanie a požiadavka

Oba sa spustia. Aplikácia nikde netvrdí, že databázu môže používať iba jeden
proces, a SQLite je na takéto používanie vytvorené.

<a id="actual-observation"></a>

## Skutočné pozorovanie

```
SqliteError: database is locked
    at Database.pragma (better-sqlite3/lib/methods/pragma.js:11:44)
    at Object.<anonymous> (src/db.js:16:4)
  code: 'SQLITE_BUSY'
```

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `qa/race/`](../../../../../qa/race)
- [Zaznamenaný zdroj: `src/db.js`](../../../../../src/db.js)
- [Úplný pôvodný register, zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — nájdite nadpis `BUG-011`.
- [GitHub Issue #12](https://github.com/DaniilBehus/wallet-tracker/issues/12) — externé metadáta sa môžu líšiť; dokumentačnou autoritou stavu je lokálny register.

<a id="resolution-and-verification"></a>

## Vyriešenie a overenie

**CLOSED.** Štart databázy teraz nastaví `busy_timeout` ako prvý, opakuje kroky PRAGMA/schémy citlivé na zámok najviac päť sekúnd a pred zmenou číta režim žurnálu. Pri rovnakých šiestich procesoch zaťažujúcich CPU mal starý kód **2 štartové zlyhania v 20 pokusoch** a opravený **0 v 20**; `qa/race/` tiež pri každom behu spúšťa dva servery nad jedným súborom. Tento mechanizmus zámku pri štarte je oddelený od upgradu odloženej zápisovej transakcie BUG-012.

<a id="technical-investigation-and-dated-history"></a>

## Technické skúmanie a datovaná história

<details>
<summary>Otvoriť pôvodnú podrobnú správu/pozorovanie</summary>

<a id="bug-011--two-servers-started-at-once-on-one-database-and-one-dies-at-boot--medium--closed"></a>

### BUG-011 · Dva servery spustené naraz nad jednou databázou; jeden zlyhal pri štarte · Medium · CLOSED

| | |
|---|---|
| Nájdené v | S16, prvý pokus `qa/race/` spustiť dva servery nad jedným súborom |
| Komponent | `src/db.js` — štartovacie pragmy |

**Kroky reprodukcie:** vymažte databázový súbor a potom v rovnakom
okamihu spustite dva servery s rovnakou cestou `DB_PATH`. Pri zaťažení
CPU jeden z nich zlyhá skôr, než začne počúvať.

**Očakávané:** oba sa spustia. Aplikácia nikde netvrdí, že databázu
môže používať iba jeden proces, a SQLite je na takéto používanie vytvorené.

**Skutočnosť:**

```
SqliteError: database is locked
    at Database.pragma (better-sqlite3/lib/methods/pragma.js:11:44)
    at Object.<anonymous> (src/db.js:16:4)
  code: 'SQLITE_BUSY'
```

**Príčina:** `db.pragma('journal_mode = WAL')` potrebuje zámok, ktorý
nedrží iné spojenie. Na **čerstvom** súbore sa o prepnutie pokúšajú oba
procesy a porazený dostane SQLITE_BUSY. Neskoršie štarty nie sú dotknuté —
súbor už je vo WAL a príkaz nič nemení — preto je to chyba prvého štartu
a preto zostala tak dlho skrytá.

Samotný `busy_timeout` ju neopraví, a práve toto zistenie je užitočné:
po jeho pridaní jeden beh stále zlyhal — tentoraz pri **čítaní**
`journal_mode`. Niektoré vetvy pragmy odmietajú namiesto zaradenia
do radu a na čítanie pragmy, ktoré zlyhá, nemožno čakať.

**Meranie, pretože prvý pokus o reprodukciu nevyšiel a chybu, ktorú
nemožno vyvolať na požiadanie, by bol len príbeh:**

| | zlyhania |
|---|---|
| pôvodný kód, nezaťažený počítač, 42 pokusov | 0 |
| pôvodný kód, **6 procesov zaťažujúcich CPU**, 20 pokusov | **2** (SQLITE_BUSY) |
| opravený kód, rovnaké zaťaženie, 20 pokusov | 0 |

Zaťaženie je spúšťač: rozširuje okno medzi zápisom schémy prvého procesu
a pragmou druhého. Dve skoršie pozorovania nastali pri zaťaženom počítači,
čo vtedy vyzeralo ako náhoda.

**Oprava:** najprv `busy_timeout`, potom pomocná funkcia `whileLocked(label, step)`,
ktorá opakuje štartovací krok najviac päť sekúnd, kým SQLite hlási zámok —
aplikuje sa na pragmy a opakovanie schémy. Režim žurnálu sa teraz
**číta pred nastavením**, takže sporný zápis nastane iba pri tom jedinom
štarte, ktorý ho musí vykonať.

**Regresia:** rámec 20 pokusov pri zaťažení a samotné `qa/race/`,
ktoré pri každom behu spúšťa dva servery nad jedným súborom.

**→ Pravidlo R12.**

---

</details>
