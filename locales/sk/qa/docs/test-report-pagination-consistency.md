[English](../../../../qa/docs/test-report-pagination-consistency.md) · **Slovenčina**

<a id="f05-pagination-consistency--local-candidate-report"></a>

# Konzistentnosť stránkovania F05 — lokálna kandidátska správa

[← Späť na README](../../README.md#qa-evidence) · [Technický kontrakt](analysis-pagination-consistency.md) · [Stav QA](../../docs/qa-status.md)

<a id="before-the-repair--2026-10-16"></a>

## Pred opravou — 2026-10-16

Skutočný jednorazový HTTP svedok použil štyri vlastné výdavky s rovnakým dátumom
a `limit=2`. Prvá stránka vrátila dve najnovšie ID. Vloženie novšieho výdavku
pred pokračovaním s `offset=2` zopakovalo už videné hraničné ID; vymazanie
videného výdavku pred týmto pokračovaním preskočilo nevidené zachované ID.
Táto kontrola prešla, lebo asertovala **starú chybu**, nie želaný výsledok.

Posilnené existujúce prehliadačové scenáre TC-E2E-055 a TC-E2E-057 potom
zlyhali **4/4** na starom kóde Month na telefóne aj desktope. Po vložení riadka
druhým klientom staré UI hlásilo „Showing 52 of 52“ namiesto ohraničeného
reštartu; samostatný HTTP svedok preukázal mechanizmus duplicity. Po vymazaní
druhým klientom počítadlo dosiahlo koniec, hoci vymazané ID zostalo viditeľné
a nevidené zachované ID chýbalo. Boli to chyby produktu, nie asercie iba nad
mockom; každý test použil syntetické riadky vytvorené cez API a spravovaný
prehliadač.

<a id="local-change-and-bounded-guarantee"></a>

## Lokálna zmena a ohraničená záruka

Pôvodné offset API si zachováva správanie query, typ média `application/json`
a presnú odpoveď `{items,total}`. Explicitné `paging=cursor` vyberá
`application/vnd.wallet.cursor+json` s `{items,total,next_cursor}`. Dva typy
média zachovávajú prísne, samostatne validované tvary odpovedí OpenAPI.
Pokračovanie používa `spent_on DESC,id DESC`, token viazaný na účet/filter
s prísnou validáciou a parametrizované SQL so samostatným predikátom `user_id`.
Vymazaný hraničný riadok sa nevyhľadáva. Stránka s nulovým limitom alebo
posledná stránka má `next_cursor: null`; tlačidlo Month Show more sa vtedy
ukončí.

Pri nezmenených zachovaných nevidených riadkoch ich samotné skoršie
vloženie/vymazanie nemôže v pokračovaní preskočiť ani zopakovať. Keď sa zmení
aktuálny celkový počet, jedna akcia Show more zahodí starý zoznam/kurzor Month
a vyžiada jednu čerstvú prvú stránku; nikdy nepripojí posunutú stránku ani
neukáže `51 of 50`. Používateľ môže z tejto stránky pokračovať alebo sa
výslovne vrátiť do Month na obnovenie. Nie je to snapshot databázy: úpravy
presúvajúce pozíciu riadka v triedení, nové riadky vložené pred kurzorom až
do obnovenia, externé mutácie pri nezmenenom celkovom počte a už cacheované
riadky sú mimo tejto záruky. Pozri [kontrakt](analysis-pagination-consistency.md).

<a id="observed-checks"></a>

## Pozorované kontroly

Všetky HTTP/prehliadačové spustenia používali nainštalovaný Node 22.14.0,
strážený loopback, syntetické účty, vypnuté AI/demo seams a vlastné jednorazové
databázy. Tieto spustenia nečítali `.env`, skutočného providera, externý cieľ
ani používateľské dáta.

| Kontrola | Lokálny výsledok |
|---|---|
| Pred opravou `--test-name-pattern=PAGING-CONTROL` | 1/1 PASS svedka driftu starého offsetu (asertoval chybu). |
| Pred opravou spravované stránkovanie `--grep 'one row past\|count stays honest'` | 0/4 očakávané chyby produktu, telefón a desktop. |
| Po oprave `--test-name-pattern=PAGING-CONTROL` | 2/2 PASS: porovnanie starého driftu a kontrola mutácie/validácie kurzora. |
| `node scripts/check-openapi.js` | PASS, 21/21 operácií zdroja a 300 lokálnych referencií. Medziverzia obálky `oneOf` zlyhala na existujúcej kontrole typovanej odpovede; samostatné prísne schémy médií vyriešili tento problém návrhu kontraktu pred runtime kontrolami. |
| `node --test qa/contract/contract.test.js` | 17/17 PASS; 388 validovaných skutočných loopback HTTP odpovedí v 21 operáciách zdroja. Kontrola kurzora pokrýva väzby pri rovnakom dátume, úplné ukončenie, vloženie pred hranicou, vymazanie videných/hraničných/nevidených riadkov, prázdne/nulové stránky, neplatné/nekanonické/príliš dlhé/nebezpečné/dátumové tokeny, zmiešané stránkovanie, zmenené filtre/účet, izoláciu zoznamu iného účtu a nezmenené riadky DB po odmietnutí. |
| `node qa/e2e-runner/run.js qa/e2e/pagination.spec.js` | 8/8 PASS na telefóne/desktope. Pôvodné hranice 50, 51 a 201 zostali; dva posilnené prípady porovnávajú presné množiny zachovaných ID a počítadlo/ukončenie po zápisoch druhého klienta. |
| `node qa/e2e-runner/run.js qa/e2e/editing.spec.js` | 18/18 PASS, zachováva prijatý editor výdavkov. |
| Cielené spravované a11y kontroly editora/klávesnice | 4/4 PASS pri 320×568 a 1280×800. Prvý pokus narazil na súbežne obsadený E2E port a sadu vôbec nespustil; následný sekvenčný pokus prešiel. Historicky neúplné ciele farebného kontrastu zostávajú nevyriešené. |
| Čisté kontroly Source/Login/bind; kontroly plánu CI | 73/73 a 13/13 PASS. Prvý pokus o kontrolu zdroja zlyhal 4/73, pretože úprava dvoch riadkov katalógu zneplatnila nesúvisiace pripnuté hashe inventára Postman; tieto dva riadky boli obnovené bez zmeny, inventár zdroja sa obnovil a rovnakých 73 kontrol prešlo. |
| Statický inventár/F13/check/plan | Inventár zdroja aj API inventár s `--check` PASS; F13 280 ID/78 definícií, `scripts/check.js` 8/8, `scripts/verify-ci.js --plan` 22 úloh, všetky `NOT_RUN`. |

Evidencia zdroja stále obsahuje **280 hlavných ID prípadov**, **138
QA/script súborov**, šesť pripnutých konfigurácií a 20 identít parametrov.
Dve nové HTTP deklarácie `PAGING-CONTROL` sú doplnkové pomocné kontroly, nie
nové prípady katalógu. Skoršie prípady katalógu 50/51/201 si zachovávajú
svoje ID a text riadkov; skutočný prehliadačový zdroj 055/057 bol posilnený.
Znenie katalógu zostalo nezmenené, pretože nesúvisiace prijaté inventáre
Postman pripínajú celý súbor katalógu. V čase tejto pracovnej správy ešte
neprebehla nezávislá revízia; lokálne prijatý počet bol **20/25**. Tieto
lokálne výsledky samotné nepreukázali úplné overenie kombinovaného stromu,
vzdialené CI pre presné SHA, UAT vlastníka, úplný audit prístupnosti ani
schválenie vydania.

<a id="independent-agent-review--2026-10-16"></a>

## Nezávislá revízia agenta — 2026-10-16

Nezávislá agentova čítacia revízia kódu/dôkazov v určenom rozsahu a následná
lokálna koordinačná revízia prijali ohraničenú opravu F05. Aktuálny lokálne
prijatý počet nálezov je **21/25 (84% podľa počtu nálezov)**, nie percento
pokrytia, úsilia, času alebo pripravenosti na vydanie. Vyššie uvedené HTTP
a prehliadačové spustenia sú dôkazom Wallet workera; táto revízia nie je
ľudským auditom prístupnosti, ďalším úplným runtime behom, vzdialeným CI pre
presné SHA, UAT vlastníka, publikovaním ani schválením vydania. Limity bez
snapshotu a zostávajúce brány platia naďalej; pozri [stav QA](../../docs/qa-status.md).
