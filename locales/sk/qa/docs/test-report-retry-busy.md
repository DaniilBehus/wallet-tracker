[English](../../../../qa/docs/test-report-retry-busy.md) · **Slovenčina**

<a id="retry-and-busy-state-assurance--focused-local-report"></a>

# Overenie opakovania a stavu zaneprázdnenia — cielená lokálna správa

[← Späť na README](../../README.md#qa-evidence) · [Nastavenie testov](../../docs/testing.md) · [Ďalej: aktuálny stav QA →](../../docs/qa-status.md)

**2026-10-13; lokálny, necommitnutý checkout na HEAD `b270355` so zmenami.** Táto správa pokrýva iba F22. Nie je výsledkom CI pre celý kombinovaný strom, výsledkom vzdialeného nahratia artefaktov, akceptáciou vydania ani UAT vlastníka.

<a id="question-and-method"></a>

## Otázka a metóda

TC-E2E-045 pozdrží odpoveď na prvý **skutočný** `POST /api/transactions` po tom, ako ho server spracoval. Kým Save stále čaká na túto odpoveď, test kontroluje zakázané tlačidlo a odošle natívne kliknutie myšou na jeho stred. Počíta pokusy POST a nezávisle číta uložené transakcie cez autentifikované API; rozhranie Month musí tiež zobraziť jeden riadok a €12.50. Blok `finally` pozdržanú odpoveď uvoľní. TC-E2E-047 samostatne overuje, že úmyselné druhé Save **po** dokončení prvého vytvorí druhý legitímny výdavok. Ani jeden test nenahrádza transakčné API stubom ani netvrdí, že každé opakovanie na transportnej vrstve je deduplikované.

Negatívny svedok poskytuje jednému diagnostickému prehliadaču kópiu `public/app.js` v pamäti, v ktorej je obídené zakázanie tlačidla pomocou `withBusy` aj kontrola stavu zaneprázdnenia v `saveExpense`. Súbor produktu zostáva nezmenený. Ten istý TC-E2E-045 potom zlyhá na asercii `toBeDisabled`; to dokazuje, že aktuálny test zachytí túto kombinovanú regresiu. **Nedokazuje** to, že odstránenie ktorejkoľvek z dvoch redundantných ochrán samostatne spôsobí duplicitné uloženie.

<a id="observed-runs"></a>

## Pozorované spustenia

| Ohraničené spustenie | Pozorovaný výsledok |
|---|---|
| Čisté kontroly F22 pred opravou | Natívny výsledok Playwright `expected` bol odmietnutý ako neznámy; pomocný nástroj mutácie odmietol dva výskyty `button.disabled = true`. Išlo o chyby diagnostických pomocných nástrojov, nie o chyby produktu. |
| Opravené čisté kontroly F22 | 3/3 prešli; kontroly v skutočnom prehliadači boli vylúčené podľa vzoru názvu. Nejde o výsledok sady piatich testov. |
| `node --test qa/e2e-controls/retry-busy.test.js` | 5/5 prešlo. Riadený negatívny prípad vytvoril jeden výsledok `unexpected` z plánovanej asercie Save, nie z chyby pomocného nástroja alebo nastavenia. Nestabilná testovacia pomôcka vytvorila jeden výsledok `flaky`: prvý pokus zlyhal, opakovanie prešlo, stopa prvého zlyhania existuje a Playwright skončil s nenulovým kódom pri `failOnFlakyTests`. Oba servery testovacích pomôcok sa zatvorili a ich vlastné dočasné databázy boli odstránené. |
| Spravovaný `qa/e2e/double-submit.spec.js` | 6/6 prešlo: TC-E2E-045/046/047 v mobilnom a desktopovom Chromiu. Spravovaný runner zatvoril server a odstránil svoju predvolenú databázu. Nový JSON: `qa/reports/playwright-main/results-72692057-2b74-4f3b-bc91-cb1c58cdf330.json`, `expected: 6`, `unexpected: 0`, `flaky: 0`, SHA-256 `8b62899efb51c01ec3e614042c402c76f8ca56134bcc9327abf32528a40ef6bd`. |
| Existujúci `scripts/check.js` | 8/8 PASS, 0 preskočených; ide o statické kontroly, nie o vykonanie v prehliadači. |
| Existujúci `qa/verify/verify-ci.test.js` | 12/12 PASS po úzkej zmene cesty k artefaktu e2e; nevykonalo sa žiadne vzdialené spustenie workflow. |

Použité príkazy: `node --test qa/e2e-controls/retry-busy.test.js`, `node qa/e2e-runner/run.js qa/e2e/double-submit.spec.js`, `node scripts/check.js` a `node --test qa/verify/verify-ci.test.js` s lokálnym Node 22.14.0. Posledné spustenie kontrol 5/5 nasledovalo po kontrole jedinečného ID; spustenie aplikácie 6/6 nasledovalo po zmene pozdržania odpovede. Súbory JSON riadených testovacích pomôcok z posledného spustenia sú lokálne ignorované artefakty: `output/playwright/F22-z4TKhS/mutation.json` (`unexpected: 1`, SHA-256 `eadbead1e92f63dc7418ee72a35db0f0c628a9ee338bf50271a13d53737ef274`) a `output/playwright/F22-uoVHsN/flaky.json` (`flaky: 1`, SHA-256 `a7f0393b8e862671c92cffbf501693a179bd53436b894a5bc9f61133200100dc`). Priložený `trace.zip` prvého neúspešného pokusu existuje v `output/playwright/F22-uoVHsN/results/` (9,811 bajtov). Tieto súbory sú dôkazom tohto lokálneho spustenia, nie odkazmi na súbory distribuované s repozitárom.

<a id="retry-policy-and-limits"></a>

## Politika opakovania a limity

CI ponecháva jedno diagnostické opakovanie, zaznamenáva natívny výsledok a stavy jednotlivých pokusov v **jedinečnom názve súboru JSON pre každé spustenie** a uchováva stopu prvého neúspešného pokusu. Prechod iba po opakovaní je `flaky`, nie čisté CI: `failOnFlakyTests` spôsobí, že proces Playwright v CI skončí s nenulovým kódom. Glob artefaktov pri zlyhaní e2e zahŕňa jedinečný JSON spolu so správou a stopami. Chýbajúci nový JSON sa nesmie nahradiť starším lokálnym súborom; správu priraďte k jej aktuálnemu príkazu, času spustenia a stavu zdroja. Nahrávanie vo workflow je lokálne nakonfigurované, ale **tu nie je overené žiadne nové vzdialené nahratie**.

Natívny JSON `expected` zahŕňa úspešné testy aj testy úmyselne označené ako očakávane zlyhávajúce; či pokus prešiel, určuje až samostatný stav pokusu. `unexpected`, `flaky` a `skipped` zostávajú odlišné. Päťsekundové zlyhanie pripravenosti, ktoré bolo predtým pozorované inde, stále nemá dokázanú príčinu. BUG-005 zostáva otvorený, vykonateľné mapovanie F19 je neúplné a tento cielený výsledok neuzatvára brány vydania, prístupnosti ani akceptácie vlastníka.
