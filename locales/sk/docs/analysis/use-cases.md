[English](../../../../docs/analysis/use-cases.md) · **Slovenčina**

<!-- locale-links-v1: source-relative links rebased for locales/sk -->

<a id="wallet-capabilities--modular-map"></a>
# Možnosti aplikácie Wallet — modulárna mapa

[← Späť na README](../../README.md#start-here) · [Prehľad analýzy](README.md) · [Ďalej: spracovanie výdavku →](ai-expense-process.md)

![Modulárna mapa možností, ktorá prepája prístup k účtu s výdavkami, kategóriami, pravidelnými platbami, rozpočtami, mesačným prehľadom a voliteľnými návrhmi AI](use-cases.svg)

[Otvoriť modulárnu mapu](use-cases.svg) · [Zachovaný formálny diagram prípadov použitia UML](formal/use-cases.svg)

**Limity kategórií sú implementované a publikované; je zaznamenané UAT vlastníka s obmedzeným rozsahom.**
Cieľ limitov kategórií bol zmrazený pred implementáciou v `4d08651`. Jeho elipsa teraz
zodpovedá implementovanému cieľu; [dôkazy z testov](../../qa/docs/test-report-category-limits.md)
sú oddelené od [UAT 13/13 podľa vyjadrenia vlastníka](../../qa/docs/uat-category-limits.md).

V zachovanom formálnom diagrame UML sú elipsy cieľmi používateľa, nie obrazovkami.
Plné čiary sú väzbami aktéra, nie tokom riadenia. Vzťah `include` ani `extend`
nie je potrebný: diagram napríklad netvrdí, že každý výdavok zahŕňa požiadavku
na AI. Poskytovateľ extrakcie sa zúčastňuje iba pri zapnutom voliteľnom režime;
demo používa pripravené dáta.

**Rozsah:** registrácia/prihlásenie a ciele prihlásenej osoby týkajúce sa
výdavkov, súhrnu, limitov, kategórií a pravidelných platieb. Autentifikácia je
predpokladom chránených cieľov, nie opakovane zahrnutým prípadom použitia.
Odhlásenie, filtrovanie a drobné úpravy sú zoskupené. Nie je tu bankový aktér,
vykonanie platby, automatické strhnutie, prevod ani synchronizácia zostatku účtu.
Rozpočty kategórií sú implementované a publikované; [dôkaz o publikovaní](README.md#dated-publication-evidence--2026-09-29)
je odlišný od neskoršieho [UAT vlastníka s obmedzeným rozsahom](../../qa/docs/uat-current-build.md).

<a id="source-and-coverage"></a>
## Zdroje a pokrytie

| Cieľ | Implementácia / testy |
|---|---|
| Registrácia / prihlásenie | [autentifikácia](../../../../src/auth.js) · [prehliadačové testy autentifikácie](../../../../qa/e2e/auth.spec.js) |
| Zaznamenať / upraviť / vymazať výdavok | [transakcie](../../../../src/routes/transactions.js) · [testy pridania](../../../../qa/e2e/add-expense.spec.js) · [testy úprav](../../../../qa/e2e/editing.spec.js) |
| Zobraziť mesiac; nastaviť / zrušiť aktuálny limit | [súhrn](../../../../src/routes/summary.js) · [nastavenia](../../../../src/routes/settings.js) · [REQ-ML-01–10](../../qa/docs/analysis-monthly-limit.md) · [testy mesiaca](../../../../qa/e2e/month.spec.js) |
| Vytvoriť kategórie | [kategórie](../../../../src/routes/categories.js) · [katalóg prípadov API](../../qa/docs/test-cases.md) |
| Nastaviť / zrušiť limit kategórie | [REQ-CL-01, 02, 12](../../qa/docs/analysis-category-limits.md) · [proces](category-limit-process.md) · [PATCH](../../../../src/routes/categories.js) · [prehliadačové testy](../../../../qa/e2e/category-limits.spec.js) |
| Vytvoriť / upraviť pravidelnú platbu; zaznamenať splátku | [pravidelné platby](../../../../src/routes/schedules.js) · [testy pravidelných platieb](../../../../qa/e2e/schedules.spec.js) · [testy nadchádzajúcich platieb](../../../../qa/e2e/upcoming.spec.js) |
| Vyžiadať / skontrolovať voliteľný návrh AI | [AI-R01–03](../../spec/ai-expense-entry.md#2-rules-acceptance-ids) · [služba AI](../../../../src/ai/service.js) · [prehliadačové testy AI](../../../../qa/e2e/ai) |

Predplatné je pravidelná platba s `total_count = NULL`; pôžička má konečný
počet splátok. Zaznamenanie splátky vytvorí transakciu lokálne. Neposiela
peniaze finančnej inštitúcii.
