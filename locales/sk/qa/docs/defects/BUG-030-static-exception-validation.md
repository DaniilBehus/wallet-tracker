[English](../../../../../qa/docs/defects/BUG-030-static-exception-validation.md) · **Slovenčina**

<a id="bug-030--stale-or-redundant-static-gate-exceptions-passed-c9"></a>

# BUG-030 · Zastarané alebo nadbytočné výnimky statickej brány prechádzali C9

[← Späť na README](../../../README.md#qa-evidence) · [Register chýb](../../../log/BUGS.md) · [Ďalej: index správ →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Statická brána C9 prijímala zastarané, duplicitné alebo nadbytočné záznamy výnimiek namiesto ich odmietnutia.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Chyba |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Stredná |
| Priorita | Samostatne nezaznamenaná |
| Komponent | `scripts/coverage-gates.js`, `scripts/check-exceptions.json` |
| Nájdené / dotknutá zostava | negatívne kontroly 2026-10-10; presná zostava len tam, kde je zaznamenaná nižšie |
| Prostredie / frekvencia | Samostatne nezaznamenané; nevyvodzujte frekvenciu z neskorších zelených behov |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie dáta

2026-10-10, negatívne kontroly výnimiek v pamäti

<a id="reproduction"></a>

## Reprodukcia

1. Pridajte zdanlivo platnú výnimku pre trasu C6, testid C7 alebo stav C8, ktorá v aktuálnom inventári chýba; pridajte už vyriešený alebo duplicitný záznam; skúste neplatný tvar záznamu.

Tento krok opakuje datovaný historický postup; nejde o novo vykonaný test.

<a id="expected-and-requirement"></a>

## Očakávané správanie a požiadavka

C9 zlyhá s konkrétnou diagnostikou zastaraného, nadbytočného, duplicitného alebo neplatného záznamu; nedostupné povinné inventáre zlyhajú bez falošných tvrdení o zastaranosti.

<a id="actual-observation"></a>

## Skutočné pozorovanie

C9 kontrolovala iba dĺžku dôvodu. Úvodný beh kontrol mal 23 úspešných a 6 neúspešných; chybné dáta mohli vyhodiť výnimku mimo zamýšľaného verdiktu brány.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `scripts/coverage-gates.js`](../../../../../scripts/coverage-gates.js)
- [Zaznamenaný zdroj: `scripts/check-exceptions.json`](../../../../../scripts/check-exceptions.json)
- [Zaznamenaný zdroj: `qa/docs/test-report-static-gates.md`](../test-report-static-gates.md)
- [Úplný pôvodný register, zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — nájdite nadpis `BUG-030`.

<a id="resolution-and-verification"></a>

## Vyriešenie a overenie

Aktuálny stav registra: **CLOSED**. Datované zosúladenie zaznamenáva: [negatívne kontroly zastaraných/nadbytočných výnimiek](../test-report-static-gates.md); CI statických brán prešlo. Zostávajúca výnimka `500` je explicitná a nevykonaná, nie výnimka z runtime požiadaviek.

Pôvodné skúmanie nižšie môže používať skorší štítok `IN PROGRESS` alebo „local/uncommitted“. Je zachované ako historický dôkaz, nie ako konkurenčný aktuálny stav. Táto migrácia dokumentácie nespustila nový scenár.

<a id="technical-investigation-and-dated-history"></a>

## Technické skúmanie a datovaná história

<details>
<summary>Otvoriť pôvodnú podrobnú správu/pozorovanie</summary>

<a id="bug-030--stale-or-redundant-static-gate-exceptions-passed-c9--medium--in-progress"></a>

### BUG-030 · Zastarané alebo nadbytočné výnimky statickej brány prechádzali C9 · Medium · IN PROGRESS

| Nájdené v | 2026-10-10, negatívne kontroly výnimiek v pamäti |
| Komponent | `scripts/coverage-gates.js`, `scripts/check-exceptions.json` |

**Kroky reprodukcie:** pridajte zdanlivo platnú výnimku pre trasu C6, testid C7 alebo
stav C8, ktorá v aktuálnom inventári chýba; pridajte už vyriešený alebo duplicitný
záznam; skúste neplatný tvar záznamu.
**Očakávané:** C9 zlyhá s konkrétnou diagnostikou zastaraného, nadbytočného,
duplicitného alebo neplatného záznamu; nedostupné povinné inventáre zlyhajú bez
falošných tvrdení o zastaranosti.
**Skutočnosť pred opravou:** C9 kontrolovala iba dĺžku dôvodu. Úvodný beh kontrol
mal 23 úspešných a 6 neúspešných; chybné dáta mohli vyhodiť výnimku mimo
zamýšľaného verdiktu brány.
**Oprava:** lokálna a necommitnutá; C9 používa tie isté aktuálne inventáre ako C6–C8,
validuje tvar/dôvod/identitu a bráni chybným záznamom zhodiť ostatné brány.
**Regresia:** konečné nezávislé lokálne `test:gates` 31/31 a `check` 8/8;
pôvodné hashe vstupov sa kontrolami v pamäti nezmenili. Jedna aktuálna
výnimka `500` zostáva explicitnou nevykonanou statickou medzerou, nie runtime výnimkou.
**→ Žiadne pravidlo — jednorazový prípad.** [Podrobnosti](../test-report-static-gates.md).

</details>
