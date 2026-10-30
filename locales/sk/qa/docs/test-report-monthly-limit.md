[English](../../../../qa/docs/test-report-monthly-limit.md) · **Slovenčina**

<a id="monthly-spending-limit--test-report"></a>

# Mesačný limit výdavkov — správa o testovaní

[← Späť na README](../../README.md#qa-evidence) · [Ďalej: scenár UAT →](uat-monthly-limit.md)

**Dátum:** 2026-09-23

**Testovaná zostava.** Kód aplikácie z commitu `4ad444d`
*(feat(month): monthly spending limit with within/reached/exceeded state)*.
Následný commit nesúci túto správu pridáva `qa/db/migration.test.js`, jeho
npm skript a krok CI a opravy týchto dokumentov; nemení nič v `src/` ani
`public/` a `git diff 4ad444d -- src public` je prázdny.

**CI nič z toho nespustilo.** `origin/main` je `9924aba`; ani `4ad444d`,
ani následný commit neboli pushnuté. **Každý výsledok v tejto správe pochádza
z lokálneho spustenia na jednom počítači s Windows** a nič z toho sa
nezopakovalo na runneroch CI projektu. Kde je tento rozdiel dôležitý,
opakuje sa nižšie, namiesto predpokladania.

**Verdikt:** funkcia spĺňa požiadavky v
[`analysis-monthly-limit.md`](analysis-monthly-limit.md) v rozsahu, ktorý
ukazuje lokálna sada. Počas testovania bola nájdená a opravená jedna chyba.
Akceptačný priechod bol nacvičený, ale **nebol prijatý človekom** — pozri §6.

<a id="1-scope-of-this-pass"></a>

## 1. Rozsah tohto priechodu

Požiadavky REQ-ML-01…10, osem pravidiel rozhodovacej tabuľky, zoznam
hraničných hodnôt, negatívne prípady a jedno riziko už existujúcich databáz
(RISK-ML-5). Dvadsaťtri automatizovaných prípadov: TC-API-091…105,
TC-E2E-065…069 a TC-DB-001…003.

Prostredie: Windows, Node v24.13.1 (CI pripína 22), SQLite cez
`better-sqlite3`, Playwright 1.62.1 na Chromiu v dvoch viewportoch, Newman
proti serveru, ktorý runner spustí s vlastnou jednorazovou databázou.
Nepoužili sa `.env`, AI provider ani externá služba.

<a id="2-tests-before-the-code--and-how-much-of-that-a-reader-can-check"></a>

## 2. Testy pred kódom — a čo z toho vie čitateľ overiť

Prípady API a prehliadača boli napísané podľa analytického dokumentu a
spustené pred existenciou implementácie. Vtedajší terminál ukázal:
`npm run test:api` zlyhal na **92 aserciách** v novom priečinku 12 a
existujúcich kontraktových prípadoch nastavení a súhrnu, pretože schémy
odpovedí vyžadovali `monthly_limit_cents`, `limit_cents`, `limit_status`
a `limit_remaining_cents`, ktoré ešte neexistovali; päť prehliadačových
prípadov zlyhalo **10-krát** (5 × 2 viewporty), pretože na obrazovke
chýbalo každé testovacie ID limitu.

**Tieto dve čísla sú lokálnym pozorovaním, nie dôkazom, ktorý vie zopakovať
niekto iný.** Testy a implementácia pristáli v jednom commite, takže stav
pred implementáciou nie je v histórii, nič sa nepushlo a žiadny CI beh ho
nevidel. Sú zaznamenané preto, že sa udiali, a označené preto, že ich
čitateľ nevie overiť.

Jediným dôkazom červeného testu pred opravou, ktorý **možno** na požiadanie
zopakovať, je migračný test. Zakomentujte ochranu v `src/db.js`, ktorá pridáva
stĺpec — zmeňte `if (!columns.includes('monthly_limit_cents'))` na
`if (false)` — a spustite `npm run test:db`: všetky tri prípady zlyhajú,
TC-DB-001 na „the column was not added“. Obnovte ochranu a všetky tri
prejdú. Obe smerovania sa spustili 2026-09-23 (3 neúspešné / 3 úspešné)
a ktokoľvek ich môže znovu spustiť za menej než minútu.

<a id="3-defects-found-while-testing"></a>

## 3. Chyby nájdené pri testovaní

| # | Čo | Ako sa našla | Stav |
|---|---|---|---|
| 1 | Pri šírke telefónu ležal riadok stavu limitu **vo vnútri flex riadka** s prstencovým grafom a číslami, takže sa stal tretím stĺpcom: graf prekrýval ovládanie limitu a nedalo sa naň kliknúť | TC-E2E-068 a TC-E2E-069 zlyhali iba na `mobile-chromium`, zatiaľ čo všetkých päť prípadov prešlo na desktopovom viewporte | Opravené — riadok sa presunul mimo `.overview`; oba viewporty sú zelené. Komentár v `public/index.html` zaznamenáva, prečo sa nesmie vrátiť. Priechod UAT to znovu skontroloval pri 375 px: hit test ovládania vracia ovládanie, nie graf |

Nič iné nezlyhalo z produktového dôvodu. Dva API prípady boli počas priechodu
prepísané z *testovacieho* dôvodu; zaznamenáva sa to, pretože sa tým mení,
čo sada dokazuje: hraničné pravidlá najprv bežali proti prvému účtu, ktorého
mesiac už obsahoval sumy pri strope z iných priečinkov, takže „jeden cent
pod mesačným súčtom“ bol limit nad stropom 1 000 000 EUR a správne sa
odmietol s 400. Pravidlá rozhodovacej tabuľky teraz bežia na druhom účte,
ktorého mesiac tento priečinok plní presnými sumami (2500, potom 1000).

<a id="4-results--the-local-run-of-2026-09-23"></a>

## 4. Výsledky — lokálne spustenie 2026-09-23

| Brána / vrstva | Príkaz | Výsledok |
|---|---|---|
| Vlastná kontrola | `npm run check` | **OK — 8 úspešných, 0 preskočených, 0 neúspešných** |
| Migrácia databázy | `npm run test:db` | **3 úspešné, 0 neúspešných** |
| Kontrakt API | `npm run test:api` | **171 požiadaviek, 621 asercií, 0 neúspešných** |
| Python API scenáre | `npm run test:python` | **16 úspešných** |
| End-to-end | `npm run test:e2e` | **138 úspešných** (69 prípadov × 2 viewporty) |
| Súbežnosť | `npm run test:race` | **0 porušení invariantov** |
| Celá sada | `npm test` | **návratový kód 0** |
| AI zadávanie výdavkov (touto zmenou nedotknuté) | `npm run test:ai` | **237 testov: 236 úspešných, 1 preskočený, 0 neúspešných** |
| Hodnotenie fixture (nedotknuté) | `npm run eval:ai` | **MODE=FIXTURE RESULT=PASS, 113/113 podporovaných riadkov** |

Každý riadok tejto tabuľky pochádza z tohto počítača. Workflow CI spúšťa
`check`, `test:db`, `test:api`, `test:python`, `test:e2e` a AI úlohy,
takže pokryje všetko okrem `test:race` — pre túto prácu to však ešte
neurobilo. Dovtedy vyššie uvedený stĺpec hovorí len o zisteniach jedného
počítača.

Sledovateľnosť podľa jednotlivých požiadaviek je tabuľka v §5 analytického
dokumentu; výsledok každého riadka z tohto behu je PASS.

Pokrytie rozhodovacej tabuľky podľa pravidiel: R1 TC-API-095 · R2 TC-API-095 · R3 TC-API-096 · R4 TC-API-096 · R5 TC-API-097 · R6 TC-API-098 · R7 TC-API-099 · R8 TC-API-099.

Hranice. Prípady ponechávajú mesačný súčet pevný a posúvajú limit cez neho,
čím dosahujú rovnaké tri body ako riadok „total = `L − 1` / `L` / `L + 1`“
v zozname hraníc:

| Bod | Ako ho prípad pripraví | Prípad | Očakávané |
|---|---|---|---|
| súčet jeden cent **pod** limitom | `L = 1` v prázdnom mesiaci (`T = 0`) | TC-API-100 | `within`, zostáva jeden cent |
| súčet sa **rovná** limitu | `T = 2500`, `L = 2500` | TC-API-097 | `reached`, nič nezostáva |
| súčet jeden cent **nad** limitom | `T = 2500`, `L = 2499` | TC-API-098 | `exceeded`, zostáva `−1` |

Tiež: `L = 0` s `T = 0` aj s `T > 0` ako TC-API-099, strop a strop + 1
ako TC-API-103 a TC-API-102.

<a id="5-the-one-thing-no-other-layer-covers"></a>

## 5. Jediná vec, ktorú nepokrýva žiadna iná vrstva

Každá ďalšia vrstva začína prázdnym databázovým súborom, kde `CREATE TABLE`
už obsahuje `monthly_limit_cents` a chránené `ALTER TABLE` v `src/db.js`
sa nikdy nevykoná. Človek, ktorý upgraduje existujúci Wallet, prechádza
opačnou cestou a pred týmto priechodom ju nič netestovalo.
`qa/db/migration.test.js` vytvorí databázu v tvare pred limitom s účtom
a uloženým príjmom, spustí proti nej databázovú vrstvu v podradenom procese
a kontroluje, že pribudne nullable stĺpec, príjem prežije, limit sa číta
ako `null` namiesto `0`, opätovný štart nezlyhá ani nepridá stĺpec
druhýkrát a upgradovaná databáza skončí s rovnakou tabuľkou `settings`
ako čerstvá.

<a id="6-known-limitations"></a>

## 6. Známe obmedzenia

- **UAT bolo nacvičené, nie prijaté.** Claude prešiel všetkých jedenásť
  krokov [`uat-monthly-limit.md`](uat-monthly-limit.md) dňa 2026-09-23 na
  jednorazovej databáze a zaznamenal pozorovania; každý krok sa správal
  podľa scenára. Podpis vlastníka je prázdny, nezachytila sa žiadna snímka
  obrazovky — panel prehliadača sa nikdy nevykreslil — a nič sa neposúdilo
  pohľadom vrátane farby prekročenia limitu. Ľudský priechod stále chýba.
- **Jeden limit, nie jeden na každý mesiac** (predpoklad A2). Zmena limitu
  znovu posudzuje každý mesiac na obrazovke vrátane minulých. História
  sa neuchováva.
- **Limit nič neblokuje** (A1). Je to signál; výdavok nad limitom sa stále
  uloží. Neexistuje varovný dialóg ani oznámenie.
- **Pokrytie prehliadača je emulované.** Dva viewporty Chromia, žiadne
  fyzické zariadenie ani iný engine prehliadača.
- **Žiadny vlastný záťažový ani súbežnostný prípad.** Limit je výpočet pri
  čítaní nad existujúcou mesačnou query; vrstvy k6 a race sa preň nerozšírili.
- **Žiadny Python scenár.** Strana API je pokrytá priečinkom Newman; vrstva
  pytest si ponecháva existujúcich šesť scenárov.
- **Migračný test pokrýva jeden upgrade na SQLite na jednej platforme.**
  Netestuje databázu poškodenú, zamknutú iným procesom ani vytvorenú
  verziou staršou než `9924aba`.
- **Hranice mesiacov a časové pásma** sa dedia z existujúcej mesačnej
  query testovanej inde; tento priechod pre ne nepridal nové prípady.
- **Prístupnosť** sa kontrolovala ako „text, nie iba farba“ (REQ-ML-09)
  a existujúcim pomocným nástrojom kontrastu na obrazovke mesiaca;
  priechod so screen readerom sa nevykonal.
