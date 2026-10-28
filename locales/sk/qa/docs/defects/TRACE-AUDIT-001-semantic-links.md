[English](../../../../../qa/docs/defects/TRACE-AUDIT-001-semantic-links.md) · **Slovenčina**

<a id="trace-audit-001--public-semantic-traceability-drift"></a>

# TRACE-AUDIT-001 · Sémantický nesúlad vo verejnej sledovateľnosti

[← Späť na README](../../../README.md#qa-evidence) · [Register defektov](../../../log/BUGS.md) · [Ďalej: index hlásení →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Verejný katalóg prípadov a odkazy na riziká AI odkazovali na existujúce ID, ktorých význam už nezodpovedal. Ide o zistenie v sledovateľnosti, nie o novo pozorovaný defekt pri behu aplikácie.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Zistenie auditu sledovateľnosti |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Neuplatňuje sa |
| Priorita | Nezaznamenaná samostatne |
| Komponent | Verejné architektonické odkazy, katalóg prípadov, kotvy pravidiel funkcií a tabuľka rizík AI |
| Zistené / dotknutá verzia | Kontrola F13 z 2026-10-12; presná verzia len tam, kde je uvedená nižšie |
| Prostredie / frekvencia | Nezaznamenané samostatne; nevyvodzujte frekvenciu z neskorších zelených behov |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie údaje

2026-10-12, inventúra F13 len na čítanie a ohraničená lokálna oprava

<a id="observation-or-measurement-procedure"></a>

## Postup pozorovania alebo merania

Úplný očíslovaný postup reprodukcie sa v historickom pozorovaní nezaznamenal. Pozrite datované dôkazy nižšie; zrekonštruovaný postup nepovažujte za vykonaný test.

<a id="expected-and-requirement"></a>

## Očakávanie a požiadavka

Odkazy z testovacieho prípadu alebo rizika na ID požiadavky majú zodpovedať významu danej požiadavky, nie iba existujúcej kotve.

<a id="actual-observation"></a>

## Skutočné pozorovanie

Katalóg obsahoval vyradené čísla architektonických ustanovení a niektoré odkazy na riziká AI smerovali na existujúce ID s iným významom; samotná kontrola existencie tieto odkazy prepustila.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `qa/docs/test-report-traceability.md`](../test-report-traceability.md)
- [Zaznamenaný zdroj: `scripts/check.js`](../../../../../scripts/check.js)
- [Úplný pôvodný register zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — vyhľadajte nadpis `TRACE-AUDIT-001`.

<a id="resolution-and-verification"></a>

## Oprava a overenie

Aktuálny stav registra: **CLOSED**. Datované zosúladenie zaznamenáva [opravu sémantických odkazov F13 a negatívne kontroly](../test-report-traceability.md), ohraničené nezávislé prijatie a aktuálnu úlohu CI `f13-traceability`. Kontrolný nástroj nedokáže preukázať význam všetkých prípadov; analýza syntetického importu zostáva predbežná.

Pôvodné vyšetrovanie nižšie môže používať skorší štítok `IN PROGRESS` alebo „lokálne/necommitované“. Zostáva zachované ako historický dôkaz, nie ako konkurenčný aktuálny stav. Táto migrácia dokumentácie nespustila nový scenár.

<a id="technical-investigation-and-dated-history"></a>

## Technické vyšetrovanie a datovaná história

<details>
<summary>Otvoriť pôvodné podrobné hlásenie/pozorovanie</summary>

<a id="trace-audit-001--public-semantic-traceability-drift--in-progress"></a>

### TRACE-AUDIT-001 · Sémantický nesúlad vo verejnej sledovateľnosti · IN PROGRESS

| Zistené pri | 2026-10-12, inventúra F13 len na čítanie a ohraničená lokálna oprava |
| Komponent | Verejné architektonické odkazy, katalóg prípadov, kotvy pravidiel funkcií a tabuľka rizík AI |

**Pozorovanie:** katalóg s 280 riadkami používal vyradené čísla
architektonických ustanovení a niektoré odkazy na riziká AI
smerovali na skutočné ID s odlišným významom. Samotná existencia
ID nedokazovala sémantickú sledovateľnosť. Analýza syntetického
importu zostáva výslovne predbežná.

**Lokálna oprava:** migračný index verejných základných pravidiel,
stabilné kotvy v existujúcich zdrojoch pravidiel funkcií,
opravené odkazy katalógu a plánu AI a samostatný statický
kontrolný nástroj pre identitu a odkazy, založený iba na vstavaných
funkciách a s negatívnymi kontrolami. Dve autorizované
architektonické úpravy a súvisiace SHA sú preskúmané
v [správe F13](../test-report-traceability.md).
Žiadny historický výsledok prípadu sa nespustil ani nezmenil.

**Overenie:** lokálny Node 22.14.0: 17/17 nových statických
kontrol, 280 ID prípadov / 78 definícií pravidiel v samostatnom
kontrolnom nástroji a existujúci `scripts/check.js` 8/8.
Statická identita nedokazuje význam prípadu, vykonané pokrytie,
prijatie vlastníkom ani nový výsledok CI. Nezávislá kontrola main/
Critic a publikovanie zostávajú otvorené. **Neoznačovať ako FIXED**
na základe tohto lokálneho výsledku.

**Dodatok nezávislej kontroly ORD-087, 2026-10-12 — IN PROGRESS:**
kontrola ORD-086 odmietla lokálne prijatie F13 pre štyri
sémanticky nesprávne odkazy na mesačný limit (TC-API-096–099)
a parser definícií zdroja, ktorý prijal navyše ukotvené CORE-999.
Štyri odkazy teraz smerujú na REQ-ML-05.
Kontrola CORE-999 v pamäti zlyhala pred opravou parsera
(17 úspechov / 1 zlyhanie); pridali sa ohraničené kontroly
rodiny zdrojov, LF/CRLF a nesprávnej rodiny bez povýšenia
opakovaných odkazov na definície. Najnovšie cielené
výsledky a hashe artefaktov sú v
[správe F13](../test-report-traceability.md).
Tento dodatok nemení historické stavy, nedokazuje správanie
pri behu ani neuzatvára audit; nezávislá následná kontrola
a publikovanie zostávajú otvorené.

<!-- F20-F21 status addendum begin -->

</details>
