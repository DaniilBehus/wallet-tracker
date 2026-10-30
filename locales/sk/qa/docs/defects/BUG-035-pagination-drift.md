[English](../../../../../qa/docs/defects/BUG-035-pagination-drift.md) · **Slovenčina**

<a id="bug-035--offset-paging-can-duplicate-or-skip-expenses-after-another-clients-write"></a>

# BUG-035 · Offset stránkovanie mohlo po zápise iného klienta výdavky zdvojiť alebo preskočiť

[← Späť na README](../../../README.md#qa-evidence) · [Register chýb](../../../log/BUGS.md) · [Ďalej: index správ →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Offset stránkovanie mohlo zopakovať alebo preskočiť výdavky, keď iný klient medzi požiadavkami na stránky vložil alebo vymazal riadok.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Chyba |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Stredná |
| Priorita | Samostatne nezaznamenaná |
| Komponent | Pozri pôvodné pozorovanie |
| Nájdené / dotknutá zostava | HTTP/prehliadačové kontroly 2026-10-16; presná zostava len tam, kde je zaznamenaná nižšie |
| Prostredie / frekvencia | Samostatne nezaznamenané; nevyvodzujte frekvenciu z neskorších zelených behov |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie dáta

2026-10-16 jednorazové HTTP a prehliadačové kontroly v dvoch viewportoch.

<a id="reproduction"></a>

## Reprodukcia

1. Načítajte prvú stránku výdavkov; druhým klientom vložte novší riadok a na ďalšiu stránku použite `offset=2`. V samostatnom behu pred pokračovaním so starým offsetom vymažte už videný riadok.

Tento krok opakuje datovaný historický postup; nejde o novo vykonaný test.

<a id="expected-and-requirement"></a>

## Očakávané správanie a požiadavka

Každý zachovaný ešte nevidený výdavok sa objaví raz; zmenený živý
celkový počet nevytvorí nemožné počítadlo Month.

<a id="actual-observation"></a>

## Skutočné pozorovanie

Vloženie cez HTTP zopakovalo už videné hraničné ID;
vymazanie cez HTTP preskočilo nevidené zachované ID. V prehliadači vloženie
zobrazilo 52 z 52 namiesto reštartu, kým vymazanie ukázalo vymazaný riadok
namiesto zostávajúceho nevideného. Svedkovia na telefóne aj desktope zlyhali
podľa očakávania.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `qa/docs/analysis-pagination-consistency.md`](../analysis-pagination-consistency.md)
- [Zaznamenaný zdroj: `qa/docs/test-report-pagination-consistency.md`](../test-report-pagination-consistency.md)
- [Úplný pôvodný register, zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — nájdite nadpis `BUG-035`.

<a id="resolution-and-verification"></a>

## Vyriešenie a overenie

Aktuálny stav registra: **CLOSED**. Datované zosúladenie zaznamenáva: [svedkov driftu pri vložení/vymazaní a regresie kurzora](../test-report-pagination-consistency.md); kontraktové a Playwright CI prešli. Pokračovanie kurzorom nie je nemenný snapshot.

Pôvodné skúmanie nižšie môže používať skorší štítok `IN PROGRESS` alebo „local/uncommitted“. Je zachované ako historický dôkaz, nie ako konkurenčný aktuálny stav. Táto migrácia dokumentácie nespustila nový scenár.

<a id="technical-investigation-and-dated-history"></a>

## Technické skúmanie a datovaná história

<details>
<summary>Otvoriť pôvodnú podrobnú správu/pozorovanie</summary>

<a id="bug-035--offset-paging-can-duplicate-or-skip-expenses-after-another-clients-write--medium--in-progress"></a>

### BUG-035 · Offset stránkovanie mohlo po zápise iného klienta výdavky zdvojiť alebo preskočiť · Medium · IN PROGRESS

**Nájdené v:** 2026-10-16 jednorazové HTTP a prehliadačové kontroly v dvoch viewportoch.
**Kroky:** načítajte prvú stránku výdavkov; druhým klientom vložte novší riadok,
potom na ďalšiu stránku použite `offset=2`. V samostatnom behu pred pokračovaním
so starým offsetom vymažte už videný riadok.
**Očakávané:** každý zachovaný ešte nevidený výdavok sa objaví raz; zmenený živý
celkový počet nevytvorí nemožné počítadlo Month.
**Skutočnosť pred opravou:** vloženie cez HTTP zopakovalo už videné hraničné ID;
vymazanie cez HTTP preskočilo nevidené zachované ID. V prehliadači vloženie
zobrazilo 52 z 52 namiesto reštartu, kým vymazanie ukázalo vymazaný riadok
namiesto zostávajúceho nevideného. Svedkovia na telefóne aj desktope zlyhali
podľa očakávania.
**Príčina:** číselný offset sleduje posunutý aktuálny zoznam, nie poslednú
videnú pozíciu `(spent_on, id)`.
**Lokálna oprava:** voliteľný režim kurzora používa parametrizovaný keyset
predikát s tokenmi viazanými na účet/filter a prísnou kontrolou.
Starší volajúci offsetu si zachovávajú prijatú odpoveď a správanie.
Month pokračuje kurzorom a pri zmene živého celkového počtu urobí jeden
reštart prvej stránky; nepoužíva polling.
**Regresia:** cielené syntetické HTTP kontroly 2/2, celý lokálny kontrakt
17/17, spravovaný prehliadačový test stránkovania 8/8, úpravy 18/18 a cielené
kontroly editora/a11y 4/4 po samostatnom opakovaní testovacieho rámca
kvôli kolízii portu. Nie je to nemenný snapshot: úpravy presúvajúce
pozíciu v triedení, externé mutácie s rovnakým celkovým počtom a cacheované
riadky zostávajú limitmi. Nezávislá agentova revízia kódu/dôkazov prijala
túto ohraničenú lokálnu opravu 2026-10-16; BUG-035 zostáva **IN PROGRESS**
pre overenie kombinovaného stromu a publikovanie, nie pre ďalšie známe
zlyhanie vloženia/vymazania. Nevyvodzuje sa ľudský audit, UAT vlastníka,
vzdialené CI ani vydanie. [Analýza](../analysis-pagination-consistency.md) ·
[správa o behu](../test-report-pagination-consistency.md).

</details>
