[English](../../../../qa/docs/analysis-monthly-limit.md) · **Slovenčina**

<a id="monthly-spending-limit--requirements-and-test-analysis"></a>

# Mesačný limit výdavkov — požiadavky a analýza testov

[← Späť na README](../../README.md#qa-evidence) · [Ďalej: testovacie prípady →](test-cases.md#api--monthly-spending-limit--folder-12)

Vypracovaný príklad analýzy, ktorá prichádza *pred* kódom: cieľ, rozsah,
požiadavky s ID, rozhodovacia tabuľka, hranice, prechody stavov, riziká,
matica sledovateľnosti a poznámka o dopade zmien. Všetko nižšie vzniklo
najskôr; implementácia a testy z toho vychádzajú a každá požiadavka končí
spustiteľným testom.

Funkcia v jednej vete: **človek si nastaví jeden mesačný limit výdavkov a
obrazovka mesiaca ukáže, či je mesiac pod limitom, presne na limite alebo
nad ním.**

<a id="1-business-goal-scope-and-assumptions"></a>

## 1. Obchodný cieľ, rozsah a predpoklady

**Cieľ.** Wallet už odpovedá na otázku *koľko som tento mesiac minul*.
Neodpovedá na *je to priveľa*. Limit nastavený samotným človekom premieňa
súčet na hodnotenie, podľa ktorého môže konať ešte pred koncom mesiaca.

**V rozsahu**

- Jeden limit na osobu v eurocentoch pre kalendárny mesiac.
- Štyri stavy: nenastavený · pod limitom · dosiahnutý · prekročený.
- Čítanie stavu cez API a na obrazovke *This month*.
- Nastavenie, zmena a zrušenie limitu.

**Mimo rozsahu** (zámerne, aby funkcia zostala jednou funkciou)

- Limity podľa kategórie, pravidelného plánu či pôžičky.
- Notifikácie, e-mail, push ani iné pripomienky.
- Blokovanie alebo varovné dialógy pri výdavku prekračujúcom limit.
- História minulých limitov alebo odlišný limit pre každý mesiac.
- Predpovede typu „pri tomto tempe miniete…“ alebo rady.

**Predpoklady** (každý je rozhodnutím, ktoré mohlo dopadnúť inak)

| # | Predpoklad | Prečo a za akú cenu |
|---|---|---|
| A1 | Limit je **signál, nie kontrola**. Uloženie výdavku vždy uspeje, aj keď limit prekročí. | Peniaze už odišli z účtu; odmietnutie záznamu by spôsobilo, že aplikácia klame. Cena: limit sa nedá použiť ako tvrdý rozpočet. |
| A2 | Limit je **jedna aktuálna hodnota**, nie hodnota pre každý mesiac. | Osobná aplikácia pre jedného používateľa; história po mesiacoch je väčšia funkcia s vlastnými obrazovkami. Cena: zmena limitu znovu vyhodnotí každý zobrazený mesiac vrátane minulých. |
| A3 | **Nenastavený** a **nula** sú odlišné stavy. `null` znamená bez limitu; `0` znamená „tento mesiac sa nesmie nič minúť“. | Nula je zmysluplný rozpočet (mesiac bez míňania). Cena: API potrebuje výslovné `null`, takže „zrušiť limit“ nie je tá istá požiadavka ako „nastaviť ho na 0“. |
| A4 | **Súčet rovný limitu je `reached`, nie `exceeded`.** | Minúť presne rozpočet neznamená prekročiť ho. Táto hranica sa najľahšie pomýli, preto je vyslovená pred kódom. |
| A5 | Stav sa vypočíta **na serveri pri čítaní**, nikdy sa neukladá. | Rovnaké pravidlo ako pri mesačnom súčte a zostatku pôžičky: uložené hodnotenie zastará pri ďalšom výdavku. |
| A6 | Limit sa porovnáva s **tým istým mesačným súčtom, ktorý už obrazovka ukazuje** — iba výdavky, príjem sa ignoruje. | Limit odpovedá na „koľko míňam“, čo je iná otázka než „koľko mi zostáva z príjmu“. |

<a id="2-requirements-and-acceptance-criteria"></a>

## 2. Požiadavky a akceptačné kritériá

| ID | Požiadavka | Akceptačné kritériá |
|---|---|---|
| <a id="req-ml-01"></a>REQ-ML-01 | Človek môže nastaviť mesačný limit v celých centoch. | AC-01.1 `PUT /api/settings` s `monthly_limit_cents: 12000` uloží 12000 a vráti ho. · AC-01.2 Neskoršie `GET /api/settings` vráti tú istú hodnotu len tejto osobe. |
| <a id="req-ml-02"></a>REQ-ML-02 | Človek môže limit zrušiť. | AC-02.1 `PUT` s `monthly_limit_cents: null` ho zruší. · AC-02.2 `GET` potom vráti `null` a stav mesiaca je `not_set`. |
| <a id="req-ml-03"></a>REQ-ML-03 | Vynechané pole ponechá limit nezmenený. | AC-03.1 `PUT` iba s `monthly_income_cents` zachová uložený limit a vráti ho nezmenený. |
| <a id="req-ml-04"></a>REQ-ML-04 | Mesačný súhrn hlási limit a ním určený stav. | AC-04.1 `GET /api/summary` vracia `limit_cents`, `limit_status` a `limit_remaining_cents`. · AC-04.2 `limit_status` je jedným z `not_set`, `within`, `reached`, `exceeded`. · AC-04.3 `limit_remaining_cents` je `limit_cents − total_cents` presne na cent a po prekročení je záporný. · AC-04.4 Bez limitu sú `limit_cents` a `limit_remaining_cents` `null`. |
| <a id="req-ml-05"></a>REQ-ML-05 | Stav presne sleduje rozhodovaciu tabuľku v §3 vrátane nulových výdavkov a nulového limitu. | AC-05.1 Každý riadok rozhodovacej tabuľky overuje test. |
| <a id="req-ml-06"></a>REQ-ML-06 | Limit nikdy nemení uložené dáta ani správanie ukladania. | AC-06.1 Výdavok nad limitom sa stále vytvorí so stavom 201. · AC-06.2 Mesačný súčet, rozpis a údaje o príjme sú rovnaké s limitom aj bez neho. |
| <a id="req-ml-07"></a>REQ-ML-07 | Neplatné limity sa odmietajú bežným chybovým kontraktom aplikácie. | AC-07.1 Záporné, desatinné, reťazcové, logické a nadlimitné hodnoty vrátia 400 `VALIDATION_FAILED` a nič nezmenia. · AC-07.2 Strop je rovnaký: 1 000 000 EUR používaných pre sumy a príjmy. |
| <a id="req-ml-08"></a>REQ-ML-08 | Limit patrí jednému účtu. | AC-08.1 Iný účet pri čítaní `GET /settings` a `GET /summary` vidí vlastný limit, nikdy tento. · AC-08.2 Bez tokenu obe trasy vrátia 401. |
| <a id="req-ml-09"></a>REQ-ML-09 | Obrazovka mesiaca vyjadruje limit a stav slovami, nie len farbou. | AC-09.1 Ukazuje limit a riadok stavu *Within limit / Limit reached / Over limit*. · AC-09.2 Bez limitu ponúka jeho nastavenie a neukazuje stav. · AC-09.3 Prekročenie je označené textom aj triedou, takže farba nikdy nie je jediným nositeľom informácie. |
| <a id="req-ml-10"></a>REQ-ML-10 | Limit možno nastaviť a zrušiť z obrazovky. | AC-10.1 Zadanie čísla a uloženie zobrazí nový limit a prepočítaný stav bez obnovenia stránky. · AC-10.2 Vymazanie poľa a uloženie limit odstráni. · AC-10.3 Neplatné číslo zobrazí existujúci štýl chyby a uložený limit ponechá. |


<a id="3-decision-table--limit-state"></a>

## 3. Rozhodovacia tabuľka — stav limitu

Vstupy: či limit existuje a mesačný súčet voči nemu. `T` = mesačný súčet
v centoch, `L` = limit v centoch. Uvedené sú všetky kombinácie vrátane
nulových výdavkov a nulového limitu — to je zmysel tabuľky.

| Pravidlo | Limit nastavený? | Porovnanie | Mesačný súčet | `limit_status` | `limit_remaining_cents` | Obrazovka |
|---|---|---|---|---|---|---|
| R1 | nie | — | `T = 0` | `not_set` | `null` | „Nastaviť limit“, bez riadka stavu |
| R2 | nie | — | `T > 0` | `not_set` | `null` | „Nastaviť limit“, bez riadka stavu |
| R3 | áno, `L > 0` | `T < L` | `T = 0` | `within` | `L` | *Pod limitom · zostáva €L* |
| R4 | áno, `L > 0` | `T < L` | `0 < T < L` | `within` | `L − T` (> 0) | *Pod limitom · zostáva €…* |
| R5 | áno, `L > 0` | `T = L` | `T = L` | `reached` | `0` | *Limit dosiahnutý* |
| R6 | áno, `L > 0` | `T > L` | `T > L` | `exceeded` | `L − T` (< 0) | *Nad limitom o €…* |
| R7 | áno, `L = 0` | `T = L` | `T = 0` | `reached` | `0` | *Limit dosiahnutý* |
| R8 | áno, `L = 0` | `T > L` | `T > 0` | `exceeded` | `−T` | *Nad limitom o €…* |

Dva dôsledky, ktoré treba výslovne pomenovať, pretože ich kontrolujúci
overí ako prvé: `T = L` je **`reached`, nikdy `exceeded`** (A4)
a nulový limit je skutočný limit, preto existujú R7 a R8 namiesto
ich zlúčenia s R1.

<a id="4-boundary-values-state-transitions-negative-cases-and-risks"></a>

## 4. Hraničné hodnoty, prechody stavov, negatívne prípady a riziká

**Hranice** (centy; strop je 100 000 000 = 1 000 000 EUR)

| Testovaná hodnota | Očakávané |
|---|---|
| `L − 1`, `L`, `L + 1` ako mesačný súčet | `within`, `reached`, `exceeded` |
| `L = 0`, `T = 0` | `reached` (R7) |
| `L = 1`, `T = 0` / `T = 1` / `T = 2` | `within` / `reached` / `exceeded` |
| `L = 100000000` | prijaté, uložené presne |
| `L = 100000001` | 400, nič sa neuloží |
| `L = −1` | 400 |
| `L = 12.5` (desatinné) | 400 |
| `L = "12000"` (reťazec), `true` (logická hodnota) | 400 |
| `L = null` | limit zrušený, stav `not_set` |
| vynechané pole | limit nezmenený |

**Prechody stavov.** Stav je odvodený, preto sa zmení pri zmene ktoréhokoľvek
vstupu; neexistuje stavový automat, ktorý by sa mohol rozísť s dátami.

```
                    set limit (L>0, T<L)        add expense (T→L)      add expense (T>L)
   not_set ───────────────────────────► within ─────────────► reached ─────────────► exceeded
      ▲                                   ▲ │                    │                      │
      │ clear limit (null)                │ └─ delete / edit ◄───┘                      │
      └───────────────────────────────────┴──────── delete or edit expense ◄────────────┘
                                          lower the limit ─► reached / exceeded
                                          raise the limit ─► within
```

Aj prechod na iný mesiac znovu vyhodnotí ten istý limit voči súčtu daného
mesiaca (A2). Výdavok so zmazanou kategóriou sa stále počíta, lebo ho
mesačný súčet už zahŕňa.

**Negatívne prípady a zneužitie**

| Prípad | Očakávané |
|---|---|
| Bez tokenu pri `GET /settings`, `PUT /settings`, `GET /summary` | 401, žiadne dáta |
| Limit iného účtu | neviditeľný; každý účet číta vlastný |
| Limit nastavený počas prebiehajúcej požiadavky na iný mesiac | odpoveď označuje mesiac, ktorý opisuje; klient vykreslí požadovaný mesiac |
| Výdavok nad limitom | stále sa uloží (A1); zmení sa iba stav |
| Chybné telo JSON | 400 `VALIDATION_FAILED`, nikdy 500 |

**Riziká**

| ID | Riziko | Opatrenie |
|---|---|---|
| RISK-ML-1 | Hranica rovnosti sa implementuje ako `>=` a stav „reached“ zmizne. | A4 uvedené vopred; R5/R7 v tabuľke; hraničné testy pri `L−1`, `L`, `L+1`. |
| RISK-ML-2 | Peniaze sa spracujú ako float, teda 12000 oproti 119.999… | Celočíselné centy od začiatku do konca; brána bez floatov v `check.js` pokrýva `src/`. |
| RISK-ML-3 | Stav sa počíta dvakrát — na serveri a v prehliadači — a výsledky sa rozídu. | Server ho počíta; prehliadač len vykresľuje prijatý výsledok. |
| RISK-ML-4 | `null` (bez limitu) sa prevedie na `0`, takže „bez limitu“ sa potichu zmení na „nesmie sa míňať“. | A3; výslovné spracovanie `null` s vlastnými testami (R1/R2 oproti R7/R8). |
| RISK-ML-5 | Nové pole pokazí existujúcich používateľov settings a summary alebo databáza vytvorená pred stĺpcom sa nedá čítať. | Iba prídavné polia; existujúce prípady settings a summary ostávajú nezmenené a musia prejsť; aktualizácia staršej databázy na mieste má tri vlastné prípady (TC-DB-001…003), pretože ju nespúšťa iná vrstva. |
| RISK-ML-6 | „Nad limitom“ komunikuje iba farba (prístupnosť). | AC-09.3: najprv text, potom trieda. |


<a id="5-traceability"></a>

## 5. Sledovateľnosť

Požiadavka → testovacia podmienka → ID prípadu → automatizovaný test,
ktorý ju vykonáva. Stĺpec výsledkov sa vypĺňa zo zaznamenaného **lokálneho**
behu v [`test-report-monthly-limit.md`](test-report-monthly-limit.md);
tento report uvádza aj to, ktoré prípady prešli CI a ktoré nie.
Posledné tri riadky sledujú riziko namiesto požiadavky: RISK-ML-5 sa týka
už existujúcich databáz, ktoré žiadna požiadavka neopisuje.

| Požiadavka | Testovacia podmienka | Prípad | Automatizovaný test | Výsledok |
|---|---|---|---|---|
| REQ-ML-01 | Uložený limit sa vráti nezmenený | TC-API-091 | `qa/api/wallet.postman_collection.json` · 12 | PASS |
| REQ-ML-02 | `null` zruší limit | TC-API-092 | tamže, 12 | PASS |
| REQ-ML-03 | Vynechané pole ponechá limit | TC-API-093 | tamže, 12 | PASS |
| REQ-ML-04 | Súhrn obsahuje limit, stav a zostatok | TC-API-094 | tamže, 12 | PASS |
| REQ-ML-05 | R1–R2 bez limitu, s výdavkami aj bez nich | TC-API-095 | tamže, 12 | PASS |
| REQ-ML-05 | R3–R4 pod limitom vrátane nulových výdavkov | TC-API-096 | tamže, 12 | PASS |
| REQ-ML-05 | R5 presne na limite | TC-API-097 | tamže, 12 | PASS |
| REQ-ML-05 | R6 nad limitom so záporným zostatkom | TC-API-098 | tamže, 12 | PASS |
| REQ-ML-05 | R7–R8 nulový limit | TC-API-099 | tamže, 12 | PASS |
| REQ-ML-05 | Hranica: najmenší kladný limit (`L = 1`, `T = 0`) | TC-API-100 | tamže, 12 | PASS |
| REQ-ML-06 | Výdavok nad limitom sa stále vytvorí | TC-API-101 | tamže, 12 | PASS |
| REQ-ML-07 | Záporná, desatinná, reťazcová, logická hodnota, strop+1 | TC-API-102 | tamže, 12 | PASS |
| REQ-ML-07 | Presne strop sa prijme | TC-API-103 | tamže, 12 | PASS |
| REQ-ML-08 | Iný účet vidí vlastný limit | TC-API-104 | tamže, 12 | PASS |
| REQ-ML-08 | Bez tokenu → 401 | TC-API-105 | tamže, 12 | PASS |
| REQ-ML-09 | Obrazovka ukazuje limit a stav slovami | TC-E2E-065 | `qa/e2e/month.spec.js` | PASS |
| REQ-ML-09 | Prekročenie označuje text aj trieda | TC-E2E-066 | `qa/e2e/month.spec.js` | PASS |
| REQ-ML-10 | Nastavenie z obrazovky aktualizuje stav bez načítania | TC-E2E-067 | `qa/e2e/month.spec.js` | PASS |
| REQ-ML-10 | Zrušenie z obrazovky odstráni limit | TC-E2E-068 | `qa/e2e/month.spec.js` | PASS |
| REQ-ML-10 | Neplatné číslo sa odmietne bez zmeny uloženého limitu | TC-E2E-069 | `qa/e2e/month.spec.js` | PASS |
| RISK-ML-5 | Existujúca databáza získa stĺpec a zachová settings | TC-DB-001 | `qa/db/migration.test.js` | PASS |
| RISK-ML-5 | Opätovné spustenie aktualizovanej databázy je bezpečné | TC-DB-002 | `qa/db/migration.test.js` | PASS |
| RISK-ML-5 | Aktualizácia a nové vytvorenie končia rovnakou tabuľkou | TC-DB-003 | `qa/db/migration.test.js` | PASS |

<a id="6-change-impact-analysis"></a>

## 6. Analýza dopadu zmien

| Oblasť | Zmena | Riziko pre existujúce správanie |
|---|---|---|
| Databáza | `settings.monthly_limit_cents`, nullable, pridané pri štarte pomocou chráneného `ALTER TABLE`; existujúce riadky majú `NULL` = bez limitu | Prídavná zmena; staršia databáza sa pri ďalšom štarte aktualizuje na mieste — jediné tvrdenie, ktoré potrebovalo vlastný test, pretože ostatné vrstvy štartujú s prázdnym súborom (TC-DB-001…003) |
| API `GET /api/settings` | nové pole `monthly_limit_cents` | Prídavné; existujúce asercie čítajú `monthly_income_cents` a stále prechádzajú |
| API `PUT /api/settings` | voliteľné pole; `null` ruší, vynechanie zachová | Kontrakt príjmu je nedotknutý vrátane jeho odpovedí 400 |
| API `GET /api/summary` | nové polia `limit_cents`, `limit_status`, `limit_remaining_cents` | Prídavné; `total_cents`, `income_cents`, `remaining_cents` a `by_category` bez zmeny |
| Server | `limitState()` v `src/settings.js`; volá ho trasa súhrnu | Jediné miesto vypočítava hodnotenie |
| Obrazovka *This month* | riadok limitu, editor a stavový riadok; nové testid `limit-value`, `limit-edit`, `limit-input`, `limit-save`, `limit-cancel`, `limit-status` | Príjem, donut, stĺpce a zoznam výdavkov zostávajú nedotknuté |
| Page object | `qa/e2e/pages/month.page.js` dostáva rovnaké ID | Vyžaduje brána pokrytia: každé testid v `public/` má odkaz z page objectu |
| Testy | nový priečinok Postman 12, nové prípady v `qa/e2e/month.spec.js`, nový `qa/db/migration.test.js` pre aktualizáciu a nové riadky v `qa/docs/test-cases.md` | Existujúce prípady zostávajú nezmenené a musia prechádzať; `npm test` a úloha API CI získavajú jeden rýchly krok |
| Brány | `check.js` C3 (ID), C6 (pokryté trasy), C7 (ID v page objectoch), C8 (overené stavy) | Žiadna nová trasa ani stavový kód, takže C6 a C8 zachovávajú počty |
| Nedotknuté | zadávanie výdavkov cez AI, pravidelné plány, pôžičky, kategórie, autentifikácia, obmedzenie frekvencie, vrstvy záťaže a súbehu | — |
