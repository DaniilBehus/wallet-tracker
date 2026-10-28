[English](../../../../qa/docs/test-report-synthetic-import.md) · **Slovenčina**

<a id="synthetic-import-and-selenium--local-regression-note"></a>

# Syntetický import a Selenium — poznámka k lokálnej regresii

[← Späť na README](../../README.md) · [Analýza importu](analysis-synthetic-import.md) · [Ďalej: testy importu →](../../../../qa/import/provider-adapter.test.js)

Zaznamenané 2026-10-07 na `work/claude-wallet-2026-09-24`,
so začiatkom na `2a86d3fb18e44da82587ccd32994c2297c88842a`.
Ide o lokálnu kontrolu vykonanú agentom, nie UAT vlastníka
ani nový výsledok GitHub CI. Nepoužil sa skutočný poskytovateľ,
účet ani model.

<a id="selenium-tc-sel-009"></a>

## Selenium TC-SEL-009

Historický timeout pri druhom uložení sa v jednom cielenom behu
**nezopakoval** (1/1). Poradie v zdrojovom kóde naznačuje možný
súbeh: `submitCategoryLimit` zavrie dialóg pred čakaním na
`loadMonth()`, kým `withBusy` drží tlačidlo Save vypnuté
a `state.busy` na true až do dokončenia obnovenia. Pomocná
funkcia page objectu predtým vrátila riadenie hneď po skrytí
dialógu, takže ďalšia operácia mohla začať pred dokončením
predchádzajúceho uloženia. Teraz navyše čaká na opätovné
zapnutie toho istého tlačidla. Je to pozorovateľná podmienka
dokončenia, nie pevné čakanie, zvýšenie timeoutu či oslabenie
obchodnej asercie. Po zmene cielený TC-SEL-009 prešiel
1/1 a celá sada Selenium 11/11. Príčina pôvodného timeoutu
zostáva **nepreukázaná**; neoznačujte ho za opravený.

Kontroly reprodukujete pomocou
`npm run test:selenium -- -k test_category_editor_sets_reaches_and_clears_its_own_limit -vv -s`
a `npm run test:selenium`. Hook Selenium pri zlyhaní testu
ukladá snímku obrazovky, zdroj stránky a konzolu prehliadača
do ignorovaného `qa/reports/selenium/`; každý nový beh
tento priečinok vynuluje.

<a id="import-coverage"></a>

## Pokrytie importu

Existujúce offline testy už pokrývajú náhľad iba na čítanie,
odmietnutie celej dávky po skoršom platnom zázname, konflikt
zmenenej identity, opakovanie po strate odpovede bez duplicity,
izoláciu kategórie/identity podľa používateľa, neplatný
JSON/typy polí, upstream odmietnutie, timeout, presmerovanie
a limity bajtov/počtu. Do existujúcej tabuľky zlyhaní pribudli
dve chýbajúce kontroly tvaru upstream odpovede: prázdny
zoznam záznamov a duplicitné externé ID. Obe musia vrátiť
`INVALID_RESPONSE` bez zápisu transakcie Wallet či registra
požiadaviek. Pravidlá importu, trasa ani cesta ukladania
sa nemenili.

`npm run test:import` prešlo 11/11; `npm run check`
prešlo 8/8. Upravené súbory JavaScript a Python prešli
kontrolami syntaxe. Ide iba o lokálne výsledky;
testovací loopback adaptér nie je produktovým konektorom.
