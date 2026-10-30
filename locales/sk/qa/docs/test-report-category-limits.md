[English](../../../../qa/docs/test-report-category-limits.md) · **Slovenčina**

<a id="category-spending-limits--local-implementation-report"></a>

# Limity výdavkov kategórií — lokálna správa o implementácii

[← Späť na README](../../README.md#qa-evidence) · [Požiadavky a sledovateľnosť](analysis-category-limits.md) · [Ďalej: UAT vlastníka →](uat-category-limits.md)

Zaznamenané 2026-09-28. Špecifikácia/modely boli commitnuté **pred produkčným
kódom** v `4d0865107e72d12bd3d146fcb3ea1142b88eb245`; táto správa opisuje
následnú lokálnu implementáciu. Netvrdí sa push limitov kategórií, výsledok
GitHub CI ani akceptácia vlastníka.

<a id="what-changed"></a>

## Čo sa zmenilo

- Voliteľný limit kategórie s chránenou migráciou; existujúce riadky zostávajú NULL.
- PATCH iba limitu obmedzený vlastníctvom; GET kategórie a mesačné riadky nesú
  limity a stav vypočítaný serverom. Uloženie platného výdavku nikdy nekontroluje rozpočty.
- Editor v riadku kategórie; rozpočtové riadky s nulovým čerpaním, bielo
  orámovaný stav v limite a plné červené bloky pre dosiahnutý/prekročený limit
  so slovami. Nekategorizované položky zostávajú neinteraktívne.
- 28 ID API prípadov / 92 požiadaviek, 3 migračné prípady, 8 Playwright
  prípadov v dvoch viewportoch a jeden Selenium prípad; každý je v katalógu.

CL-D1…12 a zmrazené požiadavky, akceptačné kritériá, rozhodovacia tabuľka a
pravidlá dopadov sú nezmenené. Označenia modelov boli po kóde a cielených
kontrolách zmenené z plánovaných na lokálnu implementáciu; UAT vlastníka a
publikovanie zostávajú otvorené. Táto zmena stavu je zaznamenaná v poznámkach
k zmenám analýzy.

<a id="test-first-evidence-and-browser-findings"></a>

## Dôkazy z testovania pred implementáciou a zistenia z prehliadača

Pred pridaním migrácie kategórií TC-DB-004…006 zlyhali kvôli chýbajúcemu
stĺpcu, zatiaľ čo pôvodné tri prípady nastavení prešli. Po implementácii
prešlo všetkých šesť vrátane surových negatívnych zápisov do čerstvej aj
upgradovanej schémy.

Prvý nový prehliadačový beh odhalil nesprávne použitie pomocného nástroja
DOM vlastností na atribúty `data-*` / `aria-*`. Použitie existujúceho pomocného
nástroja atribútov opravilo skutočný DOM a názvy prístupnosti. Ďalší beh
zistil, že Tab opúšťa natívny editor do rámu prehliadača; ohraničené
cyklenie fokusu to opravilo. Potom prešlo všetkých 16 cielených vykonaní
v prehliadači. Chyby sa zobrazujú priamo v prvku, lebo toast notifikácie
stránky ležia pod natívnym modálom. Simulovaná 400 používa skutočný vnorený
kontrakt chyby a kontroluje existujúcu preloženú klientsku správu; ide o
riadené pokrytie UI, nie tvrdenie o skutočnej chybe servera.

<a id="final-regression-run"></a>

## Konečný regresný beh

Všetky príkazy bežali lokálne nad izolovanými testovacími dátami, nie nad
databázou vlastníka. Sú to lokálne výsledky, nie nové spustenie GitHub CI.
Celá sada Playwright sa zopakovala po oprave zastaranej cache kategórií v
revíznom fixture: kategória vytvorená cez API sa teraz pred snímkou znovu
načíta do prehliadača a kontroluje sa aj názov jej výdavku. Bola to oprava
fixture, nie zmena produkčného cacheovania.

| Príkaz | Výsledok |
|---|---|
| `npm run check` | PASS: 8 brán |
| `npm run test:db` | PASS: 6 testov |
| `npm run test:api` | PASS: 271 požiadaviek / 939 asercí / 0 zlyhaní |
| `npm run test:python` | PASS: 27 položiek pytest |
| `npm run test:e2e -- --workers=2` | PASS: 186 vykonaní (93 scenárov × 2 viewporty), opakované po oprave fixture |
| `npm run test:ai` | 236 úspešných / 1 preskočený / 0 neúspešných (privilégium symlinku), spolu 237 |
| `npm run eval:ai` | PASS: fixture, 116 riadkov; kvalita modelu sa nemerala |
| `npm run test:ai:e2e` | PASS: 50 vykonaní v prehliadači |
| `npm run test:race` | PASS: 120 párov na scenár; bez porušenia invariantov |
| `npm run test:selenium` | PASS: 11 položiek pytest |

Presný súhrn hodnotenia fixture:

```text
MODE=FIXTURE MODEL_QUALITY=NOT_MEASURED RESULT=PASS
SCOPE=FULL (selected 116 of 116 rows in split all, scored 116) VERDICT=NOT_APPLICABLE: fixture outputs stand in for the model; no model quality is measured
supported rows 113; row match 100.0% (113/113); complete 100.0% (46/46); amount 100.0% (60/60); date 100.0% (75/75); category 100.0% (79/79); false ready 0; invented amount/date 0; wrong amount/date 0
```

Scenár race runnera s duplicitným POST bez kľúča uložil dva riadky vo
všetkých 120 pároch. Je to jeho výslovne meraný limit, nie zlyhaný rozpočtový
invariant ani prísľub idempotencie.

<a id="negative-controls-tests-fail-when-production-is-wrong"></a>

## Negatívne kontroly: testy zlyhajú, keď je produkcia nesprávna

Každá kontrola bola samostatne aplikovaná na produkciu, spustila priečinok 13
cez `QA_FOLDER='13 · Category spending limits'` a `npm run test:api`,
skončila s kódom 1 a pred ďalšou kontrolou a celou regresiou bola obnovená
bajt za bajtom. Voliteľný selektor priečinka ponecháva predvolenú celú
kolekciu bez zmeny.

| Úmyselná chyba | Detekujúce prípady | Skutočné zlyhanie |
|---|---|---|
| Rovnosť klasifikovaná ako prekročenie | TC-API-117 / 126 / 128 | 3 zlyhané asercie, 92 požiadaviek / 289 asercí |
| Aktívna neuhradená plánovaná platba započítaná do kategórie s nulovým čerpaním | TC-API-132 | 1 zlyhaná asercia: 1000 namiesto 0 |
| Nekategorizované položky posúdené voči nule | TC-API-134 | 1 zlyhaná asercia: limit 0 namiesto NULL |
| Podmienka vlastníka odstránená z UPDATE kategórie | TC-API-124 | 4 zlyhané asercie + 1 chyba skriptu; nezávislá kontrola hodnoty vlastníka videla 1 namiesto 100000000 |

Posledná kontrola vrátila druhému vlastníkovi prázdnu 200, pretože SELECT
odpovede stále vynucoval vlastníctvo. To vysvetľuje chýbajúcu aserciu/počet
skriptov (288, nie 289); nezakrýva to samostatnú aserciu mutácie.

Obnovené hodnoty SHA-256, overené bezprostredne po každej kontrole:

| Súbor | SHA-256 |
|---|---|
| `src/settings.js` | `b348d2d4732618a7bcf3690cc5e601907190b6a261d26bf286a38c0477f0c11d` |
| `src/routes/summary.js` | `04f26f8b41b17391e0d4c17624bfaa8b82fabd46797aab7673bf175d16b54f74` |
| `src/routes/categories.js` | `8c8a8c8850f4af4da190ed605709c3bc8cf5f124ab5e4554159423f47fc3e1b5` |

<a id="visual-review-and-limits"></a>

## Vizuálna revízia a limity

Nesledovaný revízny obrázok: `output/playwright/category-limit-states-320.png`,
vytvorený pomocou TC-E2E-091 so skutočnými syntetickými výdavkami a všetkými
tromi stavovými blokmi. Asercie zmestenia používajú 320×568; revízna snímka
používa 320×1000, aby ukázala každý blok. PNG je úmyselne mimo sledovanej
dokumentácie. Asercie kontrastu merajú farby vypočítané prehliadačom: biela
na červenej musí dosiahnuť 4.5:1; slová v rámci limitu tiež 4.5:1 a biely
okraj 3:1 oproti tmavému povrchu.

Sledovaná snímka obrazovky Month bola vygenerovaná zo skutočnej aplikácie
znovu, pretože ovládacie prvky kategórií zmenili rozostupy riadkov. Zachováva
syntetické ukážkové dáta; ostatné sledované snímky sú nezmenené. Všetkých
šesť modelov sa validovalo, 152 dokumentačných odkazov sa vyriešilo a dve
vykreslenia boli bajtovo stabilné pre všetkých šesť SVG. Zmrazené sekcie
pravidiel a kontrolný súčet architektúry zostávajú nezmenené.

Kontrola pridaného textu/súkromných dát a kontrola bielych znakov v diff-e
prešli. Gitleaks nie je lokálne nainštalovaný, takže nejde o tvrdenie o
audite tajomstiev v celej histórii. Tieto kontroly nepotrebujú externú
službu, volanie providera, databázu vlastníka ani osobný účet.
Prvý limit prázdnej kategórie bez rozpočtu vyžaduje výdavok alebo API.
Neexistuje prognóza ani história mesačných rozpočtov; súčasné limity
posudzujú aj minulé query. Samotný záložný svetlý štýl nie je paletou
produktu (RISK-CL-13). [UAT vlastníka](uat-category-limits.md) je nepodpísané.
