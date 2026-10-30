[English](../../../../qa/docs/analysis-pagination-consistency.md) · **Slovenčina**

<a id="transaction-pagination-consistency--f05-contract"></a>

# Konzistentnosť stránkovania transakcií — kontrakt F05

[← Späť na README](../../README.md#qa-evidence) · [Stav QA](../../docs/qa-status.md)

<a id="scope-and-wire-contract--2026-10-16"></a>

## Rozsah a kontrakt prenosu — 2026-10-16

Existujúci režim s posunom pri `GET /api/transactions` si zachováva prijatú validáciu parametrov dopytu, typ média `application/json` a presný tvar odpovede s dvoma poľami `{ items, total }`. Režim kurzora sa zapína výslovne pomocou `paging=cursor`; úvodná požiadavka nemá `cursor` a pokračovanie posiela vrátený `cursor`. `offset` je v režime kurzora neplatný, aj keď má hodnotu nula. `cursor` bez `paging=cursor` je neplatný. Oba režimy si zachovávajú `limit` 0–200 (predvolene 50), vlastníctvo účtu a existujúce filtre dátumu/kategórie. Odpovede kurzora používajú `application/vnd.wallet.cursor+json` a pridávajú iba `next_cursor`: reťazec, ak existuje ďalšia stránka, alebo `null` na konci. Rozdielne typy médií udržujú oba tvary odpovedí OpenAPI prísne bez zmeny existujúceho validátora. Nulový limit a prázdny zoznam končia hodnotou `next_cursor: null`.

Poradie je `spent_on DESC, id DESC`. Predikát pokračovania je `(spent_on < boundaryDate OR (spent_on = boundaryDate AND id < boundaryId))`; bežné predikáty účtu/dátumu/kategórie sa vždy používajú nezávisle. Hraničný riadok už nemusí existovať. Token, ktorý je pre klienta nepriehľadný, je kanonická, veľkosťou obmedzená n-tica JSON zakódovaná ako base64url. Obsahuje verziu, ID účtu, normalizované `from`/`to`, kontext kategórie (`all`, `none` pri výslovne prázdnom filtri alebo vlastné číselné ID), hraničný dátum a kladné bezpečné hraničné ID. Neniesie prihlasovací údaj ani oprávnenie. Dekódovanie odmieta chybné/príliš dlhé/nekanonické údaje, nepodporované verzie, neplatné dátumy/ID, iný účet alebo zmenené filtre s odpoveďou 400 `VALIDATION_FAILED`; hodnoty SQL zostávajú parametrami.

Ak sa prežívajúce, ešte nevidené riadky nemenia, samotné vloženie alebo zmazanie skorších riadkov pri pokračovaní nespôsobí preskočenie ani zopakovanie riadka. **Nejde** o nemennú snímku dát. Nové riadky vložené pred kurzor sa zobrazia po výslovnom obnovení Month; úprava, ktorá presunie riadok cez hranicu, externé zmeny s rovnakým súčtom a už uložené riadky mimo záruky zostávajú. `total` opisuje aktuálny počet zodpovedajúcich riadkov, nie veľkosť snímky.

Month používa režim kurzora. Ak sa `total` pri pokračovaní líši od zobrazeného súčtu, aktuálna akcia používateľa vykoná najviac jeden obmedzený reštart od prvej stránky a pred vykreslením zahodí staré položky/kurzor. Nepripojí posunutú stránku ani nezobrazí nemožný počet `shown > total`. Používateľ môže Month výslovne znovu otvoriť na obnovenie; neexistuje priebežné načítavanie na pozadí ani nekonečné automatické opakovanie. Stabilná sada dát po zmene sa potom dá stránkovať až do konca.
