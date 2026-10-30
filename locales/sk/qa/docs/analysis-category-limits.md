[English](../../../../qa/docs/analysis-category-limits.md) · **Slovenčina**

<a id="category-spending-limits--requirements-and-test-analysis"></a>

# Limity výdavkov podľa kategórie — požiadavky a analýza testov

[← Späť na README](../../README.md#qa-evidence) · [Mesačný limit, ktorý táto funkcia rozširuje](analysis-monthly-limit.md) · [Ďalej: testovacie prípady →](test-cases.md)

Analýza druhej rozpočtovej funkcie Wallet, napísaná pred kódom a v rovnakej
podobe ako [analýza mesačného limitu](analysis-monthly-limit.md): cieľ
a rozsah, obchodné pravidlá s cenou každého z nich, požiadavky ako
používateľské príbehy s akceptačnými kritériami Given/When/Then,
rozhodovacia tabuľka, hranice, prechody stavov, negatívne prípady,
riziká, sledovateľnosť a poznámka o dopade zmien.

Funkcia v jednej vete: **človek nastaví kategórii vlastný mesačný limit
a mesačný rozpis pre danú kategóriu ukáže, či rozpočet ešte zostáva,
je presne vyčerpaný alebo prekročený.**

**Kto o čom rozhodol.** Vlastník zvolil funkciu a jej rozsah a dňa
2026-09-27 prijal odporúčané obchodné pravidlá CL-D1…CL-D12 nižšie
v ich súčasnej podobe; nenapísal ich. Analýza vznikla s agentom AI
(Claude) podľa týchto pravidiel a stavu kódu pred funkciou.

**Špecifikácia pred kódom.** Oddiely 1–4 a 6 spolu so zodpovedajúcimi
časťami [architektonických poznámok](../../spec/architecture.md) a
[analytických modelov](../../docs/analysis/README.md) tvoria špecifikáciu,
ktorú musí implementácia splniť. Analýza a architektúra boli commitnuté
2026-09-27; modely boli vtedy ešte neúplné. Dokončené modely a toto
upresnenie sú spolu zmrazené v samostatnom špecifikačnom commite
2026-09-28 pred produkčným kódom limitov kategórií. Neskoršie zmeny
vyžadujú datovaný záznam v [§7](#7-change-notes) s dôvodom. §5 teraz
zaznamenáva skutočný lokálny implementačný beh z 2026-09-28.
Implementácia je už verejná; pozri
[datovaný záznam publikovania a CI presného buildu](../../docs/analysis/README.md#dated-publication-evidence--2026-09-29).
UAT vlastníka zostáva nepodpísané; pôvodné zmrazenie špecifikácie pred
implementáciou je zachované v `4d08651`.

<a id="1-business-goal-scope-and-assumptions"></a>

## 1. Obchodný cieľ, rozsah a predpoklady

**Cieľ.** Mesačný limit odpovedá na otázku *je tento mesiac priveľa*.
Nevie povedať *kde*: 800 € oproti limitu 800 € môže byť bežný mesiac
alebo mesiac, keď reštaurácie stáli dvakrát viac, než bolo plánované.
Limit kategórie hodnotí míňanie tam, kde vzniká rozhodnutie.

**V rozsahu**

- Jeden voliteľný limit na kategóriu v eurocentoch pre kalendárny mesiac;
  jedna aktuálna hodnota.
- Štyri stavy mesačného limitu pre každú kategóriu: nenastavený · pod
  limitom · dosiahnutý · prekročený.
- Nastavenie, zmena a zrušenie limitu kategórie cez API a z mesačného rozpisu.
- Čítanie stavu každej kategórie cez `GET /api/summary` a v rozpise
  na obrazovke *This month*.
- Zaplatené splátky pravidelných platieb sa započítavajú do kategórie.

**Mimo rozsahu** (aby funkcia zostala jednou funkciou)

- História limitov alebo iný limit pre každý mesiac.
- Notifikácie, upozornenia či blokovanie pred uložením.
- Úprava názvov a ikon kategórií; mazanie kategórií.
- Limity na pravidelný plán či pôžičku; limit na Nezaradené.
- Kontrola alebo varovanie o súčte limitov kategórií navzájom či
  voči celkovému limitu.
- Predpovede: plánovaná splátka sa počíta až po zaplatení.

**Predpoklady** — prijaté obchodné pravidlá; každé mohlo byť aj inak

| # | Pravidlo | Prečo a za akú cenu |
|---|---|---|
| CL-D1 | Limity kategórií sú **nezávislé** od celkového mesačného limitu. Súčet sa nekontroluje ani nekomentuje. | Celkový limit sa pýta „koľko spolu“, limit kategórie „koľko tu“. Ľudia plánujú niektoré kategórie a iné nechávajú otvorené, takže pravidlo súčtu by odmietlo bežné rozpočty a zviazalo dve nastavenia. Cena: aplikácia nikdy nespomenie, že limity kategórií 300 € + 300 € ležia pod celkovým limitom 400 €; obe kategórie môžu hlásiť *within*, hoci mesiac je nad limitom. |
| CL-D2 | **Signál, nie kontrola.** Uloženie výdavku vždy uspeje, aj keď kategóriu posunie nad jej limit. | Rovnako ako A1 mesačného limitu: peniaze už odišli a odmietnutie záznamu by spôsobilo, že aplikácia klame. Cena: limit kategórie informuje, nevynucuje. |
| CL-D3 | **Nezaradené** nepodlieha limitu kategórie a nemožno mu ho nastaviť. Jeho výdavky sa stále počítajú do mesačného súčtu a celkového limitu. | Nezaradené je absencia rozhodnutia, nie rozpočtová položka: jeho posudzovanie by vytvorilo rozpočet, ktorý nikto neurčil, a limit by odmeňoval nepriradené výdavky. Nemá ID kategórie, teda ani miesto na uloženie limitu. Cena: výdavky bez kategórie unikajú všetkým limitom kategórií; riadok ukazuje sumu bez stavu. |
| CL-D4 | **Zaplatené** plánované platby s kategóriou sa do nej započítajú rovnako ako do mesačného súčtu; **nezaplatené** budúce splátky nie. | Zaplatenie splátky zapíše obyčajný výdavok s kategóriou plánu a dátumom úhrady — záznam, ktorý už mesačný súčet počíta. Započítanie plánovaných splátok by hodnotilo peniaze, ktoré ešte neodišli, a spôsobilo nesúlad kategórie s mesiacom. Cena: kategória môže na začiatku mesiaca hlásiť *within*, hoci známe predplatné ju neskôr prekročí; predpoveď neexistuje. |
| CL-D5 | Jedna **aktuálna** hodnota na kategóriu, nie hodnota na mesiac. | Ako A2: aplikácia pre jedného používateľa a história podľa mesiacov je väčšia funkcia s vlastnými obrazovkami. Cena: zmena limitu znovu vyhodnotí každý vyžiadaný mesiac vrátane minulých. |
| CL-D6 | `null` znamená bez limitu; `0` je skutočný nulový limit; vynechanie poľa ponechá limit nezmenený. | Ako A3: nula je zmysluplný rozpočet („žiadne reštaurácie tento mesiac“). Cena: zrušenie vyžaduje výslovné `null`. Limit je jediné pole, ktoré aktualizácia kategórie prijíma, takže telo bez neho žiada nulovú zmenu — každé `PATCH` v aplikácii ju odmieta s `400` (D-029, `patchFields` v `src/validate.js`). Uložený limit sa v oboch prípadoch zachová. |
| CL-D7 | Rovnosť znamená **reached**, nie exceeded. Na obrazovke vyčerpaný rozpočet (dosiahnutý alebo prekročený) používa vlastníkom prijatý **plný červený rámček s bielym textom**; zostávajúci rozpočet **biely obrys**; bez limitu sa neukazuje nič. | Ako A4, v jazyku rámčekov prijatom vlastníkom pre celkový limit pri UAT (UAT-OBS-01): rámček odpovedá „zostáva rozpočet?“, slová odlišujú *reached* a *over*. Cena: dosiahnutý a prekročený stav majú rovnaký rámček, takže odlišujú ich len slová; v záložnej palete bez `theme.css` je karta rozpisu svetlá a biely obrys na nej nevidno (RISK-CL-13). |
| CL-D8 | Počíta sa na serveri **pri čítaní**, nikdy sa neukladá, podľa mesačného súčtu výdavkov kategórie; príjem sa ignoruje. Hodnotenie robí `limitState` v `src/settings.js`. | Ako A5 a A6: uložený stav zastará pri ďalšom výdavku a jedna funkcia pre oba limity nedovolí rozdielne spracovanie rovnosti či nuly. Cena: každé čítanie súhrnu agreguje o niečo viac — pri tejto mierke zanedbateľne. |
| CL-D9 | Limit patrí jednému účtu. ID kategórie iného účtu dostane presne rovnakú odpoveď ako chýbajúce ID: `404 NOT_FOUND`. Validácia je rovnaká ako pri mesačnom limite: celé centy od 0 po strop 1 000 000 EUR, `null` ruší, ostatné hodnoty sú `400 VALIDATION_FAILED` bez zmeny. | Ako zvyšok API (architektúra §4): `403` by potvrdil existenciu riadka a podporil enumeráciu; jeden validátor oboch limitov prijíma presne rovnaké čísla. Cena: preklep v ID a sondovanie cudzieho účtu dostanú rovnakú odpoveď — zámerne. |
| CL-D10 | Kategória **s limitom** je v mesačnom rozpise uvedená aj bez výdavkov (`€0.00 of €200.00`); kategória bez limitu aj bez výdavkov ostáva skrytá ako doteraz. | Rozpočet, ktorý sa objaví až po míňaní, je slabý plán; zmyslom nastavenia je vidieť ho od prvého dňa a skryté prázdne kategórie držia rozpis krátky. Cena: `by_category` už neznamená „kategórie s výdavkami“, takže graf donut a podiel na mesiaci musia zvládnuť nulový riadok. Kategória bez limitu aj výdavkov v tomto mesiaci nemá riadok na kliknutie: prvý limit sa nastaví až po prvom výdavku alebo cez API. |
| CL-D11 | `PATCH /api/categories/:id` prijíma `{"monthly_limit_cents": …}` — celé číslo alebo `null` — a nič iné: premenovanie a mazanie kategórií ostáva mimo rozsahu. `GET /api/categories` vracia limit. `GET /api/summary` pridáva `limit_cents`, `limit_status` a `limit_remaining_cents` do každého riadka `by_category`. Na obrazovke kliknutie na riadok kategórie v rozpise otvorí malý editor nastavenia či zrušenia limitu. | `PATCH` je sloveso aplikácie pre čiastočnú zmenu a jediné pole drží funkciu v jednom rozsahu. Editor je tam, kde sa zobrazuje stav, v paneli, ktorý už používa editor výdavkov. Cena: žiadna obrazovka nevypisuje všetky kategórie; CL-D10 pomenúva kategóriu bez riadka. |
| CL-D12 | Ukladá sa ako nullable `categories.monthly_limit_cents INTEGER CHECK (monthly_limit_cents IS NULL OR monthly_limit_cents >= 0)`, pridáva sa do existujúcich databáz prídavným migračným vzorom v `src/db.js` (ako `settings.monthly_limit_cents`) a pokrýva ho `test:db`. | Nullable znamená, že každá existujúca kategória po aktualizácii ukáže „bez limitu“; `CHECK` nepustí záporný limit ani pri obídení validátora; chránený `ALTER TABLE` je potrebný, lebo `CREATE TABLE IF NOT EXISTS` nikdy nepridá stĺpec do existujúcej tabuľky. Cena: ďalší krok pri štarte na ceste aktualizácie, ktorú spúšťa iba jej vlastný test. |


<a id="2-requirements-and-acceptance-criteria"></a>

## 2. Požiadavky a akceptačné kritériá

Všade vystupuje jedna persona — *človek, ktorý plánuje rozpočet podľa
kategórií*. `L` je limit kategórie a `T` jej mesačný súčet výdavkov,
oboje v centoch. Každé kritérium má podobu Given / When / Then
a končí aspoň jedným testom (§5).

<a id="req-cl-01--set-a-category-limit"></a>
### <a id="req-cl-01"></a>REQ-CL-01 · Nastaviť limit kategórie

*Ako človek plánujúci rozpočet podľa kategórií chcem nastaviť jednej
kategórii mesačný limit, aby som videl, či táto časť mojich výdavkov
zostáva v plánovaných medziach.*

| AC | Za predpokladu | Keď | Potom |
|---|---|---|---|
| AC-01.1 | jedna z mojich kategórií nemá limit | pošlem `PATCH /api/categories/:id` s `{"monthly_limit_cents": 20000}` | odpoveď je `200` s kategóriou a `monthly_limit_cents: 20000`; `GET /api/categories` pre ňu vracia 20000 |
| AC-01.2 | limit kategórie je 20000 | pošlem 15000 | 15000 ho nahradí: existuje jedna aktuálna hodnota (CL-D5) |
| AC-01.3 | kategória nemá limit | pošlem `0` | `0` sa uloží a vráti ako `0`, nie `null` — skutočný nulový limit (CL-D6) |

<a id="req-cl-02--clear-a-category-limit"></a>
### <a id="req-cl-02"></a>REQ-CL-02 · Zrušiť limit kategórie

*Ako človek plánujúci rozpočet podľa kategórií chcem odstrániť limit
kategórie, aby sa kategória, ktorú už neplánujem, prestala hodnotiť.*

| AC | Za predpokladu | Keď | Potom |
|---|---|---|---|
| AC-02.1 | kategória má limit aj výdavky tento mesiac | pošlem `{"monthly_limit_cents": null}` | `200` s `null`; `GET /api/categories` vracia `null`; jej riadok súhrnu má `not_set` a `null` limit i zostatok |
| AC-02.2 | kategória má limit a tento mesiac žiadne výdavky | zruším limit | kategória zmizne z `by_category`: bez limitu a výdavkov je skrytá ako predtým (CL-D10) |

<a id="req-cl-03--a-request-without-a-limit-leaves-it-alone"></a>
### <a id="req-cl-03"></a>REQ-CL-03 · Požiadavka bez limitu ho nemení

*Ako človek plánujúci rozpočet podľa kategórií chcem, aby požiadavka
bez limitu ponechala uloženú hodnotu, aby mi nič omylom nezmazalo
nastavený limit.*

| AC | Za predpokladu | Keď | Potom |
|---|---|---|---|
| AC-03.1 | limit kategórie je 20000 | pošlem `PATCH` s `{}` bez poľa | `400 VALIDATION_FAILED`, odpoveď aplikácie na prázdnu zmenu (CL-D6); limit zostáva 20000 |
| AC-03.2 | to isté | pošlem len `name` alebo `icon` | `400 VALIDATION_FAILED` s názvom neznámeho poľa — premenovanie je mimo rozsahu; nič sa nemení |
| AC-03.3 | to isté | vytvorím kategóriu alebo uložím príjem či celkový limit | limit kategórie zostáva 20000 |

<a id="req-cl-04--a-mistyped-limit-is-refused"></a>
### <a id="req-cl-04"></a>REQ-CL-04 · Nesprávne zadaný limit sa odmieta

*Ako človek plánujúci rozpočet podľa kategórií chcem odmietnutie chybne
zadaného limitu, aby sa nesprávne číslo nikdy nestalo mojím rozpočtom.*

| AC | Za predpokladu | Keď | Potom |
|---|---|---|---|
| AC-04.1 | limit kategórie je `L` | pošlem zápornú, desatinnú, reťazcovú, logickú hodnotu, pole alebo hodnotu nad stropom | `400 VALIDATION_FAILED`; limit zostáva `L` (CL-D9) |
| AC-04.2 | ľubovoľná moja kategória | pošlem presne `100000000` — 1 000 000 EUR, strop každej sumy | prijme a vráti sa presne |
| AC-04.3 | — | ID v ceste nie je kladné celé číslo (`abc`, `0`, `-1`, `1.5`, `null`) | `400 VALIDATION_FAILED`. Nezaradené nemá ID, takže žiadna požiadavka mu nemôže nastaviť limit (CL-D3) |

<a id="req-cl-05--my-limits-are-mine-alone"></a>
### <a id="req-cl-05"></a>REQ-CL-05 · Moje limity patria len mne

*Ako človek plánujúci rozpočet podľa kategórií chcem, aby limity
mojich kategórií patrili iba môjmu účtu, takže ich iný účet
nemôže čítať ani meniť.*

| AC | Za predpokladu | Keď | Potom |
|---|---|---|---|
| AC-05.1 | kategória `C` účtu A má limit `L` | účet B pošle `PATCH /api/categories/C` s platným telom | `404 NOT_FOUND` s rovnakou správou ako pri neexistujúcom ID; limit A zostáva `L` (CL-D9) |
| AC-05.2 | to isté | B číta `GET /api/categories` a `GET /api/summary` | B vidí iba vlastné kategórie a limity |
| AC-05.3 | bez tokenu | klient pošle `PATCH /api/categories/:id` | `401` a nič sa nemení |

<a id="req-cl-06--the-summary-judges-every-category-row"></a>
### <a id="req-cl-06"></a>REQ-CL-06 · Súhrn hodnotí každý riadok kategórie

*Ako človek plánujúci rozpočet podľa kategórií chcem, aby mesačný súhrn
uvádzal limit, stav a zostatok každej kategórie, nech obrazovka
aj iný klient čítajú jediné hodnotenie.*

| AC | Za predpokladu | Keď | Potom |
|---|---|---|---|
| AC-06.1 | ľubovoľný mesiac | čítam `GET /api/summary` | každý riadok `by_category` obsahuje `limit_cents`, `limit_status` a `limit_remaining_cents` popri `category_id`, `name` a `total_cents` |
| AC-06.2 | riadok s limitom | čítam ho | `limit_status` je `within`, `reached` alebo `exceeded` a `limit_remaining_cents` je `L − T` presne na cent, po prekročení záporný |
| AC-06.3 | riadok bez limitu | čítam ho | `limit_status` je `not_set`, `limit_cents` aj `limit_remaining_cents` sú `null` |
| AC-06.4 | rozhodovacia tabuľka v §3 | spustia sa sady | každý riadok sa overí testom |
| AC-06.5 | celkový limit aj limity kategórií sú nastavené | čítam súhrn | jeho polia `limit_*` na vrchnej úrovni opisujú iba celkový limit, počítaný presne ako predtým (CL-D1) |


<a id="req-cl-07--a-limited-category-is-listed-before-anything-is-spent"></a>
### <a id="req-cl-07"></a>REQ-CL-07 · Kategória s limitom sa zobrazuje ešte pred míňaním

*Ako človek plánujúci rozpočet podľa kategórií chcem vidieť kategóriu
s limitom v mesiaci pred prvým výdavkom, aby bol celý plán viditeľný
od prvého dňa.*

| AC | Za predpokladu | Keď | Potom |
|---|---|---|---|
| AC-07.1 | kategória `C` má limit 20000 a tento mesiac žiadny výdavok | čítam súhrn | `C` je v `by_category` s `total_cents: 0`, `limit_status: within` a `limit_remaining_cents: 20000` |
| AC-07.2 | kategória tento mesiac nemá limit ani výdavky | čítam súhrn | nie je v `by_category`, ako predtým |
| AC-07.3 | riadky s výdavkami aj bez nich | čítam súhrn | najprv sú riadky s výdavkami od najväčšieho súčtu ako predtým; po nich riadky s limitom bez výdavkov v poradí vytvorenia kategórií; súčty stále dávajú `total_cents` |

<a id="req-cl-08--only-money-that-was-spent-counts"></a>
### <a id="req-cl-08"></a>REQ-CL-08 · Počítajú sa iba minuté peniaze

*Ako človek plánujúci rozpočet podľa kategórií chcem, aby súčet kategórie
zahŕňal to, čo sa v nej skutočne zaplatilo — aj zaplatenú splátku pôžičky
či predplatného — a nič iba plánované, nech stav odráža peniaze, ktoré odišli.*

| AC | Za predpokladu | Keď | Potom |
|---|---|---|---|
| AC-08.1 | plán v kategórii `C` | tento mesiac zaplatím jednu splátku | súčet a stav `C` ju zahŕňajú rovnako ako mesačný súčet (CL-D4) |
| AC-08.2 | aktívny plán v `C` s ešte nezaplatenou splátkou | čítam súhrn | súčet `C` ani mesačný súčet ju nezahŕňa |
| AC-08.3 | nastavený mesačný príjem | čítam súhrn | príjem nikdy nevstúpi do súčtu kategórie (CL-D8) |

<a id="req-cl-09--uncategorised-is-never-judged"></a>
### <a id="req-cl-09"></a>REQ-CL-09 · Nezaradené sa nikdy nehodnotí

*Ako človek plánujúci rozpočet podľa kategórií chcem, aby výdavky
bez kategórie zostali mimo všetkých limitov kategórií a neposudzovali
sa voči rozpočtu, ktorý im nikto nenastavil.*

| AC | Za predpokladu | Keď | Potom |
|---|---|---|---|
| AC-09.1 | tento mesiac sú nezaradené výdavky a iné kategórie majú limity | čítam súhrn | riadok Nezaradené (`category_id: null`) má `not_set` a `null` limit i zostatok; jeho výdavky sa stále počítajú do `total_cents` a celkového limitu (CL-D3) |
| AC-09.2 | rozpis ukazuje riadok Nezaradené | hľadám jeho editor | nie je tam: riadok nie je ovládací prvok |

<a id="req-cl-10--a-limit-never-blocks-and-stands-on-its-own"></a>
### <a id="req-cl-10"></a>REQ-CL-10 · Limit nikdy neblokuje a funguje samostatne

*Ako človek plánujúci rozpočet podľa kategórií chcem, aby ukladanie
fungovalo bez ohľadu na limity kategórií a každý sa hodnotil osobitne,
nech aplikácia zaznamenáva realitu a nespája rozpočty.*

| AC | Za predpokladu | Keď | Potom |
|---|---|---|---|
| AC-10.1 | kategória `C` je na limite alebo nad ním | uložím ďalší výdavok do `C` | vznikne s `201` a nič nevaruje (CL-D2) |
| AC-10.2 | celkový limit 40000 | nastavím dvom kategóriám limity 30000 | oba sa prijmú s `200`, bez upozornenia na súčet (CL-D1) |
| AC-10.3 | celkový limit, príjem a limit kategórie sú nastavené | nastavím alebo zruším limit kategórie | celkový limit, príjem a mesačný súčet sa nemenia; uloženie príjmu či celkového limitu ponechá limity kategórií |

<a id="req-cl-11--the-breakdown-shows-each-limited-category-against-its-limit"></a>
### <a id="req-cl-11"></a>REQ-CL-11 · Rozpis ukazuje každú kategóriu s limitom voči jej limitu

*Ako človek plánujúci rozpočet podľa kategórií chcem, aby každá
kategória s limitom v mesačnom rozpise ukazovala, koľko z limitu som
minul a či ešte zostáva rozpočet, aby som na prvý pohľad videl
prekročené miesta.*

| AC | Za predpokladu | Keď | Potom |
|---|---|---|---|
| AC-11.1 | kategória s limitom | otvorím *This month* | jej riadok ukazuje `€T of €L`, napríklad `€0.00 of €200.00` (CL-D10) |
| AC-11.2 | `T < L` | otvorím *This month* | stavový riadok *Within limit · €… left* v bielom obrysovom rámčeku bez výplne |
| AC-11.3 | `T = L` | otvorím *This month* | *Limit reached* v plnom červenom rámčeku s bielym textom: nič nezostáva, ale limit nie je prekročený (CL-D7) |
| AC-11.4 | `T > L` | otvorím *This month* | *Over limit by €…* v plnom červenom rámčeku s bielym textom |
| AC-11.5 | kategória bez limitu | otvorím *This month* | jej riadok ukazuje sumu ako doteraz, bez stavového riadka a rámčeka |
| AC-11.6 | ľubovoľný stav | čítam riadok | slová nesú stav a rámček ho opakuje, takže farba nikdy nie je jediný signál |
| AC-11.7 | obrazovka široká 320 px, najdlhšie sumy a dlhý názov kategórie | otvorím *This month* | riadok, suma aj rámček sa zmestia: nič nie je orezané a stránka sa neposúva vodorovne |

<a id="req-cl-12--set-or-clear-a-limit-from-the-breakdown"></a>
### <a id="req-cl-12"></a>REQ-CL-12 · Nastaviť či zrušiť limit z rozpisu

*Ako človek plánujúci rozpočet podľa kategórií chcem kliknúť na
kategóriu v mesačnom rozpise a tam nastaviť či zrušiť jej limit,
aby som menil rozpočet tam, kde ho vidím.*

| AC | Za predpokladu | Keď | Potom |
|---|---|---|---|
| AC-12.1 | riadok kategórie | kliknem naň | otvorí sa editor pomenovaný podľa kategórie s jej aktuálnym limitom; bez limitu je prázdny |
| AC-12.2 | editor | zadám `60.00` a uložím | riadok ukáže `of €60.00` a nový stav bez obnovenia stránky; API vráti 6000 |
| AC-12.3 | editor kategórie s limitom | vymažem pole a uložím | limit sa odstráni: rámček zmizne a riadok opustí rozpis, ak neboli výdavky |
| AC-12.4 | editor | zadám `0` a uložím | uloží sa nulový limit, nie zrušenie |
| AC-12.5 | editor | zadám niečo, čo nie je suma, a uložím | chybová správa aplikácie; nič sa neodošle; uložený limit sa nemení |
| AC-12.6 | editor | stlačím Cancel | zavrie sa a nič sa neodošle |

<a id="req-cl-13--an-existing-database-keeps-working"></a>
### <a id="req-cl-13"></a>REQ-CL-13 · Existujúca databáza funguje ďalej

*Ako vlastník existujúcej databázy Wallet chcem, aby aktualizácia
pridala limity kategórií bez zásahu do mojich dát, takže sa nič
nehodnotí, kým limit nenastavím.*

| AC | Za predpokladu | Keď | Potom |
|---|---|---|---|
| AC-13.1 | databáza vytvorená pred funkciou s kategóriami | server sa spustí | `categories` získa `monthly_limit_cents`; každá existujúca kategória číta `null`; ID, názvy a ikony sa nemenia (CL-D12) |
| AC-13.2 | aktualizovaná databáza | server sa spustí znovu | nič sa nemení a stĺpec sa nepridá dvakrát |
| AC-13.3 | aktualizovaná databáza | záporný limit sa zapíše priamo do SQLite | `CHECK` ho odmietne: pravidlo vynucuje databáza, nie iba validátor |


<a id="3-decision-table--category-state"></a>

## 3. Rozhodovacia tabuľka — stav kategórie

Vstupy: ktorý riadok ide (kategória alebo Nezaradené), či kategória
má limit a jej mesačný súčet `T` voči limitu `L`. Hodnotenie je
`limitState(L, T)` — tá istá funkcia ako pri celkovom limite (CL-D8) —
takže výsledky sa nemôžu líšiť pri rovnosti či nule. Uvedené sú všetky
kombinácie vrátane riadkov, ktoré sa vôbec nezobrazujú.

<a id="31-the-state-of-one-row"></a>

### 3.1 Stav jedného riadka

| Pravidlo | Riadok | Limit `L` | Mesačný súčet `T` | V `by_category`? | `limit_status` | `limit_remaining_cents` | Riadok rozpisu |
|---|---|---|---|---|---|---|---|
| CR1 | Nezaradené | nemôže mať | `T > 0` | áno | `not_set` | `null` | len suma; bez rámčeka; nedá sa kliknúť |
| CR2 | Nezaradené | nemôže mať | `T = 0` | nie | — | — | — |
| CR3 | kategória | žiadny (`null`) | `T = 0` | nie, ako doteraz | — | — | — |
| CR4 | kategória | žiadny (`null`) | `T > 0` | áno | `not_set` | `null` | len suma; bez rámčeka |
| CR5 | kategória | `L > 0` | `T = 0` | **áno** (CL-D10) | `within` | `L` | `€0.00 of €L` · *Within limit · €L left* · biely obrys |
| CR6 | kategória | `L > 0` | `0 < T < L` | áno | `within` | `L − T` (> 0) | *Within limit · €… left* · biely obrys |
| CR7 | kategória | `L > 0` | `T = L` | áno | `reached` | `0` | *Limit reached* · červený rámček |
| CR8 | kategória | `L > 0` | `T > L` | áno | `exceeded` | `L − T` (< 0) | *Over limit by €…* · červený rámček |
| CR9 | kategória | `L = 0` | `T = 0` | **áno** (CL-D10) | `reached` | `0` | `€0.00 of €0.00` · *Limit reached* · červený rámček |
| CR10 | kategória | `L = 0` | `T > 0` | áno | `exceeded` | `−T` | *Over limit by €…* · červený rámček |

<a id="32-what-makes-up-t"></a>

### 3.2 Čo tvorí `T`

| Pravidlo | Peniaze v kategórii | Počítajú sa do `T`? | Prečo |
|---|---|---|---|
| CR11 | výdavok datovaný v danom mesiaci | áno | počíta ho mesačný súčet |
| CR12 | **zaplatená** splátka plánu v kategórii, uhradená tento mesiac | áno | úhrada zapíše výdavok s kategóriou plánu a dátumom úhrady; mesačný súčet ho počíta rovnako (CL-D4) |
| CR13 | **nezaplatená** splátka, splatná či ešte budúca | nie | ešte nie je výdavkom a ani mesačný súčet ju nepočíta |
| CR14 | výdavok v kategórii datovaný iným mesiacom | nie | každý mesiac sa hodnotí podľa vlastných výdavkov voči tomu istému aktuálnemu limitu (CL-D5) |
| CR15 | mesačný príjem | nikdy | limit hodnotí míňanie, nie zostatok príjmu (CL-D8) |
| CR16 | výdavok úpravou presunutý do inej kategórie | v kategórii, kde je teraz | rozhoduje kategória záznamu, ako v existujúcom rozpise |

Tri dôsledky, ktoré kontrolujúci overí najskôr: `T = L` je **reached,
nikdy exceeded** (CR7, CR9); nulový limit je skutočný limit, takže
CR9 a CR10 existujú namiesto zlúčenia s CR3 a CR4; a limit zviditeľní
kategóriu pred prvým výdavkom (CR5, CR9), zatiaľ čo kategória bez
limitu aj výdavkov zostáva skrytá (CR3).

<a id="4-boundary-values-state-transitions-negative-cases-and-risks"></a>

## 4. Hraničné hodnoty, prechody stavov, negatívne prípady a riziká

**Hranice** (centy; strop je 100 000 000 = 1 000 000 EUR, rovnako
ako pri sumách, príjme a mesačnom limite)

| Testovaná hodnota | Očakávané |
|---|---|
| `T = L − 1`, `L`, `L + 1` | `within`, `reached`, `exceeded` |
| `L = 0`, `T = 0` | `reached` a riadok je uvedený (CR9) |
| `L = 1`, `T = 0` / `1` / `2` | `within` / `reached` / `exceeded` |
| `L = 100000000` | prijaté, uložené presne |
| `L = 100000001` | `400`, nič sa neuloží |
| `L = −1`, `12.5`, `"12000"`, `true`, `[]` | `400`, nič sa neuloží |
| `L = null` | limit zrušený, `not_set` |
| `{}` — vynechané pole | `400`, prázdna zmena; limit bez zmeny |
| `{"name": …}` alebo `{"icon": …}` | `400`, neznáme pole; nič sa nemení |
| ID v ceste `abc`, `0`, `-1`, `1.5`, `null` | `400` |
| neexistujúce ID v ceste alebo ID iného účtu | `404`, rovnaká odpoveď |

**Prechody stavov.** Ako pri celkovom limite je stav odvodený z `L`
a `T`, takže neexistuje uložený stav, ktorý by sa mohol rozísť.

```
                      set L > 0, T < L         T reaches L          T passes L
  hidden or not_set ─────────────────►  within  ──────────►  reached  ──────────►  exceeded
  (no limit)        ◄─────────────────  (T < L) ◄──────────  (T = L)  ◄──────────  (T > L)
                      clear (null)         delete or edit an expense, or raise L
```

- Zrušenie limitu v ľubovoľnom limitovanom stave dá `not_set`, ak
  sa tento mesiac míňalo; bez výdavkov sa riadok skryje.
- Nastavenie `L = 0` dá `reached` bez výdavkov a inak `exceeded`;
  zníženie `L` na `T` alebo pod neho dá `reached` alebo `exceeded`.
- Úhrada splátky zvýši `T` ako každý výdavok; nezaplatená nič nemení.
- Nový mesiac začína pre každú kategóriu s `T = 0`: `within` pri
  `L > 0`, `reached` pri `L = 0`, bez limitu je skrytá.
- Nezaradené nemá prechody: kedykoľvek sa zobrazuje, je `not_set`.


**Negatívne prípady a zneužitie**

| Prípad | Očakávané |
|---|---|
| Bez tokenu pri `PATCH /api/categories/:id` | `401`, nič sa nemení |
| ID kategórie iného účtu | `404 NOT_FOUND`, odpoveď ako pri chýbajúcom ID; limit vlastníka bez zmeny |
| Nezaradené oslovené ako `null` alebo `none` | `400`: neexistuje kategória, ktorej by sa dal limit nastaviť |
| Telo premenúva, mení ikonu alebo nastavuje `id` či `user_id` | `400`: premenovanie je mimo rozsahu a polia vlastnené serverom klient nikdy nenastavuje |
| Chybný JSON | `400 VALIDATION_FAILED`, nikdy `500` |
| Priveľké telo | `413`, ako na každej trase |
| Výdavok posunie kategóriu nad limit | uloží sa; mení sa iba stav (CL-D2) |
| Súčet limitov kategórií je vyšší než celkový limit | prijme sa bez upozornenia (CL-D1) |

**Riziká**

| ID | Riziko | Opatrenie |
|---|---|---|
| RISK-CL-1 | Rovnosť sa implementuje ako `>=`, takže sa *Limit reached* pre kategóriu nikdy neobjaví. | `limitState` sa používa znovu, neprepisuje sa; CR7 a CR9 sa overujú s hranicami `L − 1`, `L` a `L + 1`; negatívna kontrola považujúca rovnosť za prekročenie musí zlyhať. |
| RISK-CL-2 | Plánovaná splátka sa započíta a kategória sa hodnotí podľa peňazí, ktoré ešte neodišli. | CR12 a CR13 sa overujú zaplatenou aj nezaplatenou splátkou; negatívna kontrola započítavajúca nezaplatenú musí zlyhať. |
| RISK-CL-3 | Nezaradené sa hodnotí — join priradí limit kategórii `NULL` alebo sa na riadku ponúkne editor. | CR1 sa overuje v API aj na obrazovke; negatívna kontrola, ktorá hodnotí Nezaradené, musí zlyhať. |
| RISK-CL-4 | Kategória iného účtu sa dá upravovať — podmienka aktualizácie neobsahuje vlastníka. | AC-05.1 s druhým účtom; negatívna kontrola bez overenia vlastníctva musí zlyhať. |
| RISK-CL-5 | `null` sa prevedie na `0` alebo požiadavka bez poľa zmaže limit. | CL-D6; `null` oproti `0` a `{}` majú samostatné prípady. |
| RISK-CL-6 | Existujúca databáza sa nedá otvoriť alebo sa jej kategórie vrátia s limitmi, ktoré nikto nenastavil. | CL-D12; prípad `test:db` vytvorí starú tabuľku a aktualizuje ju (REQ-CL-13). |
| RISK-CL-7 | Kód predpokladajúci peniaze v každom riadku rozpisu zlyhá na nulovom riadku: podiel delený nulovým mesačným súčtom, prázdny oblúk donutu, skrytý rozpis mesiaca bez výdavkov. | Donut kreslí len riadky s výdavkami; nulový riadok má prázdny stĺpec; end-to-end prípady pre riadok s nulovými výdavkami aj celý mesiac bez výdavkov. |
| RISK-CL-8 | Server a prehliadač hodnotia samostatne a rozídu sa. | Server vracia stav a prehliadač ho vykresľuje (ako RISK-ML-3). |
| RISK-CL-9 | Stav nesie iba farba. | Slová v každom stave; rámček ich opakuje (AC-11.6). |
| RISK-CL-10 | Riadok, suma a rámček sa nezmestia na malý telefón. | AC-11.7: prípad pri 320 px s najdlhšími sumami a dlhým názvom. |
| RISK-CL-11 | Celkový limit a limity kategórií sa zviažu: kontrola súčtu alebo zmena jedného mení druhý. | CL-D1; AC-06.5, AC-10.2 a AC-10.3 majú vlastné prípady. |
| RISK-CL-12 | Kontraktové testy odmietnu nové polia: schémy kolekcie zakazujú neznáme vlastnosti. | Zámerne: schéma `category` a schéma riadka `by_category` dostanú polia v tej istej zmene, takže neplánované pole stále zlyhá. |
| RISK-CL-13 | V záložnej palete — `style.css` bez `theme.css` — je karta rozpisu svetlá a biely obrys na nej nevidno. | Prijaté: aplikácia vždy načítava `theme.css`, kde je karta tmavá; slová nesú stav v oboch paletách. Kontrast sa overuje v produktovej palete. |


<a id="5-traceability"></a>

## 5. Sledovateľnosť

Požiadavka → testovacia podmienka → ID prípadu → automatizovaný test →
výsledok. Nižšie sú výsledky lokálnej automatizácie z 2026-09-28,
nie UAT vlastníka ani GitHub CI. Zdroje: [priečinok API 13](../../../../qa/api/wallet.postman_collection.json),
[Playwright](../../../../qa/e2e/category-limits.spec.js), [Selenium](../../../../qa/selenium/test_limit.py),
[migračné testy](../../../../qa/db/migration.test.js).
[Skutočný report](test-report-category-limits.md) zaznamenáva počty,
negatívne kontroly, obnovu bajtov, preskočené prípady a obmedzenia.

| Požiadavka | Testovacia podmienka | Vrstva | Prípad | Výsledok |
|---|---|---|---|---|
| REQ-CL-01 | Číslo sa uloží a vráti; druhé ho nahradí | API | TC-API-115/116 | PASS |
| REQ-CL-01, REQ-CL-02 | `0` je skutočný limit a `null` ho ruší | API | TC-API-117/118/139 | PASS |
| REQ-CL-03 | `{}` a neznáme pole nič nezmenia | API | TC-API-119 | PASS |
| REQ-CL-04 | Záporná, desatinná, reťazcová, logická hodnota, pole a strop + 1 sa odmietnu | API | TC-API-120 | PASS |
| REQ-CL-04 | Presne strop sa prijme | API | TC-API-121 | PASS |
| REQ-CL-04 | ID v ceste nie je kladné celé číslo | API | TC-API-122 | PASS |
| REQ-CL-04 | Chybný/neobjektový JSON a priveľké telo; bez zmeny | API | TC-API-140/141 | PASS |
| REQ-CL-05 | Kategória iného účtu vracia `404` a zostáva nezmenená | API | TC-API-124 | PASS |
| REQ-CL-05 | Čítanie kategórií a súhrnu je izolované | API | TC-API-125 | PASS |
| REQ-CL-05 | Bez tokenu → `401` | API | TC-API-123 | PASS |
| REQ-CL-06, REQ-CL-07 | CR2–CR6: skryté prázdne riadky, bez limitu, pod limitom s výdavkami/bez nich | API | TC-API-114/116/118/127/131 | PASS |
| REQ-CL-06 | CR7: presne na limite | API | TC-API-128 | PASS |
| REQ-CL-06 | CR8: nad limitom, záporný zostatok | API | TC-API-129 | PASS |
| REQ-CL-06 | CR9–CR10: nulový limit | API | TC-API-117/130 | PASS |
| REQ-CL-06 | Hranica: `L = 1` pri `T = 0`, `1` a `2` | API | TC-API-126 | PASS |
| REQ-CL-07 | Poradie a súčet s nulovými riadkami | API | TC-API-131 | PASS |
| REQ-CL-08 | CR12: zaplatená splátka sa počíta | API | TC-API-133 | PASS |
| REQ-CL-08 | CR13: nezaplatená splátka sa nepočíta | API | TC-API-132 | PASS |
| REQ-CL-09 | CR1: Nezaradené sa nikdy nehodnotí | API | TC-API-134 | PASS |
| REQ-CL-10 | Výdavok nad limitom kategórie sa vytvorí | API | TC-API-136 | PASS |
| REQ-CL-03, REQ-CL-06, REQ-CL-10 | Limity kategórií nad celkovým sa prijmú; nezávislé zápisy a CR15 príjem | API | TC-API-135 | PASS |
| REQ-CL-06 | CR16: presun/zmazanie výdavku prepočíta správnu kategóriu | API | TC-API-137 | PASS |
| REQ-CL-06 | CL-D5 / CR14: historický mesiac používa aktuálny limit, aktuálny vynechá starý výdavok | API | TC-API-138 | PASS |
| REQ-CL-11 | Pod limitom, dosiahnutý a prekročený stav na obrazovke; bez rámčeka bez limitu | E2E | TC-E2E-087 | PASS ×2 |
| REQ-CL-11 | Kategória s limitom bez výdavkov je uvedená | E2E | TC-E2E-088 | PASS ×2 |
| REQ-CL-11 | Riadok sa zmestí na obrazovku 320 px | E2E | TC-E2E-091 | PASS ×2 |
| REQ-CL-12 | Nastavenie, predvyplnenie a zrušenie cez editor; nesúvisiace hodnoty bez zmeny | E2E | TC-E2E-086 | PASS ×2 |
| REQ-CL-12 | Nula, neplatná hodnota a Cancel | E2E | TC-E2E-088/089 | PASS ×2 |
| REQ-CL-12 | Focus klávesnice a simulované odmietnuté uloženie | E2E | TC-E2E-092/093 | PASS ×2 |
| REQ-CL-09 | Riadok Nezaradené nemá editor | E2E | TC-E2E-090 | PASS ×2 |
| REQ-CL-11, REQ-CL-12 | Nastaviť limit a vidieť stav v druhom prehliadačovom stacku | Selenium | TC-SEL-009 | PASS |
| REQ-CL-13 | Staré riadky `NULL`; opakovaný štart zachová nulu; `CHECK` platí po vytvorení aj aktualizácii | DB | TC-DB-004…006 | PASS |


<a id="6-change-impact-analysis"></a>

## 6. Analýza dopadu zmien

| Oblasť | Zmena | Riziko pre existujúce správanie |
|---|---|---|
| Databáza | `categories.monthly_limit_cents`, nullable s `CHECK`, v `src/schema.sql` pre novú databázu a cez chránený `ALTER TABLE` v `src/db.js` pre existujúcu | Prídavné; každá existujúca kategória číta `null`, bez limitu. Aktualizácia potrebuje vlastný test, lebo ostatné sady začínajú s prázdnym súborom |
| `GET /api/categories` | každá kategória získa `monthly_limit_cents` | Prídavné; používatelia čítajú `id` a `name` (dlaždice Add, editory, AI kontrola, testovacie pomocné funkcie); schéma `category` v kolekcii sa zámerne aktualizuje |
| `POST /api/categories` | odpoveď získa `monthly_limit_cents: null`; požiadavka sa nemení a nová kategória nikdy nemá limit | Prídavné; prípady vytvorenia zachovajú asercie |
| `PATCH /api/categories/:id` | nové: iba `monthly_limit_cents`; `400`, `404` a `401` ako inde | Nová trasa, preto brána C6 potrebuje požiadavku; žiadny nový stavový kód, takže množina C8 sa nemení |
| `GET /api/summary` | riadky `by_category` získajú `limit_cents`, `limit_status` a `limit_remaining_cents`; kategórie s limitom sa uvedú aj pri `total_cents: 0` | Polia na vrchnej úrovni, celkový limit a „časti dávajú celok“ zostanú rovnaké; prázdny mesiac druhého účtu stále nemá riadky, lebo nemá limity; schéma riadka sa zámerne aktualizuje |
| Server | `src/routes/categories.js` dostane trasu; `src/routes/summary.js` číta limit každej kategórie a volá `limitState` pre každý riadok; existujúce validátory `id`, `patchFields` a `limitCents` sa používajú znovu | Jedna funkcia hodnotí oba limity |
| Obrazovka *This month* | riadok kategórie otvorí editor limitu — panel ako editor výdavku; riadok s limitom ukáže `€T of €L` a stavový rámček; nulové riadky sa vykreslia; donut vynechá riadky bez výdavkov | Hlavička, celkový limit, príjem, zoznam výdavkov a stránkovanie sú nedotknuté; riadok bez limitu vyzerá ako predtým |
| Testovacie ID | `category-limit-edit-{id}` na ovládaní riadka a `category-limit-status-{id}` na jeho stavovom rámčeku; `category-limit-title`, `category-limit-input`, `category-limit-save` a `category-limit-cancel` v editore. Zámerne **nemajú** prefix `category-bar-`, lebo page object počíta riadky cez `/^category-bar-/` | Brána C7: každé je oslovené v `qa/e2e/pages/month.page.js`. Pevný zoznam C3 je pôvodný a nemení sa |
| Testy | nový priečinok Postman 13; nový prípad `test:db`; nové end-to-end prípady; jedna kontrola Selenium; dve schémy kolekcie; nové riadky katalógu | Existujúce prípady sa nemenia a musia zostať zelené |
| Dokumenty | `spec/architecture.md` §§3–5 so zaznamenaným hashom (brána C1); analytické modely — proces BPMN, diagram prípadov použitia a ERD — a ich index | C1 zlyhá, kým sa hash neobnoví v tej istej zmene: brána robí svoju prácu |
| Nedotknuté | pravidlá celkového limitu, vlastné pravidlá plánov, zadávanie výdavkov AI, autentifikácia, obmedzenie frekvencie, vrstvy záťaže a súbehu | — |

<a id="7-change-notes"></a>

## 7. Poznámky k zmenám

<a id="2026-09-28--correct-the-specification-completion-claim"></a>

### 2026-09-28 — oprava tvrdenia o dokončení špecifikácie

Skoršie znenie tvrdilo, že analýza, architektúra a modely boli všetky
zmrazené 2026-09-27. V skutočnosti boli commitnuté iba analýza
a architektúra; BPMN kategórií bol nedokončený zdroj a diagram prípadov
použitia ani ERD funkciu ešte neobsahovali. Vyššie uvedené vyhlásenie
o dokončení teraz presne uvádza dva dátumy. Hotové modely odlišujú
plánované správanie limitov kategórií od implementovaného.
CL-D1…CL-D12, všetky požiadavky, akceptačné kritériá a výsledky
rozhodovacej tabuľky zostávajú nezmenené. Ide o opravu dokumentácie,
nie zmenu obchodného pravidla. Implementácia, výsledky testov
a UAT vlastníka v tom čase ešte čakali.

<a id="2026-09-28--implementation-and-evidence-status-no-rule-change"></a>

### 2026-09-28 — stav implementácie a dôkazov, bez zmeny pravidla

Etapa B2 pridala stĺpec kategórie, chránenú migráciu, PATCH, rozšírený
kontrakt čítania, editor a zobrazenie stavu zo servera. Zaznamenaná
lokálna regresia a štyri negatívne kontroly sú
[v reporte](test-report-category-limits.md). §5 je teraz vyplnený
podľa skutočných vykonaní. Aktuálne štítky/náhľady modelov uvádzajú
lokálnu implementáciu namiesto nepravdivého tvrdenia o chýbajúcom kóde;
verzie špecifikácie pred kódom ostávajú v `4d08651`. Oddiely
1–4 a 6 vrátane CL-D1…12, všetkých akceptačných kritérií a pravidiel
rozhodovacej tabuľky zostávajú nezmenené. Zmena obchodného pravidla
nebola potrebná. UAT vlastníka je nepodpísané; integrácia,
publikovanie a GitHub CI pre limity kategórií vtedy ešte čakali.

<a id="2026-09-29--publication-evidence-not-owner-acceptance"></a>

### 2026-09-29 — dôkaz publikovania, nie prijatie vlastníkom

Implementácia a kontroly OpenAPI sú verejné v builde `ed22c71`;
CI tohto presného buildu úspešne dobehlo, ako uvádza
[analytický index](../../docs/analysis/README.md#dated-publication-evidence--2026-09-29).
Čakajúce položky vo vyššie datovaných poznámkach opisujú historický
stav, nie aktuálny stav publikovania. Oddiely 1–4 a 6, zmrazené
v `4d08651`, a datované lokálne výsledky sú nezmenené. Žiadne
obchodné pravidlo sa nemenilo.
[Skript na prijatie vlastníkom](uat-category-limits.md) je stále
nepodpísaný; automatizované kontroly a tento záznam o publikovaní
nie sú UAT vlastníka.
