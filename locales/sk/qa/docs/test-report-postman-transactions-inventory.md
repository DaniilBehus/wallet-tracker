[English](../../../../qa/docs/test-report-postman-transactions-inventory.md) · **Slovenčina**

<a id="transactions-postman-inventory--bounded-f19-family"></a>

# Inventár transakcií v Postmane — ohraničená skupina F19

[← Späť na README](../../README.md#qa-evidence) · [Aktuálny inventár transakcií](../../../../qa/docs/postman-transactions-inventory.json) · [Predchádzajúca skupina Categories](test-report-postman-categories-inventory.md)

**2026-10-14; lokálny, necommitnutý checkout na HEAD `b270355`.** Prijatý [samostatný validátor](../../../../scripts/postman-inventory.js) bol opätovne použitý bez zmien. Táto správa pokrýva iba priečinok kolekcie `04 · Transactions` a sekciu katalógu `## API · Transactions`: 21 požiadaviek, 21 riadkov prípadov TC-API-022–042 a 21 revidovaných väzieb deklarácií. **Nejde** o spustenie Newman/API, nový behaviorálny PASS, úplné pokrytie F19, dôkaz CI ani akceptáciu vlastníka.

<a id="reviewed-source-links"></a>

## Revidované odkazy na zdroje

[Revidované mapovanie](../../../../qa/traceability/postman-transactions.json) pripína každý presný selektor priečinka/názvu/metódy/surovej URL, celý fingerprint požiadavky/eventu, kontext pomocného nástroja a autentifikácie kolekcie, fingerprint každého riadka prípadu a testovací marker. [Odvodený JSON](../../../../qa/docs/postman-transactions-inventory.json) bol vytvorený z nezmenenej [kolekcie Postman](../../../../qa/api/wallet.postman_collection.json), [katalógu prípadov](test-cases.md) a mapovania. Hlási `PARTIAL_STATIC_SOURCE_INVENTORY`, `NOT_RUN`, `NOT_CHECKED`, bez medzier typu iba deklarované alebo iba v zdroji **v tomto rozsahu 21 prípadov**. Pomocný nástroj na úrovni kolekcie poskytuje kontroly stavu/schémy/chýb a zdedenú bearer autentifikáciu používateľa A; požiadavka Delete-as-B túto autentifikáciu výslovne prepisuje. Tieto definície boli prehliadnuté a fingerprintované, **nie vykonané**.

| Prípady | Rozsah požiadaviek/asercí revidovaný v zdroji |
|---|---|
| TC-API-022 | Odosiela celé číslo 1250 centov bez `spent_on`; očakáva 201, presnú vrátenú sumu a dátum rovný **lokálnemu** kalendárnemu dátumu testovacieho skriptu. Nie je to dôkaz hranice časového pásma. |
| TC-API-023–029 | Odosiela nulu, jeden, strop premennou kolekcie `100000000`, strop + 1, zlomkových `12.5`, reťazec `"1250"` a chýbajúcu sumu. Asercie prijatého/odmietnutého stavu a schémy zodpovedajú jednotlivým riadkom prípadov; prípad jedného centu ukladá `txOneCent` na neskoršie vymazanie. |
| TC-API-030–033 | Skrátený JSON očakáva 400 a typ obsahu error JSON, nie 500; chybný dátum očakáva 400; prerequest vytvorí lokálny dátum **30 dní** vopred a očakáva 400; odoslanie ID kategórie používateľa B pod autentifikáciou používateľa A očakáva 404, výslovne nie 403. |
| TC-API-034 | Bez dátumového query; očakáva zoznam transakcií obsahujúci `txA` a hodnoty `spent_on` zoradené zostupne. **Neexistuje explicitný fixture vylúčenia mimo mesiaca ani dôkaz sekundárneho zoradenia pri rovnakom dátume**. |
| TC-API-035–038 | `limit=201` očakáva 400; `limit=200` očakáva 200 a schému zoznamu (nie potvrdený počet 200 riadkov); obrátený pevný rozsah dátumov očakáva 400; filtrovanie podľa kategórie používateľa B pod autentifikáciou používateľa A očakáva 404, nie 403. |
| TC-API-039–042 | Explicitný `tokenB` sa pokúša vymazať `txA` a očakáva 404/nie 403, ale **nemá nezávislé spätné načítanie dokazujúce zachovanie riadka**. Vymazanie vlastného `txOneCent` očakáva 204/prázdne telo; opakovanie očakáva 404; nečíselné ID očakáva 400. Dôkazy vytvorenia/vymazania/opakovania závisia od poradia vykonania. |

Statické preusporiadanie požiadaviek je akceptované ako kontrola identity inventára, **nie** ako dôkaz, že kolekciu možno spustiť v ľubovoľnom poradí. Historické štítky `PASS` v katalógu prípadov zostávajú historické; táto úloha API znovu nespustila ani neposilnila jeho asercie.

<a id="commands-and-controls"></a>

## Príkazy a kontroly

S použitím overeného lokálneho spustiteľného súboru Node 22.14.0:

- `node scripts/postman-inventory.js --collection qa/api/wallet.postman_collection.json --catalogue qa/docs/test-cases.md --mapping qa/traceability/postman-transactions.json --output qa/docs/postman-transactions-inventory.json`: **21 požiadaviek / 21 prípadov / 21 väzieb**, statické `NOT_RUN`.
- `node --test qa/gates/postman-transactions-inventory.test.js qa/gates/postman-categories-inventory.test.js qa/gates/postman-token-inventory.test.js qa/gates/postman-inventory.test.js`: **29/29 PASS** (Transactions 8, Categories 7, Token 6, Health 8). Negatívne prípady v pamäti odmietajú neznáme ID alebo ID mimo skupiny, chýbajúcu väzbu/riadok, odstránené/presunuté/nadbytočné požiadavky, zmenený typ peňazí/strop, konštrukciu budúceho dátumu, autentifikáciu token-B, query URL, asercie odpovede a spoločný pomocný nástroj, duplicitné selektory/anotácie a chybné/prázdne vstupy. Pozitívne prípady prijímajú preusporiadanie zdroja, CRLF a ďalšiu odlišnú požiadavku pre jeden mapovaný prípad. Uložený Transactions JSON bol hĺbkovo porovnaný s čerstvým zostavením.
- `node scripts/traceability.js`: staticky **280 ID prípadov / 78 definícií pravidiel**; bez sémantického alebo runtime tvrdenia.
- `node scripts/check.js`: **8 úspešných / 0 preskočených / 0 neúspešných** statických brán.

SHA-256: kolekcia `2f231d50879f2264bd904cc4a12577ab47474147a9687b4fb0f61907fd4f120b`; katalóg `a2d1ff0cb206113ac82ec8f6014a5d17d7627265a26602dd6cb81f52962b512d`; mapovanie Transactions `40e23c2f7cdf0c64bc49d56cc8620dd10cabaad33442dc5ce0a5eca83d69c784`; odvodený JSON `6457dd4336707cdd5598b0f168e3ac2a0fb586af6e7cf1d40b96b4e06b66e522`.

Nebol upravený žiadny skript kolekcie, riadok katalógu, validátor, runner, produktový kód, balík ani súbor CI. Ostatné skupiny API a vrstvy testov sú `NOT_CHECKED`; celé F19 zostáva **OPEN**, s predchádzajúcim súčtom projektu **17/25 nezmeneným**. Nevytvoril sa commit ani push.
