[English](../../../../../qa/docs/defects/BUG-006-load-runner-exit-127.md) · **Slovenčina**

<a id="bug-006--the-load-runner-returned-127-after-a-run-where-every-threshold-passed"></a>

# BUG-006 · Záťažový runner vrátil 127 po behu so splnenými všetkými hranicami

[← Späť na README](../../../README.md#qa-evidence) · [Register chýb](../../../log/BUGS.md) · [Ďalej: index správ →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Záťažový príkaz vrátil kód 127, hoci zaznamenané hranice prešli, takže úspešný záťažový výsledok nebol použiteľný ako verdikt CI.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Chyba |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Nízka |
| Priorita | P2 — bez dopadu na používateľa, ale príkaz sa nedá použiť ako brána |
| Komponent | `qa/load/run.js` |
| Nájdené / dotknutá zostava | S12; presná zostava len tam, kde je zaznamenaná nižšie |
| Prostredie / frekvencia | Node v24.13.1, Windows 11, k6 spustený ako podradený proces; frekvencia iba ak je uvedená nižšie |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie dáta

S12, pri pridávaní tretieho záťažového skriptu

<a id="reproduction"></a>

## Reprodukcia

1. Spustite `npm run test:load`. Každý proces k6 skončí s kódom 0, každá hranica prejde, súhrn sa vypíše — a runner skončí s kódom **127**.

Tento krok opakuje datovaný historický postup; nejde o novo vykonaný test.

<a id="expected-and-requirement"></a>

## Očakávané správanie a požiadavka

Návratový kód je výsledkom. Zelený beh musí hlásiť úspech,
inak sa príkaz nedá použiť ako brána.

<a id="actual-observation"></a>

## Skutočné pozorovanie

127, konzistentne. Skôr v tom istom skúmaní runner tiež
zlyhal *potichu* medzi skriptmi, takže druhé a tretie meranie
vôbec neprebehli a nevypísalo sa prečo.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `qa/load/run.js`](../../../../../qa/load/run.js)
- [Zaznamenaný zdroj: `qa/api/run.js`](../../../../../qa/api/run.js)
- [Úplný pôvodný register, zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — nájdite nadpis `BUG-006`.
- [GitHub Issue #6](https://github.com/DaniilBehus/wallet-tracker/issues/6) — externé metadáta sa môžu líšiť; dokumentačnou autoritou stavu je lokálny register.

<a id="resolution-and-verification"></a>

## Vyriešenie a overenie

**CLOSED.** Záťažový runner po meraní už násilne neukončuje svoje podradené servery; staré záťažové databázy sa odstraňujú na začiatku ďalšieho behu a k6 sa spúšťa priamo. V zaznamenanej regresii runner skončil s kódom **0**, prebehli všetky tri skripty s vytvorenými súhrnmi a porty 3100–3102 boli potom voľné. Presný mechanizmus skoršieho kódu 127 nebol zistený, preto si ho správa nevymýšľa.

<a id="technical-investigation-and-dated-history"></a>

## Technické skúmanie a datovaná história

<details>
<summary>Otvoriť pôvodnú podrobnú správu/pozorovanie</summary>

<a id="original-report-bug-006--the-load-runner-returned-127-after-a-run-where-every-threshold-passed"></a>

### Pôvodná správa: BUG-006 · Záťažový runner vrátil 127 po behu so splnenými všetkými hranicami

[← Späť na README](../../../README.md#qa-evidence) · [Ďalej: záťažový runner →](../../../../../qa/load/run.js)

![severity](https://img.shields.io/badge/severity-Low-lightgrey?style=flat-square)
![state](https://img.shields.io/badge/state-CLOSED-brightgreen?style=flat-square)

| | |
|---|---|
| **Závažnosť** | Low |
| **Priorita** | P2 — bez dopadu na používateľa, ale príkaz sa nedá použiť ako brána |
| **Stav** | CLOSED 2026-09-03 |
| **Našiel** | samotná záťažová vrstva, S12, pri pridávaní tretieho skriptu |
| **Komponent** | `qa/load/run.js` |
| **Dotýka sa** | `npm run test:load` a každého kroku CI závislého od jeho návratového kódu |
| **Prostredie** | Node v24.13.1, Windows 11, k6 spustený ako podradený proces |
| **Opravené v** | Opravené. Pôvodný commit nie je súčasťou tohto verejného snapshotu. |
<a id="summary"></a>

## Súhrn

Každý proces k6 skončí s kódom 0, každá hranica prejde, súhrn sa vypíše —
a runner skončí s kódom **127**.

Zelený beh hlásiaci zlyhanie je horší než červený beh hlásiaci zlyhanie:
automatický volajúci číta iba návratový kód a ten tu nesúhlasil so všetkým,
čo sa práve nameralo.

<a id="steps-to-reproduce"></a>

## Kroky reprodukcie

1. `npm run test:load`
2. Prečítajte návratový kód: `echo $?` (PowerShell: `$LASTEXITCODE`).

<a id="expected"></a>

## Očakávané

Návratový kód je výsledkom. Zelený beh musí hlásiť úspech,
inak príkaz nemôže byť bránou.

<a id="actual"></a>

## Skutočnosť

127, konzistentne. Skôr v tom istom skúmaní runner tiež zlyhal
*potichu* medzi skriptmi, takže druhé a tretie meranie neprebehli
a nevypísalo sa prečo.

<a id="root-cause--two-in-the-same-few-lines"></a>

## Príčina — dve v niekoľkých riadkoch

**1. Handler chyby napísaný pre jednu situáciu sa spustil v inej.**

`startServer` pripojil `server.on('error', …)`, ktorý volal `process.exit(1)`.
Handler bol určený pre situáciu „server sa nespustil“, ale spustí sa
aj pri úmyselnom ukončení podradeného procesu. Čistenie po prvom skripte
tak ukončilo celý beh; správa sa stratila vo výstupe k6 a vyzeralo to,
akoby sa beh len zastavil.

**2. Samotné ukončenie procesu.**

Po oprave prvej časti zostal návratový kód nesprávny. Príčina sa hľadala
odstraňovaním jednej veci za druhou:

<details>
<summary>Čo sa skúšalo, v poradí</summary>

| Pokus | Návratový kód |
|---|---|
| Obaliť `child.kill()` neškodným listenerom `error` | stále 127 |
| Obaliť `child.kill()` cez `try`/`catch` | stále 127 |
| Presunúť ukončenie do handlera `process.on('exit')` | stále 127 |
| **Úplne odstrániť ukončenie** | **0**, okamžite a opakovateľne |

</details>

Samotné volanie `child.kill()` stačilo na tomto počítači na poškodenie
návratového stavu runnera.

**Mechanizmus druhej časti nebol identifikovaný.** Povedať to je užitočnejšie
než odhad s číslom — vierohodná hypotéza v správe o chybe by neskôr
vyzerala rovnako ako overená príčina.

<a id="fix"></a>

## Oprava

Runner už nič násilne neukončuje. Servery sú jeho podradené procesy
a končia spolu s ním — potvrdilo sa to kontrolou portov 3100–3102,
ktoré zostali voľné.

Zostáva iba údržba v podobe odstránenia starých súborov
`data/load-*.db`; presunula sa na **začiatok** behu, kde nemôže
ovplyvniť výsledok, ktorý ešte nenastal. Čistenie po meraní
môže meranie poškodiť.

k6 sa tiež spúšťa priamo namiesto `shell: true`, čím sa odstráni
upozornenie Node o nezabezpečených argumentoch.

<a id="regression"></a>

## Regresia

```
runner -> 0
scripts run: 3
summaries: qa/reports/load-*.json
ports 3100, 3101, 3102 free afterwards
```

<a id="-rule-r8"></a>

## → Pravidlo R8

Proces, ktorý hlási výsledok, nesmie zároveň čistiť spôsobom,
ktorý môže zmeniť jeho návratový kód. Čistenie vykonajte na začiatku
nasledujúceho behu.

</details>
