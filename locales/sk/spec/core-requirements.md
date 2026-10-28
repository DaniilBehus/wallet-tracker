[English](../../../spec/core-requirements.md) · **Slovenčina**

<!-- locale-links-v1: source-relative links rebased for locales/sk -->

<!-- Original English heading anchors retained for stable cross-language references. -->
<a id="core-requirements--traceability-index"></a>
# Základné požiadavky — index vysledovateľnosti

Tento dokument priraďuje aktuálne verejné pravidlá produktu k stabilným identifikátorom. Nerekonštruuje súkromné rozhodovacie záznamy ani nezaznamenáva akceptáciu vlastníka.

[Architektúra](architecture.md) uvádza všeobecné rozhodnutia produktu; [OpenAPI kontrakt](../../../spec/openapi.json) zaznamenáva presné aktuálne správanie požiadaviek a odpovedí. Hranica prevzatá iba z OpenAPI je nižšie označená ako **pozorovaný kontrakt**, nie ako nezávisle schválená obchodná požiadavka. ID pre [mesačné limity](../qa/docs/analysis-monthly-limit.md), [limity kategórií](../qa/docs/analysis-category-limits.md), [AI](ai-expense-entry.md) a [kontroly kontraktu](../docs/api/README.md#requirements-for-the-contract-checks) zostávajú vo vlastných zdrojoch. Odkazy hovoria, *čo kontrolovať*, nie že test prebehol alebo že vlastník prijal výsledok.

<a id="current-core-rules"></a>
## Aktuálne základné pravidlá

<a id="req-core-01--health"></a>
### <a id="req-core-01"></a>REQ-CORE-01 · Zdravie

Neautentifikovaný `GET /api/health` odpovie stavom služby a databázy bez čítania údajov používateľa. Zdroj: [architektúra §4](architecture.md#4-api-design) a [pozorovaná OpenAPI operácia](../../../spec/openapi.json). O zdraví databázovej sondy informuje pole `db`, nie iba HTTP 200.

<a id="req-core-02--account-and-token"></a>
### <a id="req-core-02"></a>REQ-CORE-02 · Účet a token

Registrácia vytvorí účet a prihlásenie vydá podpísaný JWT; chránené cesty vyžadujú platný token Bearer. Nesprávne alebo neznáme heslo/účet neprezradí, ktorý účet existuje. Zdroje: [architektúra §§3–4](architecture.md#3-data-model-and-invariants) a [pozorované OpenAPI autentifikačné operácie](../../../spec/openapi.json).

<a id="req-core-03--password-boundary"></a>
### <a id="req-core-03"></a>REQ-CORE-03 · Hranica hesla

Aktuálny registračný kontrakt vyžaduje heslo s minimálne ôsmimi kódovými jednotkami UTF-16 a najviac 72 bajtmi UTF-8, aby bcrypt potichu neignoroval príponu. **Pozorovaný kontrakt**, nie obnovené súkromné rozhodnutie: [OpenAPI registrácia](../../../spec/openapi.json) a [BUG-017](../log/BUGS.md).

<a id="req-core-04--per-user-ownership"></a>
### <a id="req-core-04"></a>REQ-CORE-04 · Vlastníctvo používateľa

Kategórie, výdavky, rozvrhy a nastavenia patria autentifikovanému účtu. Chýbajúci alebo cudzí zdroj pri jeho vyhľadaní vráti rovnaké 404 bez prezradenia údajov iného účtu. Zdroje: [architektúra §§3–4](architecture.md#3-data-model-and-invariants) a [pozorované OpenAPI operácie](../../../spec/openapi.json).

<a id="req-core-05--categories"></a>
### <a id="req-core-05"></a>REQ-CORE-05 · Kategórie

Účet má vlastné kategórie; ich názvy sú v rámci účtu jedinečné. Aktuálna registrácia vytvára úvodné kategórie. Hranica názvu na 60 znakov a detaily chýb sú **pozorovaný kontrakt**. Zdroje: [architektúra §3](architecture.md#3-data-model-and-invariants) a [OpenAPI kategórie](../../../spec/openapi.json).

<a id="req-core-06--expense-amount-and-save"></a>
### <a id="req-core-06"></a>REQ-CORE-06 · Suma a uloženie výdavku

Výdavok zaznamenáva kladný celočíselný počet centov; neplatné, zlomkové, chýbajúce alebo nadlimitné sumy sa odmietnu namiesto automatického prispôsobenia. Presný strop 100 000 000 centov je **pozorovaný kontrakt**. Zdroje: [architektúra §§2–3](architecture.md#3-data-model-and-invariants) a [OpenAPI vytvorenie transakcie](../../../spec/openapi.json).

<a id="req-core-07--calendar-dates"></a>
### <a id="req-core-07"></a>REQ-CORE-07 · Kalendárne dátumy

Dátumy výdavkov a rozvrhov používajú skutočné lokálne kalendárne dátumy `YYYY-MM-DD`, nie prevod dátumu cez UTC. `spent_on` výdavku nesmie byť neskorší než zajtrajší deň podľa lokálneho času servera; `starts_on` rozvrhu nemá relatívne obmedzenie do minulosti ani budúcnosti. Tieto rozdielne validačné hranice sú **pozorovaný kontrakt**. Zdroje: [architektúra §2](architecture.md#2-architecture), [OpenAPI dátumy](../../../spec/openapi.json) a [validácia dátumov](../../../src/dates.js).

<a id="req-core-08--transaction-list-and-paging"></a>
### <a id="req-core-08"></a>REQ-CORE-08 · Zoznam a stránkovanie transakcií

Účet môže zobraziť a filtrovať vlastné výdavky podľa dátumu/kategórie; aktuálny zoznam je zoradený a stránkovaný, nie potichu orezaný na 200 riadkov. Predvolený mesiac, `limit` 0–200 a bezpečný offset sú **pozorovaný kontrakt**. Voliteľné kurzorové stránkovanie používa rovnaké poradie a filtre na pokračovanie bez posunu offsetu po skorších vloženiach alebo zmazaniach; obnovenie živého počtu a obmedzenia bez snapshotu uvádza [analýza konzistencie stránkovania](../qa/docs/analysis-pagination-consistency.md). Zdroje: [architektúra §4](architecture.md#4-api-design), [OpenAPI zoznam](../../../spec/openapi.json) a [aktuálny kód stránkovania](../../../src/routes/transactions.js).

<a id="req-core-09--expense-edit-and-delete"></a>
### <a id="req-core-09"></a>REQ-CORE-09 · Úprava a zmazanie výdavku

`PATCH` mení len dodané polia, ktoré smie upravovať klient; prázdna úprava alebo úprava serverových polí sa odmietne. Zmazanie odstráni výdavok vlastníka; chýbajúce/cudzie riadky nie sú dostupné. Zdroje: [architektúra §4](architecture.md#4-api-design) a [OpenAPI operácie transakcií](../../../spec/openapi.json).

<a id="req-core-10--keyed-versus-deliberate-saves"></a>
### <a id="req-core-10"></a>REQ-CORE-10 · Uloženia s kľúčom a zámerne odlišné uloženia

Jeden platný `Idempotency-Key` v rozsahu účtu s rovnakými kanonickými dátami zopakuje pôvodné úspešné vytvorenie; konfliktné dáta alebo zmazaný pôvodný záznam vrátia 409. Uloženia bez kľúča alebo zámerne odlišné uloženia nesľubujú deduplikáciu. Zdroje: [architektúra §4](architecture.md#4-api-design), [OpenAPI vytvorenie transakcie](../../../spec/openapi.json) a [LIMIT-002](../log/BUGS.md).

Bežná obrazovka Add pred odoslaním trvalo uloží operačný kľúč v rozsahu účtu a zmrazenú sumu/kategóriu/poznámku/dátum. Stratená odpoveď znamená **neistý výsledok**, nie pokyn vytvoriť ďalší výdavok. Rovnaký kľúč a telo znovu odošle iba výslovné Check/retry; zámerné nasledujúce Save dostane nový kľúč. Nečitateľné lokálne úložisko obnovy blokuje ďalší finančný zápis namiesto prechodu na požiadavku bez kľúča. [Kontrakt obnovy](../qa/docs/analysis-write-recovery.md).

<a id="req-core-11--schedules-and-loans"></a>
### <a id="req-core-11"></a>REQ-CORE-11 · Rozvrhy a úvery

Predplatné nemá celkový počet; úver má konečný počet. Suma/deň/počet musia byť platné a zostávajúce hodnoty sa počítajú pri čítaní namiesto ukladania. Aktuálnych 1 200 splátok a peňažné stropy sú **pozorovaný kontrakt**, chránený aj [BUG-018](../log/BUGS.md). Zdroje: [architektúra §3](architecture.md#3-data-model-and-invariants) a [OpenAPI rozvrhy](../../../spec/openapi.json).

<a id="req-core-12--due-date-clamping"></a>
### <a id="req-core-12"></a>REQ-CORE-12 · Obmedzenie dátumu splatnosti

Rozvrh splatný v neexistujúci deň mesiaca pripadne na posledný deň tohto mesiaca; 31. deň sa vo februári zmení na 28. alebo 29. Zdroj: [architektúra §3](architecture.md#3-data-model-and-invariants).

<a id="req-core-13--payment-lifecycle"></a>
### <a id="req-core-13"></a>REQ-CORE-13 · Životný cyklus platby

Zaplatenie aktívneho rozvrhu vytvorí jeden prepojený výdavok a zvýši počet platieb. Úver sa po dosiahnutí celkového počtu deaktivuje; ďalšia platba je 409. Zdroje: [architektúra §§3–4](architecture.md#3-data-model-and-invariants) a [OpenAPI operácie rozvrhov](../../../spec/openapi.json).

Voliteľná platba Pay s kľúčom zmrazí zobrazené predpoklady rozvrhu a dátum; server atomicky zaznamená kľúč s prepojeným výdavkom. Rovnaký kľúč a dáta zopakujú pôvodný výsledok aj po poslednej splátke; nový kľúč voči zastaranému alebo uzavretému rozvrhu sa odmietne. Pay bez kľúča zachováva pôvodný kontrakt. Stratená odpoveď v prehliadači zostáva neistá, kým človek výslovne nezvolí kontrolu/opakovanie. [Kontrakt obnovy](../qa/docs/analysis-write-recovery.md).

<a id="req-core-14--income-settings"></a>
### <a id="req-core-14"></a>REQ-CORE-14 · Nastavenie príjmu

Účet má jedno aktuálne nastavenie mesačného príjmu. Nový účet číta `monthly_income_cents: 0` aj pred vytvorením riadka nastavení; príjem nemožno nastaviť na null. Null je povolený pri voliteľnom `monthly_limit_cents`, nie pri príjme. Výmena príjmu nemení nastavenie iného účtu. Presné správanie typov/stropov je **pozorovaný kontrakt**. Zdroje: [architektúra §3](architecture.md#3-data-model-and-invariants) a [OpenAPI nastavenia](../../../spec/openapi.json).

<a id="req-core-15--month-summary"></a>
### <a id="req-core-15"></a>REQ-CORE-15 · Mesačný súhrn

Súhrn vypočíta minuté centy, podiely kategórií a zostávajúci príjem zo záznamov účtu; formátovanie zobrazenia prebieha v prehliadači. Zdroje: [architektúra §§2, 4–5](architecture.md#4-api-design) a [OpenAPI súhrn](../../../spec/openapi.json). Stavy celkového limitu a limitov kategórií samostatne určujú REQ-ML a REQ-CL.

<a id="req-core-16--api-errors"></a>
### <a id="req-core-16"></a>REQ-CORE-16 · Chyby API

Chyby API používajú vnorený tvar `{error:{code,message}}`; chybný JSON, neplatný vstup, chýbajúca autentifikácia/zdroj, konflikt stavu a obmedzenie neúspešného prihlásenia majú odlišné výsledky 400/401/404/409/429. Nadmerný JSON je 413. Zdroje: [architektúra §4](architecture.md#4-api-design) a [OpenAPI odpovede](../../../spec/openapi.json).

<a id="req-core-17--failed-login-throttle"></a>
### <a id="req-core-17"></a>REQ-CORE-17 · Obmedzenie neúspešných prihlásení

Opakované neúspešné prihlásenia sa obmedzujú pred hashovaním hesla bez toho, aby nesprávny účet odhalil existenciu účtov. Detaily okna/počítadla sú **pozorovaný kontrakt**. Zdroje: [architektúra §4](architecture.md#4-api-design), [OpenAPI prihlásenie](../../../spec/openapi.json) a [BUG-004](../log/BUGS.md).

<a id="req-core-18--add-flow"></a>
### <a id="req-core-18"></a>REQ-CORE-18 · Postup Add

Obrazovka Add pre telefón ponúka numerickú klávesnicu, výber kategórie, voliteľnú poznámku a výslovné Save. Chýbajúca suma sa potichu neuloží. Nevyriešené Save alebo Pay sa zobrazí ako obnova špecifická pre účet; rozhranie ju nikdy potichu neopakuje ani netvrdí, že sa nič neuložilo. Zdroj: [architektúra §5](architecture.md#5-interface-and-interaction-design).

<a id="req-core-19--month-flow"></a>
### <a id="req-core-19"></a>REQ-CORE-19 · Postup Month

This month zobrazuje konzistentné súčty, kategórie a výdavky zoskupené podľa dňa s úpravou a zmazaním na mieste. Názvom riadka môže byť poznámka, inak kategória. Nový účet vyzve na nastavenie príjmu namiesto vymysleného zostatku; zrušenie editora ponechá uloženú hodnotu. Tieto detaily výzvy na príjem, poznámky, zrušenia a prstencového grafu sú **pozorované rozhranie**. Zdroje: [architektúra §5](architecture.md#5-interface-and-interaction-design) a [aktuálne rozhranie](../../../public).

<a id="req-core-20--upcoming-flow"></a>
### <a id="req-core-20"></a>REQ-CORE-20 · Postup Upcoming

Upcoming uvádza aktívne rozvrhy podľa najbližšieho dátumu platby a ponúka Pay s viditeľným priebehom splácania. Pay zmrazí riadok zobrazený v okamihu akcie; zmenený riadok znamená konflikt, nie odvodenie ďalšej platby. Zdroj: [architektúra §5](architecture.md#5-interface-and-interaction-design).

<a id="req-core-21--schedule-form"></a>
### <a id="req-core-21"></a>REQ-CORE-21 · Formulár rozvrhu

Obrazovka Schedules vytvára opakované platby a výslovne vybrané úvery; voľba úveru zobrazí počet splátok. Vlastný riadok možno upraviť existujúcim schedule PATCH API bez vytvorenia ďalšieho rozvrhu alebo zmeny minulých platieb. Editor zachováva uložené hodnoty a neznámy výsledok zápisu považuje za neistý. Zdroje: [architektúra §5](architecture.md#5-interface-and-interaction-design) a [kontrakt úpravy rozvrhu](../qa/docs/analysis-schedule-editing.md).

<a id="req-core-22--accessible-interaction"></a>
### <a id="req-core-22"></a>REQ-CORE-22 · Prístupné interakcie

Interaktívne prvky a prvky overované testami majú stabilný `data-testid` a použiteľné roly; rozhranie zostáva ovládateľné klávesnicou a navrhnuté prednostne pre telefón. Zobrazovaný jazyk je angličtina a peniaze sú v eurách. Zdroje: [architektúra §5](architecture.md#5-interface-and-interaction-design) a [verejný návrh testov](../qa/docs/test-design.md).

<a id="req-core-23--untrusted-display-text"></a>
### <a id="req-core-23"></a>REQ-CORE-23 · Nedôveryhodný zobrazovaný text

Poznámky výdavkov a názvy rozvrhov sa zobrazujú ako text, nie spustiteľné značkovanie. Ide o **pozorovaný bezpečnostný regresný kontrakt**, nie schválenie odvodené zo starého označenia relácie. Zdroje: [aktuálne rozhranie](../../../public) a [bezpečnostné browser scenáre](../../../qa/e2e/security.spec.js).

<a id="req-core-24--request-diagnostics"></a>
### <a id="req-core-24"></a>REQ-CORE-24 · Diagnostika požiadaviek

Aktuálne odpovede nesú ID požiadavky; bežné logy vynechávajú prihlasovacie údaje, popisy výdavkov a iný citlivý obsah. Ide o **pozorovaný podporný kontrakt**, nie skúsenosť s podporou produkcie. Zdroj: [podporný balík](../docs/support/README.md).

<a id="req-core-25--read-only-support-diagnostics"></a>
### <a id="req-core-25"></a>REQ-CORE-25 · Podporná diagnostika len na čítanie

Parametrizované SQL príklady verejného podporného balíka sú len na čítanie a vysvetľujú aktuálny mesiac, limit, platby, kľúče a kvóty bez úpravy údajov. Ide o **pozorované podporné cvičenie**. Zdroj: [SQL diagnostika](../docs/support/sql-diagnostics.md).

<a id="req-core-26--visible-limit-status"></a>
### <a id="req-core-26"></a>REQ-CORE-26 · Viditeľný stav limitu

Stav limitu zostáva textový aj vizuálny. Aktuálne prijaté UAT pozorovanie používa obrys pri zostávajúcom rozpočte a bielu na plnej červenej pri vyčerpaní, pričom dosiahnutie a prekročenie zostávajú odlišné slovné stavy. Zdroj: [UAT-OBS-01](../qa/docs/uat-monthly-limit.md#uat-obs-01--the-over-limit-state-is-marked-too-weakly) a [mesačné REQ-ML-09](../qa/docs/analysis-monthly-limit.md#req-ml-09).

<a id="req-core-27--submission-intent"></a>
### <a id="req-core-27"></a>REQ-CORE-27 · Zámer odoslania

Aktuálny prehliadač zabraňuje dvom takmer súčasným ťuknutiam na jeden zámer Save odoslať ho dvakrát. Dokončená druhá používateľská akcia zostáva novým výdavkom bez kľúča; nejde o univerzálnu idempotenciu POST. Zdroj: [LIMIT-002](../log/BUGS.md) a [browser regresné prípady](../qa/docs/test-cases.md#end-to-end--double-submission--qae2edouble-submitspecjs).

<a id="req-core-28--additive-settings-migration"></a>
### <a id="req-core-28"></a>REQ-CORE-28 · Aditívna migrácia nastavení

Existujúca databáza získa stĺpec mesačného limitu s povoleným null bez straty uloženého príjmu; opakovaný štart je bezpečný a nová i aktualizovaná schéma sa zhodujú. Ide o **pozorovaný migračný kontrakt**, nie rekonštruované obchodné rozhodnutie. Zdroje: [aktuálna migrácia](../../../src/db.js) a [migračné prípady](../../../qa/db/migration.test.js).

<a id="legacy-reference-migration-index"></a>
## Migračný index historických odkazov

Historické čísla `§` nižšie odkazovali na staršie rozloženie architektúry. Aktuálna architektúra má len §§1–7; zhodné číslo **nedokazuje** zhodný význam. Označenia D zaznamenávajú historické rozhodnutia, ale úplný súkromný index a pôvodné schválenie/odôvodnenie nie sú verejne dostupné. Všetky odôvodnenia/schválenia riadkov D nižšie sú **UNKNOWN**; tabuľka je navigačná pomôcka, nie rekonštrukcia histórie.

| Historické označenie | Aktuálny verejný význam alebo stav |
|---|---|
| staré §3 integer/ownership | [architektúra §3](architecture.md#3-data-model-and-invariants), REQ-CORE-04/06 |
| staré §4.1 dates/clamping | REQ-CORE-07/12 |
| staré §4.2 schedule countdown/pay | REQ-CORE-11/13 |
| staré §4.3 validation/ownership | REQ-CORE-03/04/06/07/11/14/16; vybrať podľa významu prípadu |
| staré §5 API/status | [architektúra §4](architecture.md#4-api-design), REQ-CORE-01/02/05/08–10/14–17 |
| staré §6, §6.1–§6.4 interface | [architektúra §5](architecture.md#5-interface-and-interaction-design), REQ-CORE-18–22 |
| staré §6.5 test IDs | [architektúra §5](architecture.md#5-interface-and-interaction-design), REQ-CORE-22 |
| staré §8/§9 | zrušené čísla článkov; pri každom prípade skontrolovať skutočný aktuálny zdroj funkcie/limitu |
| D-011 / D-012 | REQ-CORE-12 / REQ-CORE-22 |
| D-016 / D-024 | REQ-CORE-17; záťažové pozorovanie zostáva [BUG-004](../log/BUGS.md) alebo [LIMIT-001](../log/BUGS.md) |
| D-017 | len poznámka o porte/prostredí; [nastavenie testov](../docs/testing.md), **nie** požiadavka produktu |
| D-018 / D-019 / D-020 | REQ-CORE-22 / REQ-CORE-22 / REQ-CORE-19 |
| D-021 / D-022 | REQ-CORE-14–15 / REQ-CORE-19 |
| D-029 / D-030 / D-031 | REQ-CORE-09 / REQ-CORE-27 / REQ-CORE-08 |
| D-032 | [metóda návrhu testov](../qa/docs/test-design.md), **nie** požiadavka produktu |
| D-035 | REQ-CORE-10; presné opakovanie/konflikt uvádza [pozorované OpenAPI](../../../spec/openapi.json) |
| D-045 / D-046 | REQ-CORE-03 / REQ-CORE-11; dôkazy [BUG-017/018](../log/BUGS.md) |

[Analýza syntetického importu](../qa/docs/analysis-synthetic-import.md) je výslovne predbežná; jej označenia PRE/VAL/AT/ID/ISO/UI **nie sú** prijaté REQ ID. Spustiteľné `TC-CONTRACT-IMPORT` zostáva mimo hlavného 280-riadkového katalógu. Úplné zosúladenie spustiteľných prípadov patrí do F19.
