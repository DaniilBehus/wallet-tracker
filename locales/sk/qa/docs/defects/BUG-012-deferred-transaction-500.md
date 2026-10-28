[English](../../../../../qa/docs/defects/BUG-012-deferred-transaction-500.md) · **Slovenčina**

<a id="bug-012--two-processes-writing-one-database-answer-500"></a>

# BUG-012 · Dva procesy zapisujúce do jednej databázy odpovedajú 500

[← Späť na README](../../../README.md#qa-evidence) · [Register defektov](../../../log/BUGS.md) · [Ďalej: index hlásení →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Súbežné zaplatenie a úprava plánovanej platby na dvoch serverových procesoch vyvolali odpovede 500 pri 4 zo 40 dvojíc, napriek päťsekundovému limitu čakania na zámok.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Defekt |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Vysoká |
| Priorita | P1 — stav, ktorý je podľa špecifikácie nedosiahnuteľný |
| Komponent | `src/routes/schedules.js` — obe transakcie |
| Zistené / dotknutá verzia | S16; presná verzia len tam, kde je uvedená nižšie |
| Prostredie / frekvencia | Windows 11, Node v24.13.1, better-sqlite3 13.0.3, SQLite WAL; pred opravou vrátili 500 4 zo 40 medziprocesových dvojíc |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie údaje

S16, scenár C v `qa/race/`

<a id="reproduction"></a>

## Reprodukcia

1. `npm run test:race`. Scenár C spláca pôžičku na jednom serveri a zároveň ju upravuje na druhom, pričom oba zdieľajú jeden databázový súbor.

Tento krok pripomína historický postup; nejde o novospustený test.

<a id="expected-and-requirement"></a>

## Očakávanie a požiadavka

Obe požiadavky majú uspieť alebo jedna musí dostať zrozumiteľnú odpoveď na súbeh; spec §5 klasifikuje neošetrenú 500 ako stav, **ktorý nesmie byť dostupný cez UI**. Zámok databázy sa nesmie prejaviť ako interné zlyhanie servera.

<a id="actual-observation"></a>

## Skutočné pozorovanie

4 zo 40 dvojíc odpovedali 500.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `qa/race/`](../../../../../qa/race)
- [Zaznamenaný zdroj: `src/routes/schedules.js`](../../../../../src/routes/schedules.js)
- [Zaznamenaný zdroj: `qa/race/run.js`](../../../../../qa/race/run.js)
- [Úplný pôvodný register zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — vyhľadajte nadpis `BUG-012`.
- [GitHub Issue #13](https://github.com/DaniilBehus/wallet-tracker/issues/13) — externé metadáta sa môžu líšiť; stav dokumentácie určuje lokálny register.

<a id="resolution-and-verification"></a>

## Oprava a overenie

**CLOSED.** Transakcie čítanie–rozhodnutie–zápis pri zaplatení/úprave teraz používajú `BEGIN IMMEDIATE` a získajú zámok SQLite na zápis ešte pred čítaním; `busy_timeout` potom môže zaradiť druhého zapisujúceho do frontu namiesto zlyhania pri povýšení odloženého zámku. V zaznamenanom dvojprocesovom teste súbehu **predtým vrátili 500 4 zo 40 dvojíc** a **potom všetkých 40 zo 40 vrátilo 200**, bez porušenia invariantov. Pôvodné hlásenie uvádza cenu dlhšieho držania zámku na zápis; pri tomto prepise sa nový test súbehu nespúšťal.

<a id="technical-investigation-and-dated-history"></a>

## Technické vyšetrovanie a datovaná história

<details>
<summary>Otvoriť pôvodné podrobné hlásenie/pozorovanie</summary>

<a id="original-report-bug-012--two-processes-writing-one-database-answer-500"></a>

### Pôvodné hlásenie: BUG-012 · Dva procesy zapisujúce do jednej databázy odpovedajú 500

[← Späť na README](../../../README.md#qa-evidence) · [Ďalej: zdroj testu súbehu →](../../../../../qa/race/run.js)

![závažnosť](https://img.shields.io/badge/severity-High-orange?style=flat-square)
![stav](https://img.shields.io/badge/state-CLOSED-brightgreen?style=flat-square)

| | |
|---|---|
| **Závažnosť** | Vysoká |
| **Priorita** | P1 — stav, ktorý je podľa špecifikácie nedosiahnuteľný |
| **Stav** | CLOSED 2026-09-06 |
| **Zistené pomocou** | scenár C v `qa/race/`, pri prvom behu s dvoma spustenými servermi |
| **Komponent** | `src/routes/schedules.js` — obe transakcie |
| **Dopad na** | každé nasadenie s viac než jedným serverovým procesom nad jednou databázou |
| **Prostredie** | Windows 11, Node v24.13.1, better-sqlite3 13.0.3, WAL |
| **Opravené v** | Opravené. Pôvodný commit nie je súčasťou tejto verejnej snímky. |
<a id="summary"></a>

## Zhrnutie

Splácajte pôžičku na jednom serveri a súčasne ju upravujte na druhom,
pričom oba používajú jeden súbor SQLite — **4 dvojice zo 40 odpovedia 500**.

Spec §5 uvádza 500 ako „neošetrené — **nikdy nesmie byť dostupné cez UI**“.
Bolo dostupné a nikto si to predtým nevšimol len preto, že pred touto
reláciou nikto nespustil dva servery nad jednou databázou.

<a id="what-the-run-said"></a>

## Čo hlásil beh

<details>
<summary>Scenár C pred opravou</summary>

```
C · pay vs edit — TWO processes, one database file
  outcomes
      36 × pay 200 · edit 200
       4 × pay 200 · edit 500
    violations: 4

4 invariant violations:
  C pair 14: a 5xx (pay 200, edit 500)
  C pair 22: a 5xx (pay 200, edit 500)
  C pair 27: a 5xx (pay 200, edit 500)
  C pair 37: a 5xx (pay 200, edit 500)
```

```
SqliteError: database is locked
    at src/routes/schedules.js:199:8
    at sqliteTransaction (better-sqlite3/lib/methods/transaction.js:65:24)
  code: 'SQLITE_BUSY'
```

</details>

<a id="root-cause"></a>

## Príčina

**Typ transakcie, nie kód v nej.**

`db.transaction(fn)` vydá obyčajné `BEGIN`, ktoré SQLite považuje
za **odložené**: transakcia pri štarte získa zámok na *čítanie*
a pri prvom zápise sa ho pokúsi povýšiť na zámok na *zápis*.
Ak medzitým zapisovalo iné spojenie, povýšenie nemôže uspieť —
snímka, ktorú transakcia čítala, je už neaktuálna —
a SQLite ju **okamžite** odmietne s `SQLITE_BUSY`.

Kľúčové je, že **`busy_timeout` sa na toto odmietnutie nevzťahuje**.
Čakanie nemá zmysel, ak už prečítané údaje zastarali,
preto SQLite nečaká. Päťsekundový limit pridaný pri predchádzajúcom
defekte (BUG-011) tu nič nechráni.

Dva defekty, oba hlásia „database is locked“, no majú odlišné
mechanizmy a opravy. V tom je pasca: druhý vyzeral ako opakovanie
prvého; dlhší limit by priniesol rovnaké odpovede 500.

<a id="fix"></a>

## Oprava

```js
res.status(200).json(pay.immediate());
res.status(200).json(edit.immediate());
```

`BEGIN IMMEDIATE` získava zámok na zápis **vopred**,
pred čítaním. Žiadne povýšenie nemôže zlyhať a na získanie
tohto zámku sa `busy_timeout` vzťahuje — druhý zapisujúci
tak čaká vo fronte až päť sekúnd namiesto odmietnutia.

Zovšeobecnené pravidlo a jeho miesto: **D-030** —
každý handler, ktorý prečíta riadok, rozhodne sa podľa neho
a zapisuje, vykoná všetky tri kroky v jednej transakcii
`.immediate()`.

<a id="regression"></a>

## Regresia

```
before   4 of 40 cross-process pairs answered 500
after    40 of 40 answered 200, zero invariant violations
```

`qa/race/` pri každom spustení používa dva servery nad jednou
databázou, takže podmienka sa skutočne vykonáva.

<a id="what-this-cost-stated"></a>

## Cena tejto opravy

`BEGIN IMMEDIATE` drží zámok na zápis dlhšie. Pri intenzívnom
medziprocesovom zapisovaní preto zapisujúci čakajú tam,
kde by odložený začiatok mohol ešte prejsť. Čakajúca požiadavka
je pomalá; odmietnutá je 500. Táto výmena je správna,
ale nie bez nákladov a zatiaľ ju nič nemeria —
záťažový smoke test spúšťa jeden proces na skript.
Zaznamenané ako otvorená časť D-030.

<a id="-rule-r12"></a>

## → Pravidlo R12

V SQLite v režime WAL musí transakcia, ktorá bude zapisovať,
použiť `BEGIN IMMEDIATE`. Odložená transakcia povyšujúca
zámok na zápis sa odmietne, nie zaradí do frontu,
a `busy_timeout` ju nezachráni.


</details>
