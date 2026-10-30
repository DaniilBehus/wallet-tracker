[English](../../../../../qa/docs/defects/BUG-028-evaluator-setup-race.md) · **Slovenčina**

<a id="bug-028--concurrent-evaluator-setup-can-abort-before-quota-exercise"></a>

# BUG-028 · Súbežné nastavenie evaluátora sa mohlo prerušiť pred kontrolou kvóty

[← Späť na README](../../../README.md#qa-evidence) · [Register chýb](../../../log/BUGS.md) · [Ďalej: index správ →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Podradené procesy offline evaluátora súťažili pri vytváraní jedného syntetického používateľa a mohli sa prerušiť ešte pred spustením logiky kvót.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Chyba |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Vysoká |
| Priorita | Samostatne nezaznamenaná |
| Komponent | factory syntetického používateľa v `qa/ai/evaluate.js` |
| Nájdené / dotknutá zostava | riadený súbeh nastavenia 2026-10-10; presná zostava len tam, kde je zaznamenaná nižšie |
| Prostredie / frekvencia | Samostatne nezaznamenané; nevyvodzujte frekvenciu z neskorších zelených behov |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie dáta

2026-10-10, synchronizovaná kontrola kópie evaluátora

<a id="reproduction"></a>

## Reprodukcia

1. Spustite tri chránené podradené procesy evaluátora nad jednou jednorazovou databázou, synchronizované pred prvým načítaním alebo vytvorením rovnakého syntetického e-mailu.

Tento krok opakuje datovaný historický postup; nejde o novo vykonaný test.

<a id="expected-and-requirement"></a>

## Očakávané správanie a požiadavka

Jeden úplne inicializovaný používateľ a množina kategórií; všetky podradené procesy dosiahnu prácu providera/kvóty bez chyby nastavenia.

<a id="actual-observation"></a>

## Skutočné pozorovanie

Dva podradené procesy hlásili `UNIQUE constraint failed: users.email` pred odoslaním providerovi. Samostatne vložené zlyhanie po založení ponechalo jedného používateľa a desať kategórií.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `qa/ai/evaluate.js`](../../../../../qa/ai/evaluate.js)
- [Zaznamenaný zdroj: `qa/docs/test-report-evaluator-concurrency.md`](../test-report-evaluator-concurrency.md)
- [Úplný pôvodný register, zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — nájdite nadpis `BUG-028`.

<a id="resolution-and-verification"></a>

## Vyriešenie a overenie

Aktuálny stav registra: **CLOSED**. Datované zosúladenie zaznamenáva: [synchronizovanú kontrolu nastavenia evaluátora](../test-report-evaluator-concurrency.md); offline AI CI prešlo. To nedokazuje príčinu samostatného historického W9.

Pôvodné skúmanie nižšie môže používať skorší štítok `IN PROGRESS` alebo „local/uncommitted“. Je zachované ako historický dôkaz, nie ako konkurenčný aktuálny stav. Táto migrácia dokumentácie nespustila nový scenár.

<a id="technical-investigation-and-dated-history"></a>

## Technické skúmanie a datovaná história

<details>
<summary>Otvoriť pôvodnú podrobnú správu/pozorovanie</summary>

<a id="bug-028--concurrent-evaluator-setup-can-abort-before-quota-exercise--high--in-progress"></a>

### BUG-028 · Súbežné nastavenie evaluátora sa mohlo prerušiť pred kontrolou kvóty · High · IN PROGRESS

| Nájdené v | 2026-10-10, synchronizovaná kontrola kópie evaluátora |
| Komponent | factory syntetického používateľa v `qa/ai/evaluate.js` |

**Kroky reprodukcie:** spustite tri chránené podradené procesy evaluátora nad jednou
jednorazovou databázou, synchronizované pred prvým načítaním alebo vytvorením
rovnakého syntetického e-mailu.
**Očakávané:** jeden úplne inicializovaný používateľ a množina kategórií;
všetky podradené procesy dosiahnu prácu providera/kvóty bez chyby nastavenia.
**Skutočnosť pred opravou:** dva podradené procesy hlásili `UNIQUE constraint failed: users.email`
pred odoslaním providerovi. Samostatne vložené zlyhanie po založení ponechalo
jedného používateľa a desať kategórií.
**Príčina:** vyhľadanie, vloženie a inicializácia kategórií neboli v jednej
transakcii medzi procesmi.
**Oprava:** lokálna a necommitnutá; synchronizovaná immediate transakcia pokrýva
vyhľadanie až po načítanie kategórií a cache prijíma iba commitnutú identitu.
Práca providera zostáva mimo nej.
**Regresia:** prešli štyri nové kontroly súbežnosti/správ; dotknuté testy 25/25
a celé offline AI 240 prešli, jeden Windows privilege skip. Asercie posuvnej
kvóty W9 sú nezmenené a prerušený podradený proces má teraz samostatnú diagnostiku.
Dokazuje to mechanizmus súbehu, nie príčinu skoršieho zlyhania W9 celej sady.
**→ Žiadne pravidlo — jednorazový prípad.** [Podrobnosti](../test-report-evaluator-concurrency.md).

</details>
