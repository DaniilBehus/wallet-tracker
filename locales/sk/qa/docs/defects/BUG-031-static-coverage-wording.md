[English](../../../../../qa/docs/defects/BUG-031-static-coverage-wording.md) · **Slovenčina**

<a id="bug-031--static-inventory-gate-wording-overstated-runtime-coverage"></a>

# BUG-031 · Znenie brány statického inventára nadhodnocovalo runtime pokrytie

[← Späť na README](../../../README.md#qa-evidence) · [Register chýb](../../../log/BUGS.md) · [Ďalej: index správ →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Správy statických brán naznačovali vykonané pokrytie trás/stavov/selektorov, ktoré inventár textu zdroja nedokáže preukázať.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Chyba |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Stredná |
| Priorita | Samostatne nezaznamenaná |
| Komponent | `scripts/check.js`, `scripts/coverage-gates.js`, dokumentácia QA |
| Nájdené / dotknutá zostava | revízia dôkazov 2026-10-10; presná zostava len tam, kde je zaznamenaná nižšie |
| Prostredie / frekvencia | Samostatne nezaznamenané; nevyvodzujte frekvenciu z neskorších zelených behov |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie dáta

2026-10-10, porovnanie znenia brán s maticou skutočných odpovedí

<a id="reproduction"></a>

## Reprodukcia

Úplný očíslovaný postup reprodukcie nebol v historickom pozorovaní zaznamenaný. Pozri datované dôkazy nižšie; nevydávajte spätne zostavený postup za vykonaný test.

<a id="expected-and-requirement"></a>

## Očakávané správanie a požiadavka

C6–C8 sa musia opisovať ako statické deklarácie; vykonané správanie vyžaduje samostatné dôkazy skutočných odpovedí a prehliadača.

<a id="actual-observation"></a>

## Skutočné pozorovanie

C6–C8 porovnávali text zdroja/testov a hlásili názvy, ktoré sa mohli zameniť za vykonané požiadavky alebo fungujúce selektory; C8 porovnával literály stavov globálne, nie podľa operácie.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `scripts/check.js`](../../../../../scripts/check.js)
- [Zaznamenaný zdroj: `scripts/coverage-gates.js`](../../../../../scripts/coverage-gates.js)
- [Zaznamenaný zdroj: `qa/docs/test-report-static-gates.md`](../test-report-static-gates.md)
- [Úplný pôvodný register, zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — nájdite nadpis `BUG-031`.

<a id="resolution-and-verification"></a>

## Vyriešenie a overenie

Aktuálny stav registra: **CLOSED**. Datované zosúladenie zaznamenáva: [hranica medzi statickým znením a skutočnými odpoveďami](../test-report-static-gates.md); aktuálne gate/contract CI prešlo. Z C6–C8 sa nevyvodzuje vykonanie jednotlivých vetiev.

Pôvodné skúmanie nižšie môže používať skorší štítok `IN PROGRESS` alebo „local/uncommitted“. Je zachované ako historický dôkaz, nie ako konkurenčný aktuálny stav. Táto migrácia dokumentácie nespustila nový scenár.

<a id="technical-investigation-and-dated-history"></a>

## Technické skúmanie a datovaná história

<details>
<summary>Otvoriť pôvodnú podrobnú správu/pozorovanie</summary>

<a id="bug-031--static-inventory-gate-wording-overstated-runtime-coverage--medium--in-progress"></a>

### BUG-031 · Znenie brány statického inventára nadhodnocovalo runtime pokrytie · Medium · IN PROGRESS

| Nájdené v | 2026-10-10, porovnanie znenia brán s maticou skutočných odpovedí |
| Komponent | `scripts/check.js`, `scripts/coverage-gates.js`, dokumentácia QA |

**Problém:** C6–C8 skenujú text zdroja a testov. Ich bývalé názvy a správy sa
mohli chápať ako dôkaz, že sa požiadavka vykonala, selektor fungoval na
vykreslenej stránke alebo sa vyvolala každá vetva operácie/stavu. C8 najmä
porovnáva stavové asercie globálne.
**Očakávané:** kontroly statických deklarácií a dôkazy skutočného vykonania
sú pomenované oddelene.
**Oprava:** lokálna a necommitnutá; názvy brán, diagnostika a aktuálna
dokumentácia teraz hovoria STATIC. Pozorovaná kontraktová matica operácií/stavov
si zachováva bunky NOT EXERCISED; z týchto brán sa nevyvodzuje behaviorálne
pokrytie.
**Overenie:** nezávislá lokálna kontrola `check` 8/8 plus kontraktové testy
15/15 s 340 validovanými skutočnými HTTP odpoveďami. To neznamená,
že všetky bunky matice boli vykonané.
**→ Žiadne pravidlo — jednorazový prípad.** [Podrobnosti](../test-report-static-gates.md).

</details>
