[English](../../../../../qa/docs/defects/BUG-009-segfault-on-node-20.md) · **Slovenčina**

<a id="bug-009--the-server-segfaults-on-node-20-in-ci-so-the-first-build-was-red"></a>

# BUG-009 · Server v CI na Node 20 zlyhá so segmentation fault, takže prvé zostavenie bolo červené

[← Späť na README](../../../README.md#qa-evidence) · [Register defektov](../../../log/BUGS.md) · [Ďalej: index hlásení →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Prvý pokus CI na Node 20 zlyhal v natívnej databázovej vrstve; historické zlyhanie je prípad kompatibility runtime, nie úspešne absolvovaný test aplikácie.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Defekt |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Vysoká |
| Priorita | P0 — v pipeline sa nedá spustiť nič |
| Komponent | `.github/workflows/ci.yml` — `NODE_VERSION` a `package.json` `engines` |
| Zistené / dotknutá verzia | S15; presná verzia len tam, kde je uvedená nižšie |
| Prostredie / frekvencia | ubuntu-latest, Node 20, better-sqlite3 13.0.3; frekvencia len tam, kde je uvedená nižšie |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie údaje

S15, prvý beh CI po prvom pushi

<a id="reproduction"></a>

## Reprodukcia

1. spustite workflow na `ubuntu-latest` s `node-version: 20`.

Tento krok pripomína historický postup; nejde o novospustený test.

<a id="expected-and-requirement"></a>

## Očakávanie a požiadavka

Rovnaká zelená sada ako lokálne — 340 tvrdení, 92 e2e testov.
Spec §2 uvádza Node 20+ a `package.json` uvádzal `engines: >=20`.

<a id="actual-observation"></a>

## Skutočné pozorovanie

Webový server v CI zaznamenal `Segmentation fault (core dumped)`
a Playwright hlásil **exit 139** (`SIGSEGV`) webového servera.
Server úlohy API tiež neprešiel kontrolou zdravia.
Datovaný výstup CI je uvedený vo vyšetrovaní nižšie.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný workflow CI](../../../../../.github/workflows/ci.yml) a [obmedzenie runtime v balíku](../../../../../package.json).
- [Úplný pôvodný register zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — vyhľadajte nadpis `BUG-009`.
- [GitHub Issue #9](https://github.com/DaniilBehus/wallet-tracker/issues/9) — externé metadáta sa môžu líšiť; stav dokumentácie určuje lokálny register.

<a id="resolution-and-verification"></a>

## Oprava a overenie

**CLOSED pre historický nesúlad minimálnej verzie Node 20.** Datovaná oprava presunula CI aj deklaráciu engines z Node 20 na minimálne Node 22 požadované `better-sqlite3@13.0.3`; workflow slúžil ako regresná kontrola po prvom neúspešnom behu. Staré hlásenie v úvodnej časti neuvádza priamy identifikátor behu. Neskoršia [správa o kompatibilite runtime](../test-report-runtime.md) dokumentuje prísnejšiu súčasnú ochranu `22.14.0`/Node-API-10. Presný mechanizmus natívneho pádu okrem nepodporovaného runtime sa neizoloval.

<a id="technical-investigation-and-dated-history"></a>

## Technické vyšetrovanie a datovaná história

<details>
<summary>Otvoriť pôvodné podrobné hlásenie/pozorovanie</summary>

<a id="original-report-bug-009--the-server-segfaults-on-node-20-in-ci-so-the-first-build-was-red"></a>

### Pôvodné hlásenie: BUG-009 · Server v CI na Node 20 zlyhá so segmentation fault, takže prvé zostavenie bolo červené

[← Späť na README](../../../README.md#qa-evidence) · [Ďalej: konfigurácia CI →](../../../../../.github/workflows/ci.yml)

![závažnosť](https://img.shields.io/badge/severity-High-orange?style=flat-square)
![stav](https://img.shields.io/badge/state-CLOSED-brightgreen?style=flat-square)

| | |
|---|---|
| **Závažnosť** | Vysoká |
| **Priorita** | P0 — v pipeline sa nedá spustiť nič |
| **Stav** | CLOSED 2026-09-05 |
| **Zistené pomocou** | prvý beh CI po prvom pushi |
| **Komponent** | `.github/workflows/ci.yml` — `NODE_VERSION`; `package.json` — `engines` |
| **Dopad na** | obe úlohy spúšťajúce server: **api** a **e2e** |
| **Prostredie** | ubuntu-latest, Node 20, better-sqlite3 13.0.3 |
| **Opravené v** | Opravené. Pôvodný commit nie je súčasťou tejto verejnej snímky. |
<a id="summary"></a>

## Zhrnutie

Aplikácia prechádza na vývojovom počítači — 340 tvrdení API,
92 end-to-end testov — ale jej server pri štarte v CI končí
segmentation fault.

<a id="what-ci-said"></a>

## Čo hlásilo CI

Úloha e2e, v ktorej Playwright spúšťa server v popredí:

```
[WebServer] Segmentation fault (core dumped)
Error: Process from config.webServer was not able to start. Exit code: 139
```

139 je 128 + 11: **SIGSEGV**.

Úloha api narazila na rovnaký problém o úlohu skôr, no hlásila ho
tichšie, lebo jej server bežal na pozadí:

```
the server at http://localhost:3001 never became healthy (fetch failed)
```

<a id="root-cause"></a>

## Príčina

`better-sqlite3@13.0.3` deklaruje:

```json
"engines": { "node": ">=22" }
```

CI bolo pripnuté na Node **20**. npm považuje `engines` len za odporúčanie,
pokiaľ nie je zapnuté `engine-strict`, takže `npm ci` prešlo
a natívna binárka sa načítala do runtime, pre ktorý nebola vytvorená.
Nevyhodila výnimku — natívny kód nedokáže zdvorilo odmietnuť nesúlad ABI —
skončila so SIGSEGV.

Rovnaké nesprávne tvrdenie obsahovali dva vlastné súbory:

| | Uvádzalo | Skutočnosť |
|---|---|---|
| `package.json` `engines` | `>=20` | `>=22`, vyžaduje better-sqlite3 |
| `.github/workflows/ci.yml` | `NODE_VERSION: '20'` | runtime podporovaný závislosťou |

Nikto zámerne neklamal. Minimálna verzia bola určená, keď bol zoznam
závislostí krátky, a závislosť potom nenápadne zvýšila vlastnú
minimálnu verziu pri aktualizácii, ktorú nikto neprečítal znova.
**Deklarovaná minimálna verzia je tvrdenie; bez kontroly zastaráva.**

<a id="why-it-could-not-be-seen-locally"></a>

## Prečo to nebolo vidno lokálne

Vývojový počítač používa Node v24.13.1, ktorý spĺňa `>=22`.
Node 20 používalo iba CI a CI ešte nikdy nebežalo — bol to prvý push.
Defekt teda existoval odo dňa aktualizácie `better-sqlite3` na 13
a nebolo ho možné zistiť skôr než pri tomto behu.

**Samostatne treba uviesť:** Podpora Node 20 skončila v apríli 2026.
CI bolo pripnuté na nepodporovaný runtime, čo je problém samo osebe;
segfault ho iba zviditeľnil.

<a id="fix"></a>

## Oprava

```yaml
NODE_VERSION: '22'
```

```json
"engines": { "node": ">=22" }
```

Zaznamenané ako **D-028**, ktoré uvádza aj konflikt
so spec §2 „Node.js 20+“. Špecifikácia sa nemení —
odchýlka je datované rozhodnutie podľa rovnakého postupu ako D-004.

**Prečo 22 a nie 24 používané pri vývoji.** 22 je minimálna verzia,
ktorú projekt teraz deklaruje, a práve tá sa najpravdepodobnejšie
pokazí. Hornú časť rozsahu už pokrýva vývojový počítač.
CI testujúce iba najnovší runtime nedokáže ukázať, či je
deklarované minimum skutočnosťou alebo len nádejou.

<a id="regression"></a>

## Regresia

Samotný workflow; jeho predchádzajúci beh je neúspešný prípad
uchovaný v histórii behov, nie opísaný z pamäti.

<a id="-rule-r11"></a>

## → Pravidlo R11

Minimálna podporovaná verzia je tvrdenie a každá závislosť ho môže
zneplatniť bez upozornenia. Skontrolujte skutočné požiadavky závislostí
a spúšťajte CI na minimálnej verzii, nie na verzii, ktorú práve
používate pri vývoji.


</details>
