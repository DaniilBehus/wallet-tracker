[English](../../../../../qa/docs/defects/BUG-010-runner-green-on-no-server.md) · **Slovenčina**

<a id="bug-010--the-api-runner-exits-0-when-the-server-never-starts-so-ci-called-it-green"></a>

# BUG-010 · API runner vráti 0, aj keď sa server nikdy nespustí, takže CI hlásilo úspech

[← Späť na README](../../../README.md#qa-evidence) · [Register defektov](../../../log/BUGS.md) · [Ďalej: index hlásení →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

API runner mohol skončiť úspešne, aj keď sa server nikdy nespustil, a tým vytvoriť falošný zelený signál CI.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Defekt |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Kritická |
| Priorita | P0 — brána hlási úspech bez toho, aby čokoľvek skontrolovala |
| Komponent | `qa/api/run.js` — `main` |
| Zistené / dotknutá verzia | S15; presná verzia len tam, kde je uvedená nižšie |
| Prostredie / frekvencia | ubuntu-latest, Node 20; reprodukované lokálne na Windows, Node 24; frekvencia len tam, kde je uvedená nižšie |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie údaje

S15, čítanie logov CI behu, ktorý BUG-009 zmenil na červený

<a id="reproduction"></a>

## Reprodukcia

1. spôsobte zlyhanie štartu servera, potom spustite `npm run test:api` a prečítajte návratový kód.

Tento krok pripomína historický postup; nejde o novospustený test.

<a id="expected-and-requirement"></a>

## Očakávanie a požiadavka

Ak sa server nespustí, API runner musí skončiť nenulovým kódom a CI nesmie hlásiť úspešnú skupinu API.

<a id="actual-observation"></a>

## Skutočné pozorovanie

API runner po zlyhaní štartu skončil s kódom 0, takže CI mohlo označiť API beh za zelený, hoci žiadny server neodpovedal na požiadavku. Pôvodné hlásenie nižšie obsahuje presný pôvodne zlyhávajúci príkaz a výstup.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `qa/api/run.js`](../../../../../qa/api/run.js)
- [Zaznamenaný zdroj: `qa/reports/`](../../../../../qa/reports)
- [Úplný pôvodný register zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — vyhľadajte nadpis `BUG-010`.
- [GitHub Issue #10](https://github.com/DaniilBehus/wallet-tracker/issues/10) — externé metadáta sa môžu líšiť; stav dokumentácie určuje lokálny register.

<a id="resolution-and-verification"></a>

## Oprava a overenie

**CLOSED.** `process.exitCode` sa teraz nastavuje pred čistením, ukončenie servera sa sleduje od jeho spustenia a čakanie má ohraničený päťsekundový limit. Zaznamenaná negatívna kontrola s obsadeným portom spôsobila zlyhanie servera (`EADDRINUSE` / kontrola zdravia nebola pripravená) a runner skončil s kódom **1**; bežná zelená cesta stále dokončila **93 požiadaviek, 340 tvrdení, 93 vykonaných skriptov a kód 0**. Ide o historickú regresiu, nie o nový test.

<a id="technical-investigation-and-dated-history"></a>

## Technické vyšetrovanie a datovaná história

<details>
<summary>Otvoriť pôvodné podrobné hlásenie/pozorovanie</summary>

<a id="original-report-bug-010--the-api-runner-exits-0-when-the-server-never-starts-so-ci-called-it-green"></a>

### Pôvodné hlásenie: BUG-010 · API runner vráti 0, aj keď sa server nikdy nespustí, takže CI hlásilo úspech

[← Späť na README](../../../README.md#qa-evidence) · [Ďalej: API runner →](../../../../../qa/api/run.js)

![závažnosť](https://img.shields.io/badge/severity-Critical-critical?style=flat-square)
![stav](https://img.shields.io/badge/state-CLOSED-brightgreen?style=flat-square)

| | |
|---|---|
| **Závažnosť** | Kritická |
| **Priorita** | P0 — brána hlási úspech bez toho, aby čokoľvek skontrolovala |
| **Stav** | CLOSED 2026-09-05 |
| **Zistené pomocou** | čítanie logov CI behu, ktorý [BUG-009](BUG-009-segfault-on-node-20.md) zmenil na červený |
| **Komponent** | `qa/api/run.js` — `main` |
| **Dopad na** | brána CI celej vrstvy API |
| **Prostredie** | ubuntu-latest, Node 20; reprodukované lokálne na Windows, Node 24 |
| **Opravené v** | Opravené. Pôvodný commit nie je súčasťou tejto verejnej snímky. |
<a id="why-this-one-is-critical"></a>

## Prečo je tento prípad Critical

Každý iný záznam v registri opisuje niečo, čo sa pokazilo.
Tento opisuje niečo, čo **prešlo, hoci malo zlyhať** —
jediný režim zlyhania testovacej vrstvy, ktorý stojí viac
než úplná absencia testov: mení „nevieme“ na „skontrolovali sme“.

Stupnica závažnosti v `log/BUGS.md` je napísaná pre produkt —
strata údajov alebo nesprávne peniaze. Toto nie je ten prípad.
Critical je priradené podľa druhej osi registra, zámerne
a s vysvetlením tu namiesto skrytia v stĺpci:
API brána hlásila úspech v behu, v ktorom sa odoslalo **nula požiadaviek**.

<a id="what-ci-said"></a>

## Čo hlásilo CI

```
the server at http://localhost:3001 never became healthy (fetch failed)
✓ API checks (newman) in 55s
```

Zlyhanie je vypísané celé bezprostredne nad značkou úspechu.
Jediná ďalšia stopa prišla o krok neskôr:

```
##[warning]No files were found with the provided path: qa/reports/.
```

Nič sa nenahralo, pretože nič nevzniklo, pretože nič nebežalo.

<a id="steps-to-reproduce"></a>

## Kroky na reprodukciu

```bash
node -e "require('http').createServer((q,s)=>{s.writeHead(500);s.end()}).listen(3060)" &
QA_PORT=3060 node qa/api/run.js ; echo $?
```

Blokujúci proces drží port, preto testovaný server končí
na `EADDRINUSE`; odpovedá 500, takže kontrola zdravia
zlyháva až do uplynutia limitu.

<a id="root-cause"></a>

## Príčina

Návratový kód sa nastavoval **po** `await`, ktorý sa už
nemohol dokončiť.

```js
if (server && !server.killed) {          // the child is dead; killed is false
  await new Promise((resolve) => {
    server.once('exit', resolve);        // 'exit' already fired — never again
    server.kill();                       // returns false, emits nothing
  });
}
process.exitCode = code;                 // never reached
```

`server.killed` odpovedá na otázku *„bol odoslaný signál?“*,
nie *„skončil podproces?“*. Pri podprocese, ktorý skončil sám,
je hodnota `false`, takže sa vetva vykonala. Udalosť `exit`
už nastala, promise sa preto nikdy nesplnil. `main()`
sa nevrátil. Keďže nič ďalšie nedržalo slučku udalostí aktívnu,
Node skončil s kódom **0**.

**Museli sa stretnúť tri podmienky, preto chyba prežila:**

1. server musel skončiť *sám* — ukončovací signál by vyvolal udalosť;
2. zlyhanie muselo nastať vnútri `try`, takže `code` už bol `1`
   a cesta v kóde vyzerala ošetrená;
3. nič ďalšie nesmelo držať proces aktívny, takže skončil potichu
   namiesto zaseknutia — zaseknutie by si niekto všimol do minúty.

<a id="this-is-bug-008-again-inverted"></a>

## Toto je BUG-008 znovu, v opačnom smere

| | [BUG-008](BUG-008-api-runner-exit-127.md) | BUG-010 |
|---|---|---|
| Čo čistenie urobilo s výsledkom | zmenilo úspech na 127 | zmenilo zlyhanie na 0 |
| Smer nepravdivého výsledku | pesimistický — obťažujúci | optimistický — nebezpečný |
| Porušené pravidlo | R8 | R8 |

To isté pravidlo bolo porušené z oboch strán v tej istej funkcii
s odstupom troch relácií. R8 už hovorilo *zaznamenať výsledok
pred čistením*; oprava BUG-008 však nechala priradenie na konci
`main()`. **Pravidlo formulované, ale nevynútené štruktúrou
kódu sa poruší znova** — tu je dôkaz z tohto projektu.

<a id="fix"></a>

## Oprava

- `process.exitCode = code` sa presunulo **pred** všetko čistenie
  s komentárom, že nič nižšie nesmie zmeniť výsledok.
- Skončenie podprocesu sa sleduje od okamihu spustenia —
  `server.once('exit', () => { serverGone = true; })` —
  namiesto kontroly `server.killed`, ktorá odpovedá na inú otázku.
- Čakanie má 5-sekundový limit s `unref`, takže podproces ignorujúci
  SIGTERM zanechá zatúlaný proces namiesto zničenia celého behu.
  Návratový kód je dovtedy nastavený, takže vzdať čakanie je bezpečné.

<a id="regression"></a>

## Regresia

Presná podoba CI, reprodukovaná lokálne:

```
the server at http://localhost:3060 never became healthy (HTTP 500)
EXIT: 1
```

Bežná zelená cesta sa naďalej hlási správne:

```
requests   93  (0 failed)
assertions 340  (0 failed)
scripts    93  (0 failed to run)
exit 0
```

<a id="-rule-r8"></a>

## → Pravidlo R8

Znenie zostáva rovnaké. V implementácii sa porušilo dvakrát,
čo je užitočnejšie zistenie: zaznamenajte výsledok pred čistením
a „nič pod týmto riadkom nesmie zmeniť návratový kód“ považujte
za štruktúrne pravidlo, nie za úmysel.


</details>
