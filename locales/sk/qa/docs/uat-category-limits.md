[English](../../../../qa/docs/uat-category-limits.md) · **Slovenčina**

<!-- locale-links-v1: source-relative links rebased for locales/sk -->

<a id="category-spending-limits--owner-acceptance-script"></a>
# Limity výdavkov kategórií — akceptačný scenár vlastníka

[← Späť na README](../../README.md#qa-evidence) · [Správa z lokálnych automatizovaných testov](test-report-category-limits.md) · [Požiadavky](analysis-category-limits.md)

**Vlastník oznámil PASS 13/13 a prijatie testovacieho zostavenia dňa 2026-10-19; pozri
[záznam o aktuálnom zostavení](uat-current-build.md#owner-record--reported-2026-10-19).**
Automatizované prehliadačové kontroly sú oddelené od UAT. Pri opakovaní použite
jednorazový účet a databázu, nikdy nie osobné záznamy ani `npm start`
(načítava lokálny súbor prostredia a predvolene používa skutočnú databázu).
Pri [odovzdaní aktuálneho zostavenia](uat-current-build.md) použite jeho
existujúci server a syntetickú databázu; nespúšťajte druhý server na rovnakom porte.

<a id="safe-setup"></a>
## Bezpečné nastavenie

V samostatnom termináli spustite skutočnú aplikáciu bez načítania súboru prostredia:

```powershell
$env:DB_PATH="./data/uat-category-limits.db"
$env:JWT_SECRET="uat-only-not-a-real-secret"
$env:WALLET_AI_MODE="off"
$env:PORT="3035"
node src/server.js
```

Použite cestu k databáze, ktorá ešte neexistuje. Otvorte
`http://127.0.0.1:3035` a zaregistrujte syntetický účet, napríklad
`category-uat@example.test`. Kľúč poskytovateľa ani externá služba
nie sú potrebné. Potom server zastavte a zatvorte terminál, aby tieto
premenné určené iba na testovanie neovplyvnili neskorší vývojový beh.

<a id="steps"></a>
## Kroky

| # | Akcia | Očakávaný výsledok |
|---|---|---|
| 1 | V Add uložte €50.00 do Groceries; otvorte Month a klepnite na riadok kategórie | Editor uvádza Groceries; pole limitu je prázdne |
| 2 | Nastavte 200.00 | €50.00 z €200.00; Within limit · €150.00 left, biely obrys |
| 3 | Nastavte 50.00 | Limit reached; plné červené pole, biele slová, nikdy nie „over“ |
| 4 | Nastavte 40.00 | Over limit by €10.00; rovnaké červené pole |
| 5 | Pridajte ďalších €10.00 do Groceries | Uloženie uspeje; mesiac €60.00, prekročenie o €20.00 |
| 6 | Nastavte celkový limit 10.00, príjem 1000.00; limit kategórie 200.00 | Celkový limit je prekročený, kategória zostáva v limite; bez upozornenia na ich súčet; príjem nezmenený |
| 7 | Znovu otvorte editor kategórie | Aktuálna hodnota 200.00 je predvyplnená; vstup má fokus |
| 8 | Zadajte abc, potom -1 a zakaždým skúste Save | Chyba pri poli; editor zostáva otvorený a uložený limit sa nemení |
| 9 | Zadajte 99.00, potom Cancel; znovu otvorte | Bez zmeny; stále 200.00 |
| 10 | Nastavte 0 | Skutočný nulový limit; prekročenie o €60.00, nie zrušenie limitu |
| 11 | Vyprázdnite pole a stlačte Save; obnovte Month | Riadok výdavkov zostáva; bez stavového poľa a rozpočtu |
| 12 | Pri šírke 320px nastavte znovu 60.00; prečítajte riadok, sumu a pole dosiahnutého limitu; použite Tab/Escape v editore | Bez orezania do strán; ovládacie prvky sú dosiahnuteľné; fokus sa vráti na riadok |
| 13 | Vytvorte kategorizované predplatné v Transport; vráťte sa do Month pred zaplatením, potom ho zaplaťte v Upcoming | Plánovaná splátka nepridá výdavok; zaplatená splátka sa objaví v Transport |

Kategória bez výdavkov a bez limitu nemá riadok, na ktorý sa dá klepnúť.
Jej prvý rozpočet potrebuje prvý výdavok alebo API; ide o prijatý rozsah
CL-D10, nie o obrazovku nastavení všetkých kategórií. Bez kategórie nemá
limit ani editor. Riadky s nulovou útratou a limitom, vlastníctvo
a správanie historických mesiacov majú automatizované pokrytie v správe;
nie sú vydávané za manuálne pozorovania UAT.

<a id="owner-sign-off"></a>
## Potvrdenie vlastníka

| SHA zostavenia | Dátum | Hodnotiteľ | Výsledok | Pozorovania |
|---|---|---|---|---|
| `15dfc45c9e34bb7f0da5632c73fa37c07563c7cf` (rovnaký aplikačný strom ako publikované `7b1cb328`) | 2026-10-19 | Vlastník produktu | PASS 13/13; prijal toto testovacie zostavenie | Výsledok podľa vyjadrenia vlastníka; neboli dodané snímky ani pozorovania po jednotlivých krokoch |
