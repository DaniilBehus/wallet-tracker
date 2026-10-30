[English](../../../../qa/docs/test-plan.md) · **Slovenčina**

<a id="test-plan--wallet"></a>

# Testovací plán · WALLET

[← Späť na README](../../README.md#qa-evidence) · [Ďalej: návrh testov →](test-design.md)

**Verzia 1.1 · pôvodne napísané 2026-09-07; neskôr rozšírené o mesačný
limit výdavkov.** [Aktuálny stav QA/vydania](../../docs/qa-status.md)
oddeľuje tento plán od datovaných výsledkov. Aktuálne verejné poznámky
o architektúre sú v [`spec/architecture.md`](../../spec/architecture.md).
Datované výsledky behov sa zaznamenávajú osobitne v reportoch a CI.
Publikovaný snapshot aplikácie `7b1cb328` má
[6/6 CI po zlúčení](https://github.com/DaniilBehus/wallet-tracker/actions/runs/39248991256);
to nepodpisuje UAT vlastníka.

[Architektonické poznámky](../../spec/architecture.md) a analýzy
funkcií vrátane [analýzy mesačného limitu](analysis-monthly-limit.md)
určujú zdokumentované požiadavky. Testovacie podmienky sa viažu
na tieto zdroje alebo zaznamenanú chybu.

---

<a id="1-what-is-being-tested"></a>

## 1. Čo sa testuje

Webová aplikácia primárne pre telefón na sledovanie peňazí odchádzajúcich
z účtu: jednorazové výdavky, pravidelné platby a pôžičky so
zostávajúcimi splátkami. Node.js a Express nad SQLite, jednoduchý
frontend HTML/CSS/JS bez kroku zostavenia.

Vlastnosť, na ktorej stojí celá aplikácia: **peniaze sú všade
celočíselný počet centov a na zobrazovací reťazec sa menia
až v prehliadači.** Chyba zaokrúhľovania tu nie je kozmetická —
vznikne súčet, ktorý sa nedá zosúladiť.

---

<a id="2-scope"></a>

## 2. Rozsah

<a id="in-scope"></a>

### V rozsahu

| Oblasť | Pokrytie |
|---|---|
| Všetky výslovné operácie API vrátane PATCH limitov kategórií a AI — stavové kódy, telá odpovedí, chybový kontrakt | `qa/api/`, `qa/ai/`, [vrstva OpenAPI/kontraktu](../../docs/api/README.md) |
| Parametrizované triedy neplatných dát a viacstupňový stav API | `qa/python/` (D-032) |
| Vybrané zdokumentované schémy stavu/média/hlavičky a prázdne 204; výslovné pozorované a nespustené cesty | `qa/contract/` prísny Ajv bez mutácií; [matica](test-report-contract.md#observed-status-matrix) |
| Autentifikácia: registrácia, prihlásenie, päť stavov tokenu | `qa/api/`, `qa/e2e/auth.spec.js` |
| Izolácia používateľov ([REQ-CORE-04](../../spec/core-requirements.md#req-core-04)) | `qa/api/`, `qa/e2e/month.spec.js` |
| Hraničné hodnoty validácie ([REQ-CORE-06/07/11/16](../../spec/core-requirements.md)) | `qa/api/`, `qa/e2e/schedules.spec.js` |
| Skracovanie `nextDue` vrátane februára a priestupných rokov ([REQ-CORE-12](../../spec/core-requirements.md#req-core-12)) | `qa/api/`, `qa/e2e/schedules.spec.js` |
| Odpočítavanie pôžičky a 409 pri uzavretej pôžičke ([REQ-CORE-13](../../spec/core-requirements.md#req-core-13)) | `qa/api/`, `qa/e2e/upcoming.spec.js`, `qa/e2e/regressions.spec.js` |
| Štyri obrazovky a spodná navigácia ([architektúra §5](../../spec/architecture.md#5-interface-and-interaction-design)) | `qa/e2e/` |
| Formátovanie peňazí na okraji (`€12.50`) | `qa/e2e/` |
| Prístupné názvy interaktívnych prvkov (D-012) | `qa/e2e/` |
| Mesačný príjem a jeho zostatok (D-021) | `qa/api/`, `qa/e2e/income.spec.js` |
| Limity kategórií: nezávislé rozpočty, vlastníctvo, migrácia, hodnotenie na serveri a editor | [REQ-CL-01…13](analysis-category-limits.md), API / DB / Playwright / Selenium |
| Donut: jeden oblúk na kategóriu, žiadny bez výdavkov (D-022) | `qa/e2e/income.spec.js` |
| Správanie pri súbežnej záťaži a blokovaní poradia požiadaviek | `qa/load/` |
| Tajomstvá sa nikdy nedostanú do repozitára | `gitleaks` v CI |

<a id="out-of-scope-and-why"></a>

### Mimo rozsahu a prečo

| Netestované | Prečo |
|---|---|
| Výluky z [architektúry §7](../../spec/architecture.md#7-deliberate-limits) | Nie sú vytvorené: história rozpočtu po mesiacoch, varovania/blokovanie, viac mien, export CSV/PDF, offline synchronizácia, prepínanie tém, obnova hesla, Docker, notifikácie. Celkové a kategóriové limity sú v rozsahu; ich [datovaný dôkaz publikovania](../../docs/analysis/README.md#dated-publication-evidence--2026-09-29) nepodpisuje [UAT vlastníka](uat-category-limits.md). Rozhranie používa pevnú tmavú paletu bez prepínača svetlej/tmavej |
| ~~Záťaž a výkon~~ | **Teraz v rozsahu** (S07). Predtým riadok tvrdil „osobná aplikácia pre jedného používateľa nad lokálnym súborom SQLite, bez modelu súbehu na záťažový test“. Toto zdôvodnenie bolo poučne nesprávne: model súbehu hodný záťaže nebol v SQLite, ale v jedinom vlákne Node. `qa/load/` našlo BUG-004 pri prvom behu |
| Bezpečnosť nad rámec autorizácie a skenovania tajomstiev | Bez penetračného testu a skenovania CVE závislostí. Uvedené preto, aby absencia bola rozhodnutím, nie opomenutím |
| Viac prehliadačov | Iba Chromium v dvoch rozmeroch. Aplikácia nepoužíva API líšiace sa medzi enginmi a jeden naozaj spustený prehliadač je lepší než štyri želané |
| Vizuálna regresia | Bez základných snímok. Rozloženie sa overuje geometriou a prístupnými názvami |
| `better-sqlite3`, Express, bcrypt, jsonwebtoken | Kód tretích strán s vlastnými sadami |


---

<a id="3-approach"></a>

## 3. Prístup

**Aj spôsob odvodenia prípadov je zapísaný** v
[`test-design.md`](test-design.md): deväť krokov, ktoré prijmú
zmenu a vytvoria zoznam prípadov, aby dvaja ľudia dospeli
k približne rovnakej sade a medzera znamenala rozhodnutie,
nie prehliadnutie. Tri statické inventárne brány v
`scripts/check.js` porovnávajú deklarácie trás/požiadaviek
(C6), doslovné testid a adresy v page objectoch (C7),
globálne deklarácie stavov/asercí (C8). C9 validuje
identitu a dôvody výnimiek. To nie je pokrytie vykonania;
[matica pozorovaných operácií/stavov](test-report-contract.md#observed-status-matrix)
označuje nespustené bunky.

Základné vrstvy; každá odpovedá na inú otázku:

| Vrstva | Otázka | Nástroj |
|---|---|---|
| Brána samokontroly | Sú vlastné invarianty projektu neporušené? | `scripts/check.js` |
| API | Platí kontrakt? | Kolekcia Postman cez newman |
| OpenAPI a kontrakt skutočnej odpovede | Nerozchádzajú sa kód a opis? Pasuje skutočná úspešná/chybová odpoveď každej operácie do vybranej schémy bez úprav? | Swagger Parser + inventár zdroja + Ajv, `qa/contract/` |
| Scenáre API v Pythone | Platia triedy neplatných vstupov, hranice autentifikácie a dlhý stavový tok cez nezávislého klienta? | pytest + httpx |
| End-to-end | Vie to človek naozaj vykonať? | Playwright |
| Kontroly v prehliadači Selenium | Funguje osem kľúčových tokov aj cez WebDriver, ďalší bežný spôsob ovládania prehliadača? | Selenium + pytest |

Základný dátumový algoritmus sa precvičuje zvonka cez tabuľku API.
Kontraktová vrstva testuje aj vlastné kontroly skenera/validátora:
tie dokazujú, že brány odmietajú odchýlky a poškodené záznamy,
nie že v produkcii existuje chyba. Vrstva AI má osobitne
registrované jednotkové/integračné/vyhodnocovacie testy.

Testovacie údaje vytvárajú testy, nie ručné seedovanie:
každý beh API vytvorí vlastných používateľov z ID behu,
fixtúra pytest spustí skutočný proces Express s dočasným
SQLite súborom, portom a JWT tajomstvom, a browserové
špecifikácie/testy registrujú oddelené účty cez API.
[Spravovaný runner Playwright](../../docs/testing.md) používa
jeden jednorazový server/databázu a obmedzovač prihlásení
podľa IP pre celý beh, takže oddelené účty **neznamenajú**
úplne nezávislé procesy ani stav limitera. Testy nesmú
závisieť od poradia riadkov; paralelné vykonanie stále
vyžaduje izoláciu a ovládanie runnera.

---

<a id="4-entry-criteria--three-different-decisions"></a>

## 4. Vstupné kritériá — tri odlišné rozhodnutia

1. **Vývojárska/lokálna regresia sa môže začať na dirty tree.**
   Identifikujte commitnutý základ, zmenené cesty a hashe
   zdrojov; pomenujte presné príkazy, prostredie, orákulum
   a dôkazy predchádzajúcej chyby. Spustite príslušné statické
   kontroly a zdravotnú kontrolu jednorazového servera,
   keď ich vrstva vyžaduje. Zelený `main` ani vzdialené CI
   nie sú predpokladom písania testov, ktoré urobia kandidátny
   build zeleným. Statické kontroly vrátane osobitného
   [kontroléra sledovateľnosti](../../../../scripts/traceability.js)
   validujú deklarácie a odkazy, nie vykonanie či
   sémantickú správnosť.
2. **Prijatie vydania** začína až po identifikovaní kandidáta
   presným commit SHA a dokončení relevantného celého
   [plánu overenia](../../../../scripts/verification-plan.js)
   na kombinovanom strome vrátane CI na presnom SHA.
   Skontrolujte nevyriešené chyby a riziká; obmedzený lokálny
   PASS nie je schválenie vydania.
3. **UAT vlastníka** má vlastný skript a podpis vlastníka,
   napríklad [limity kategórií](uat-category-limits.md)
   a [mesačné limity](uat-monthly-limit.md). Automatizácia
   ani publikovanie nepodpisujú v jeho mene.

Predtým uzavreté chyby si ponechávajú odkazy na regresiu
v [registri chýb](../../log/BUGS.md). Datované reporty,
napríklad [kontraktový report](test-report-contract.md),
odlišujú lokálny dôkaz od vzdialeného CI a UAT.

---

<a id="5-exit-criteria--do-not-merge-the-gates"></a>

## 5. Výstupné kritériá — nezlučujte brány

1. **Vývojárska/lokálna regresia dokončená:** testy v rozsahu
   a príslušné kontroly prešli na identifikovanom zdrojovom
   strome; dôkaz „zlyhalo pred opravou/prešlo po oprave“
   pomenúva nezávislé očakávané správanie. Oprava produktu,
   fixtúry alebo testu/harnessu/orákula môže byť legitímna,
   keď je orákulum nezávisle zdôvodnené a asercie sa
   neoslabujú, aby skryli chybu. Výslovne zaznamenajte
   zlyhané, preskočené a nespustené kontroly. Obmedzená
   lokálna oprava sa môže dokončiť, hoci vydanie zostáva
   **NOT READY**.
2. **Prijatie vydania:** spustite relevantné úplné overenie
   kombinovaného stromu a prejdite reporty vrátane Newman,
   Pythonu, oboch browserových vrstiev, kontraktu/OpenAPI,
   statických kontrol a skenu tajomstiev podľa
   [spoločného plánu](../../../../scripts/verification-plan.js).
   Vyžaduje sa zelené CI na presnom SHA, pravdivá matica
   pozorovaných/nespustených stavov a preskúmané rozhodnutie
   o chybách/rizikách. k6 je samostatné a historické,
   kým sa skutočne nespustí znovu; jeho staré prahy
   neopisujte ako nový výsledok vydania. Nevyriešená chyba
   Critical/High v stave `OPEN` **alebo** `IN PROGRESS`
   blokuje vydanie, pokiaľ **vlastník výslovne** neudelí
   a nezaznamená obmedzenú výnimku; lokálna či necommitnutá
   oprava nie je automatickým uvoľnením vydania.
   [BUG-021](../../log/BUGS.md#current-dispositions--2026-10-19)
   je teraz CLOSED: publikovaná regresia úpravy plánu
   a pomenovaný UAT PASS vlastníka z 2026-10-19 spĺňajú
   jeho konkrétne kritériá. Nie je to všeobecné odpustenie
   rizík. [BUG-005](../../log/BUGS.md) zostáva Low/OPEN
   s neznámou príčinou; neoznačujte ho ako flaky či opravený.
3. **UAT vlastníka dokončené:** vlastník vykoná a podpíše
   príslušné skripty. Vlastník nahlásil
   [13/13 krokov limitov kategórií plus úpravu plánu,
   focus a obnovenie mesiaca PASS](uat-current-build.md#owner-record--reported-2026-10-19)
   a prijal tento testovací build so syntetickými dátami.
   Voliteľná odpoveď neistého Save/Pay zostáva **NOT RUN**.
   Toto obmedzené rozhodnutie nie je certifikátom živého
   poskytovateľa, záťaže ani všeobecného vydania;
   automatizácia ho nemôže dodať.

Reprodukciu, opravu a regresný dôkaz každej chyby držte
v [registri](../../log/BUGS.md) vrátane pravidla alebo
výslovného jednorazového dôvodu pri uzavretí.
[Register prípadov](test-cases.md#totals) je datovaný
historický snapshot a [aktuálny stav QA](../../docs/qa-status.md)
pomenúva nevyriešené položky; ani jedno nie je živým
počtom vykonania.


---

<a id="6-risks"></a>

## 6. Riziká

| Riziko | Prečo tu záleží | Čo sa robí |
|---|---|---|
| **Asercia dátumu závislá od „dnes“** | Dnes prejde, budúci mesiac zlyhá a vyzerá ako chyba kódu | Pravidlo **R1**. Každý test očakávajúci konkrétny dátum ukotví vstup na dátum v budúcnosti. Kolekcia API aj end-to-end špecifikácie vypočítajú „budúci február“ namiesto pevného roka |
| **Peniaze overované ako formátovaný reťazec** | Doslovná asercia robí každý test závislým od presných znakov vrátane neviditeľných | Pomocná funkcia zostaví očakávanú hodnotu z centov a voľnejšie porovná medzery, v dvoch formách — ukotvenej a neukotvenej (R4) |
| **Duplicitné testid** | Selektor nachádzajúci dva prvky nie je selektor | Pri opustení obrazovky aplikácia vyčistí jej riadky; kontrakt API sa overuje podľa ID |
| **Testy prechádzajúce len v určitom poradí** | Prvý človek, ktorý spustí samostatný súbor, dostane falošné zlyhanie | Každá špecifikácia vytvorí vlastného používateľa. `fullyParallel: true` je zapnuté, takže závislosť od poradia zlyhá hneď, nie neskôr |
| **Sada, ktorá nič nenájde** | Zelené testy sú dôkazom iba vtedy, ak dokážu sčervenieť | Obe brány boli zámerne vyprovokované: `check.js` na úmyselne chybných vstupoch, asercie API schémy na nesprávnej schéme a stavovom kóde |
| **CI prejde na zastaranom artefakte** | Cacheovaný build skryje zlyhanie, ktoré mal odhaliť | Každá úloha CI urobí čerstvý checkout a spustí `npm ci` |
| **Mesiac s viac než 200 výdavkami** | Obrazovka mesiaca žiadala 200 riadkov, takže zoznam sa potichu skracoval, hoci súčet bol úplný | **CLOSED S16 (D-031).** Zoznam je stránkovaný po 50 a ukazuje `Showing 50 of 213`. Pokryté pri 50, 51 a 201 v `qa/e2e/pagination.spec.js` — 201 bol riadok, ktorý sa predtým nikdy nenačítal |
| **Dva serverové procesy na jednom databázovom súbore** | Nikto predtým túto podmienku nevytvoril, preto ju žiadna vrstva nemohla pozorovať | **CLOSED S16.** `qa/race/` zakaždým spúšťa dva servery nad jedným súborom. Pri prvom behu našlo BUG-011 a BUG-012 |
| **Dvaja aktéri menia jeden riadok naraz** | Špecifikácia hovorí, kto smie riadok meniť, ale nie kto vyhrá pri súbehu | **PARTLY CLOSED S16 (D-030).** Overujú sa invarianty namiesto očakávaných hodnôt; pozri `test-design.md` §8a. Zvyšok je písané pravidlo o poradí, ktoré špecifikácia stále nemá |
| **Tajomstvo omylom commitnuté** | Po pushi do verejného repozitára je to nevratné | `gitleaks` beží v CI ako prvý a zablokuje pipeline |

---

<a id="7-environments"></a>

## 7. Prostredia

| | |
|---|---|
| Aplikácia | Podporovaný rozsah Node.js: [nastavenie testov](../../docs/testing.md) / [engines v balíku](../../../../package.json); súbor SQLite. Porty: 3000 vývoj, 3001 beh API, 3002 end-to-end, 3100 záťaž, 3005 snímky (historická poznámka o prostredí D-017, nie produktové pravidlo) |
| Vrstva API | newman cez `qa/api/run.js`, ktorý čaká na `/api/health` a vytvára expirovaný token |
| Vrstva API Python | Python 3.12+, pytest + httpx; `qa/python/conftest.py` spúšťa a kontroluje skutočný proces Node na dynamickom loopback porte s dočasným SQLite a novým tajomstvom |
| End-to-end | Playwright, Chromium, dva rozmery: Pixel 5 (primárny — aplikácia je pre telefón) a desktop |
| CI | GitHub Actions, `ubuntu-latest`: jeden spoločný [inventár overenia](../../../../scripts/verification-plan.js) pre sken tajomstiev → API (vrátane race) → Python → Playwright/Selenium; offline AI závisí od API. [Aktuálny stav](../../docs/qa-status.md) odkazuje na presný výsledok publikovaného buildu a zostávajúce brány mimo CI |
| Databáza | Jednorazový súbor pre každú úlohu CI. Nikdy databáza so skutočnými dátami |

---

<a id="8-deliverables"></a>

## 8. Výstupy

| | |
|---|---|
| `qa/api/wallet.postman_collection.json` | Kolekcia API |
| `qa/api/wallet.postman_environment.json` | Dve premenné: `baseUrl`, `token` |
| `qa/python/` | Scenáre pytest/httpx a fixtúra izolovaného servera |
| `spec/openapi.json`, `docs/api/README.md`, `qa/contract/` | Strojovo čitateľný kontrakt, navigácia/príklady a vykonateľné kontroly skutočných odpovedí |
| `qa/docs/test-report-contract.md` | Matica pozorovaných/nespustených stavov, kontroly validátora a lokálny regresný dôkaz |
| `qa/e2e/` | Špecifikácie Playwright a page objecty |
| `qa/selenium/` | Kontroly Selenium + pytest, Page Objects a hook pre dôkazy zlyhaní |
| `qa/docs/test-design.md` | Ako sa zo zmeny stáva sada prípadov |
| `qa/docs/test-cases.md` | Register prípadov s ID a výsledkami |
| `qa/docs/defects/` | Reporty chýb nájdených touto vrstvou |
| `qa/reports/api-report.html` | Lokálne HTML Newman; [CI publikovaného buildu](https://github.com/DaniilBehus/wallet-tracker/actions/runs/39248991256) osobitne uchovalo artefakt API s vlastným HTML/JUnit/race súhrnom |
| `qa/reports/python-junit.xml` | Lokálne JUnit pytest; rovnaký beh CI osobitne uchoval jeho Python JUnit artefakt |
| `playwright-report/` | HTML report Playwright a traces (artefakt CI) |
| `qa/reports/selenium/` | Snímka, zdroj stránky a konzola každého zlyhaného testu Selenium (artefakt CI pri zlyhaní) |
| `log/BUGS.md` | Celoprojektový register chýb — jediný zdroj pravdy |

---

<a id="9-how-to-run-it"></a>

## 9. Ako spustiť testy

```bash
npm install

npm run check      # invariants
npm run check:openapi # source/schema inventory gate
npm run test:contract # contract and supporting controls; inspect the report for counts
npm run test:db     # 6 migration cases
npm run test:api   # Newman collection; inspect the generated report
npm run test:python # pytest API scenarios; Python 3.12+ and qa/python/requirements.txt
npm run test:e2e   # managed Playwright in phone and desktop projects
npm run test:e2e:runner # isolated main-E2E lifecycle controls
npm run test:selenium # pytest in headless Chrome; the same requirements
npm run test:load  # k6; needs k6 installed separately
```

Nič netreba spúšťať vopred: každá vrstva spúšťa vlastný
server na vlastnom porte s jednorazovou databázou. `npm test`
spúšťa check, migráciu, Newman, pytest, Playwright a race v poradí.
Kontrakt, AI, vyhodnotenie fixtúr a Selenium používajú osobitné
príkazy z [nastavenia testov](../../docs/testing.md).
`npm test` nie je plán ekvivalentný CI; pozri
[report overenia a uchovaných dôkazov](test-report-ci-verification.md)
so spoločným runnerom a presnými lokálnymi výsledkami.
Záťažový smoke test je samostatný, lebo jeho čísla závisia od stroja.

Hlavný príkaz E2E vlastní nový jednorazový adresár SQLite pre každý
beh a pred jeho zmazaním čaká na vypnutie loopback servera.
Samostatní používatelia v jednom behu neznamenajú samostatné
databázy ani IP login bucket. Nová, výslovne dodaná cesta
`DB_PATH` sa zachová; nikdy sa znovu nepoužije ani nevyčistí
ako predvolená vlastnená cesta. Priame spustenie Playwright
zlyhá uzavretým spôsobom; použite `npm run test:e2e`.
Pozri [report izolácie](test-report-e2e-isolation.md)
pre namerané kontroly a obmedzenia. Publikovaný snapshot
aplikácie má [6/6 CI po zlúčení](https://github.com/DaniilBehus/wallet-tracker/actions/runs/39248991256);
UAT vlastníka zostáva osobitnou bránou v
[aktuálnom stave](../../docs/qa-status.md).
