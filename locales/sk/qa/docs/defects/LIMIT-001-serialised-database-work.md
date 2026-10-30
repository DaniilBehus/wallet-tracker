[English](../../../../../qa/docs/defects/LIMIT-001-serialised-database-work.md) · **Slovenčina**

<a id="limit-001--every-request-queues-behind-database-work--23-slower-under-write-load"></a>

# LIMIT-001 · Každá požiadavka čaká za databázovou prácou — pri záťaži zápismi je 23× pomalšia

[← Späť na README](../../../README.md#qa-evidence) · [Register defektov](../../../log/BUGS.md) · [Ďalej: index hlásení →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Pri nameranej záťaži zápismi databázová práca vykonávala požiadavky postupne a latenciu kontroly zdravia zvýšila približne 23-krát. Ide o prijaté konštrukčné obmedzenie, nie o defekt produktu.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Prijaté konštrukčné obmedzenie |
| Stav | **ACCEPTED** — aktuálny kanonický register |
| Závažnosť | Neuplatňuje sa |
| Priorita | Nezaznamenaná samostatne |
| Komponent | `src/db.js` — `better-sqlite3`, zámerne synchrónny |
| Zistené / dotknutá verzia | S07; presná verzia len tam, kde je uvedená nižšie |
| Prostredie / frekvencia | Node v24.13.1, lokálny server na porte 3100, režim WAL; frekvencia len tam, kde je uvedená nižšie |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie údaje

S07, záťažový smoke test k6 `qa/load/expense-write.js`

<a id="observation-or-measurement-procedure"></a>

## Postup pozorovania alebo merania

1. 50 používateľov zapisuje výdavky čo najrýchlejšie počas 30 sekúnd; pritom sa meria `GET /api/health` a predtým ešte 5 sekúnd na nezaťaženom serveri.

Tento krok pripomína historický postup; nejde o novospustený test.

<a id="expected-and-requirement"></a>

## Očakávanie a požiadavka

Ide o nameranú hranicu výkonu, nie o nesplnené funkčné tvrdenie. Datovaný záťažový smoke test určuje prah aj pracovnú záťaž.

<a id="actual-observation"></a>

## Skutočné pozorovanie

Pri 50 zapisujúcich počas 30 sekúnd vzrástol p95 `GET /api/health` z **1.4 ms bez záťaže na 32.4 ms pod záťažou** (23.4×). Požiadavka zostala hlboko pod prahom testu 250 ms; nárast však odhalil synchrónne vykonávanie požiadaviek jednu po druhej.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `qa/load/expense-write.js`](../../../../../qa/load/expense-write.js)
- [Zaznamenaný zdroj: `src/db.js`](../../../../../src/db.js)
- [Úplný pôvodný register zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — vyhľadajte nadpis `LIMIT-001`.
- [GitHub Issue #11](https://github.com/DaniilBehus/wallet-tracker/issues/11) — externé metadáta sa môžu líšiť; stav dokumentácie určuje lokálny register.

<a id="resolution-and-verification"></a>

## Oprava a overenie

**ACCEPTED konštrukčné obmedzenie, nie defekt.** Práca `better-sqlite3` je synchrónna na jednej slučke udalostí Node, takže zápisy zaraďujú ostatné požiadavky do frontu aj pri SQLite WAL. Datovaný záťažový smoke test nameral zmenu p95 kontroly zdravia 1.4→32.4 ms bez prekročenia prahu alebo strateného zápisu. Kompromis je zdokumentovaný; toto hlásenie netvrdí, že došlo k oprave výkonu alebo novému záťažovému behu.

<a id="technical-investigation-and-dated-history"></a>

## Technické vyšetrovanie a datovaná história

<details>
<summary>Otvoriť pôvodné podrobné hlásenie/pozorovanie</summary>

<a id="original-report-limit-001--every-request-queues-behind-database-work--23-slower-under-write-load"></a>

### Pôvodné hlásenie: LIMIT-001 · Každá požiadavka čaká za databázovou prácou — pri záťaži zápismi je 23× pomalšia

[← Späť na README](../../../README.md#qa-evidence) · [Ďalej: test záťaže zápismi →](../../../../../qa/load/expense-write.js)

![typ](https://img.shields.io/badge/type-limit-blueviolet?style=flat-square)
![stav](https://img.shields.io/badge/state-ACCEPTED-blue?style=flat-square)

| | |
|---|---|
| **Typ** | Obmedzenie — nameraná hranica návrhu, **nie defekt** |
| **Stav** | ACCEPTED 2026-09-02 |
| **Zistené pomocou** | TC-LOAD-001, `qa/load/expense-write.js` (k6) |
| **Komponent** | `src/db.js` — `better-sqlite3`, zámerne synchrónny |
| **Prostredie** | Node v24.13.1, lokálny server na porte 3100, režim WAL |
| **Opravené v** | — nie je čo opravovať; prijaté so zaznamenanou hodnotou |

<a id="why-this-is-here-at-all"></a>

## Prečo je to tu

`LIMIT-###` nie je identifikátor defektu. Tento záznam existuje,
pretože sa zapisuje všetko, čo záťažový smoke test zistil,
a pretože namerané a zdokumentované obmedzenie je **rozhodnutie**,
zatiaľ čo rovnaké obmedzenie objavené v produkcii je **incident**.

Zámerne zostáva v rovnakom registri ako defekty, ale s iným prefixom:
rozdiel nesie taxonómia, takže ho text nemusí zakaždým vysvetľovať.

<a id="what-was-measured"></a>

## Čo sa meralo

50 používateľov zapisovalo výdavky čo najrýchlejšie počas 30 sekúnd;
`GET /api/health` sa meral po celý čas a predtým päť sekúnd
na nezaťaženom serveri.

<details>
<summary>Výstup k6</summary>

```
writes            79322 requests, 2097/s
failed            0.000 %
server errors     0
write latency     avg 19.0 ms   p95 26.4 ms   max 55.7 ms

GET /api/health - the same trivial request, measured twice:
  idle            avg 1.0 ms    p95 1.4 ms
  under load      avg 19.5 ms   p95 32.4 ms
  cost of load    23.4x slower at p95
```

</details>

<a id="what-was-expected-and-did-not-happen"></a>

## Čo sa očakávalo a nestalo

`SQLITE_BUSY`, zamknutá databáza, 5xx, poškodený riadok,
stratený zápis.

**Nič z toho sa neobjavilo. 79 322 zápisov, nula chýb.**
Treba to povedať rovnako jasne ako pri zlyhaní:
to, čo smoke test hľadal, sa neobjavilo; správa zaznamenávajúca
len zásahy by potichu nadhodnotila vlastné pokrytie.

<a id="why-it-is-not-there"></a>

## Prečo sa to neobjavilo

`better-sqlite3` je synchrónny a Node jednovláknový,
takže zápisy sa v jednom procese nemôžu skutočne prekrývať.
Slučka udalostí ich zoradí ešte predtým, než SQLite uvidí súbeh,
a o zvyšok sa postará režim WAL.

**Ten istý návrh spôsobuje spomalenie aj bráni poškodeniu.**
To je celé zistenie.

<a id="the-limit-stated"></a>

## Vyjadrené obmedzenie

Priepustnosť je približne **2 100 zápisov/sekundu** a počas
vyťaženia databázy je každá požiadavka — aj tá, ktorá databázu
nepoužíva — približne **20× pomalšia**.

Pri osobnej aplikácii s jedným používateľom sa to neprejaví.
Domácnosť so štyrmi ľuďmi to nikdy neuvidí. Význam by to
malo, ak by aplikácia získala viacerých nájomcov; vtedy
riešením nie je rýchlejší dotaz, ale presun práce mimo
vlákna spracúvajúceho požiadavky.

<a id="not-the-same-as-bug-004"></a>

## Nie je to to isté ako BUG-004

Rovnaký mechanizmus, rozdiel dvoch rádov:

| | LIMIT-001 | [BUG-004](BUG-004-bcrypt-blocks-event-loop.md) |
|---|---|---|
| Za čím sa tvorí front | ~0.5 ms databázovej práce | ~50 ms zámerne náročného výpočtu CPU |
| Cena pre nesúvisiacu požiadavku | 23× | 1495× |
| Príčina | knižnica bez asynchrónnej formy | volanie `Sync` s asynchrónnym ekvivalentom |
| Výsledok | prijaté | opravené |

Posledný riadok vyplýva z tretieho. Prvý prípad nemá opravu,
ktorá zachová návrh; druhý mal opravu zmenou jedného slova.

<a id="accepted"></a>

## Prijaté

Na základe vyššie uvedeného. Ak aplikácia získa druhého
skutočne súbežného používateľa, tento záznam bude
východiskovým bodom, nie prekvapením.

<a id="-rule-r6"></a>

## → Pravidlo R6

Merajte ten istý lacný endpoint bez záťaže a pod záťažou
**v jednom behu**. Bez východiskovej hodnoty 32 ms vyzerá v poriadku.


</details>
