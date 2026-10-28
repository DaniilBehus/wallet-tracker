[English](../../../../qa/docs/ai-evaluation.md) · **Slovenčina**

<a id="ai-expense-entry--evaluation"></a>

# Zadávanie výdavkov pomocou AI — vyhodnotenie

[← Späť na README](../../README.md#ai-expense-entry) · [Ďalej: ukážka a režimy →](../../docs/ai-feature.md)

**Stav k 2026-09-15:** vyhodnotenie na fixtúrach PASS · vyhodnotenie na skutočnom modeli **NOT RUN**.

Nič na tejto stránke nemeria, ako dobre ktorýkoľvek jazykový model extrahuje výdavky.
Všetky uvedené čísla pochádzajú len z režimu fixtúr, v ktorom namiesto modelu
odpovedajú ideálne odpovede zo samotných označení korpusu.

<a id="1-dataset"></a>

## 1. Dátový súbor

`qa/ai/data/eval-cases.jsonl`, zmrazený ako verzia 1 dňa 2026-09-14 spolu s
`qa/ai/data/manifest.json` (sha256 `4b7e5bf4…3ff67`). Vyhodnocovač odmietne
spustenie, ak sa hash súboru, počty riadkov alebo ID holdout sady líšia od manifestu.

| | Riadky |
|---|---|
| Spolu | 116 |
| Podporované riadky prirodzeného jazyka (`kind: nl`) | 113 — dev 93, holdout 20 |
| podľa jazyka | en 56 · uk 28 · sk 27 · mixed 2 |
| podľa očakávaného stavu | ready 46 · needs_input 38 · unsupported 29 |
| Prieskumné (ruština; nikdy nie v menovateli) | 3 |
| Transportné fixtúry (samostatný súbor, nie NL) | 15 v `qa/ai/fixtures/transport-cases.json` |

Každý riadok má ID, skupinu, jazyk, značky, text, referenčný dátum, kontext kategórií,
`fixture_output`, očakávaný stav / sumu / povolené kategórie / dátum /
kódy problémov a zdôvodnenie. `label_provenance` je vo všetkých riadkoch
`AGENT_AUTHORED`: označenia vytvoril spolu s normalizátorom ten istý autor
a dosiaľ neprešli nezávislou revíziou.

**Poctivý opis holdout sady.** 20 holdout riadkov nikdy nebolo ukázaných
modelu — žiadny model sa nevolal. Prešli však v režime fixtúr cez normalizátor,
ktorý napísal ten istý autor. Model ich nevidel, ale nie sú nezávislé od kódu.

<a id="2-modes"></a>

## 2. Režimy

| Príkaz | Režim | Čo poskytuje odpovede | Čo meria |
|---|---|---|---|
| `npm run eval:ai` | FIXTURE | `fixture_output` každého riadka | kontrakty, referencie kategórií, cestu kvót, normalizátor a tento vyhodnocovač |
| `npm run eval:ai:live -- --dry-run` | — | nič | integritu korpusu, konfiguráciu, plánovaný počet volaní |
| `npm run eval:ai:live -- --limit N` | LIVE | skutočný adaptér OpenAI | extrakciu modelom na syntetickom korpuse |

Oba spustiteľné režimy používajú produkčnú službu konceptov (`src/ai/service.js`)
na jednorazovej alebo vyhradenej databáze s hodinami nastavenými na referenčný
dátum každého riadka — nejde o novú implementáciu pipeline.

<a id="3-metrics-and-targets"></a>

## 3. Metriky a ciele

Pre podporované riadky (ciele zvolené pre tento projekt, plán §15; nie benchmarky):

| Metrika | Menovateľ | Cieľ |
|---|---|---|
| Úplne správny koncept | riadky označené ready | ≥ 90 % |
| Suma | riadky s nenulovou očakávanou sumou | ≥ 98 % |
| Dátum | riadky s nenulovým očakávaným dátumom | ≥ 98 % |
| Kategória (povolené alternatívy) | riadky s očakávanými kategóriami | ≥ 90 % |
| Nesprávny stav ready | všetky riadky | 0 |
| Vymyslená suma alebo dátum | všetky riadky | 0 |
| Nesprávna nenulová suma alebo dátum (D-037) | všetky riadky | 0 |
| Konzistentnosť fixtúr (len režim fixtúr) | všetky riadky | 100 % |

Uvádza sa aj pokrytie, presnosť stavu, zachytenie očakávaných problémov,
vymyslená kategória, chyby, tabuľky podľa jazyka a skupiny, latencia p50/p95
a tokeny (len v živom režime). Ak ochrana odmietne nesprávnu odpoveď modelu,
počíta sa to ako zlyhanie extrakcie; prázdny výsledok sa nepovažuje za správny
iba preto, že je bezpečný.

<a id="4-fixture-result-2026-09-15"></a>

## 4. Výsledok fixtúr (2026-09-15)

`MODE=FIXTURE MODEL_QUALITY=NOT_MEASURED RESULT=PASS`

| Metrika | Výsledok |
|---|---|
| Riadky zhodné s označením | 113/113 |
| Úplne správny koncept | 46/46 |
| Suma / Dátum / Kategória | 60/60 · 75/75 · 79/79 |
| Pokrytie / Stav / Zachytenie problémov | 46/46 · 113/113 · 113/113 |
| Nesprávny ready / vymyslená suma-dátum / nesprávna suma-dátum / vymyslená kategória / chyby | 0 · 0 · 0 · 0 · 0 |
| en · uk · sk · mixed | 56/56 · 28/28 · 27/27 · 2/2 |
| dev · holdout | 93/93 · 20/20 |
| Prieskumné (nezapočítané) | 3/3 |

Verzie: schéma 1, prompt 1 (sha256 inštrukcií `bc229627…dbf43`), sha256
schémy poskytovateľa `cca6754f…90e17`, normalizátor 2 (D-037; výsledok je
rovnaký aj pod normalizátorom 1). Kód: skoršia verzia tohto repozitára
(hash jej obsahu je zaznamenaný v každom JSON reporte).
Reporty: `qa/reports/ai-eval/fixture-*.json|md` (ignorované Gitom; len ID a
hodnoty, bez opisov, promptov alebo kľúčov).

**Správna interpretácia.** 100 % tu znamená, že normalizátor,
kontrakty a vyhodnocovač súhlasia s označeniami, keď „model“ vráti označenú
odpoveď. Ide o kontrolu konzistentnosti. Nižší výsledok by bol znepokojivý;
nehovorí však nič o skutočnom modeli.

<a id="5-negative-controls--can-the-evaluator-fail"></a>

## 5. Negatívne kontroly — dokáže vyhodnocovač zlyhanie odhaliť?

`qa/ai/tests/evaluator.test.js` sa spúšťa v rámci `npm run test:ai`. Každá
kontrola poškodí jednu vec v jednorazovej kópii; produkčné súbory sa nemenia.

| Cieľ | Poškodenie | Očakávané | Pozorované |
|---|---|---|---|
| baseline | nezmenená kópia, znovu zapečatená | PASS | exit 0, PASS |
| EVALUATOR | vynechaný jeden riadok | odmietnutie pred skórovaním | exit 2, "total rows 115, manifest says 116" |
| EVALUATOR | upravený riadok, manifest znovu nezapečatený | odmietnutie | exit 2, hash mismatch |
| EVALUATOR | prázdny korpus; chýbajúci súbor korpusu | žiadny úspech pri nule prípadov | exit 2 v oboch prípadoch |
| EVALUATOR | označená suma 1800 → 1900 | FAIL s riadkom a poľom | exit 1, "fixture consistency 112/113", "AI-EVAL-001 … failed amount" |
| EVALUATOR | každá odpoveď "unsupported" | FAIL napriek nule nesprávnych ready | complete 0/46, amount 0/60 |
| EVALUATOR | každá odpoveď je chyba; nula skórovaných riadkov | FAIL | 113 errors; "no supported rows were scored" |
| EVALUATOR | dva štruktúrne problémy | hlásené oba | oba uvedené |
| EVALUATOR (R5) | jedna nesprávna nenulová suma, presnosť stále 98.3 % | FAIL | `wrong_numeric_fields 1` |
| EVALUATOR (R5) | jeden nesprávny nenulový dátum | FAIL | `wrong_numeric_fields 1` |
| PRODUCTION GUARD | text uvádza 180, model 18 | neprijaté | `AI_INVALID_RESPONSE` v tomto riadku |
| PRODUCTION GUARD | `currency_text: null` pri "Lunch 10 USD" | nikdy ready EUR | riadok ostáva unsupported; false ready 0 |
| PRODUCTION GUARD | referencia kategórie `c999` | odmietnutá, nemapovaná | `AI_INVALID_RESPONSE` |


<a id="6-real-model-evaluation"></a>

## 6. Vyhodnotenie na skutočnom modeli

Vyhodnotenie na skutočnom modeli je **predvolene vypnuté** a nikdy nie je
súčasťou `npm test` ani CI. Vyžaduje výslovne nastavený kľúč, model a konečný
limit v lokálnom `.env` (nikdy sa necommitne) a spúšťa sa iba cez
`npm run eval:ai:live`. Tento repozitár **netvrdí žiadny výsledok kvality
skutočného modelu**: dve syntetické pilotné požiadavky na Gemini Free skončili
chybami poskytovateľa skôr, než vznikol použiteľný výstup, a nebola odoslaná
žiadna požiadavka na OpenAI.

Nastavenie v lokálnom `.env`:

```bash
OPENAI_API_KEY=…                  # a project-specific key with a spending limit set in the provider dashboard
WALLET_AI_MODEL=<a model checked against the current Structured Outputs docs>
WALLET_AI_LIVE_ALLOWED=true
WALLET_AI_EVAL_LIVE=true
WALLET_AI_EVAL_DAILY_CALLS=5      # the evaluation's own finite allowance (accepted 1–200)
```

Potom `npm run eval:ai:live -- --dry-run`; až po prečítaní jeho plánu
`npm run eval:ai:live -- --limit 1`, riadka o využití a následne väčší `--limit`.

**Vyhodnocovač má vlastné limity.** Pri vyhodnocovaní nezvyšujte
`WALLET_AI_GLOBAL_DAILY_CALLS` ani `WALLET_AI_USER_DAILY_CALLS`: rovnaký
`.env` používa `npm start`, čím by sa zvýšili aj limity živej aplikácie.
Vyhodnocovač vôbec nečíta limity volaní aplikácie
(`WALLET_AI_GLOBAL_DAILY_CALLS`, `WALLET_AI_USER_DAILY_CALLS`,
`WALLET_AI_USER_MINUTE_CALLS`, `WALLET_AI_MAX_CONCURRENT`).
Používa `WALLET_AI_EVAL_DAILY_CALLS`, počítané v `data/ai-eval.db`
(nikdy v databáze aplikácie) naprieč behmi so stabilnými syntetickými
používateľmi, nižšie uvedené kĺzavé okno a pevné hodnoty vyhodnocovača:
neobmedzujúci minútový limit 100 a jedno súbežné volanie. Odmietnutie pre
denný limit ukončí beh ako INCOMPLETE. Stále však používa spoločné nastavenia
požiadaviek `WALLET_AI_TIMEOUT_MS` a `WALLET_AI_MAX_OUTPUT_TOKENS`.

**Kĺzavé okno.** Nezávisle od denného limitu vyhodnocovač uskutoční najviac
5 volaní poskytovateľa v ľubovoľných kĺzavých 10 minútach — konštanta v
`qa/ai/eval-window.js`, uložená v databáze vyhodnocovania
(`eval_provider_calls`, nikdy sa nepremazáva), spoločná pre reštarty,
paralelné procesy a oboch poskytovateľov. Beh plánujúci viac volaní,
než je voľných, sa odmietne pred prvou požiadavkou (exit 3) so správou
`next call available at <time>`; každé volanie si atómovo rezervuje miesto
tesne pred odoslaním a ponechá si ho aj pri zlyhaní. Miesto obsadené iným
procesom počas behu ho zastaví ako INCOMPLETE. Beh `--limit 5` uskutoční
svojich päť volaní bez minútového čakania bez ohľadu na hodnotu
`WALLET_AI_USER_MINUTE_CALLS` aplikácie (W13).

**Dvaja poskytovatelia.** `WALLET_AI_PROVIDER` vyberá `openai`
(predvolené) alebo `gemini`. Gemini Free je určený len pre tento syntetický
korpus, vyžaduje `GEMINI_API_KEY` a `WALLET_AI_GEMINI_MODEL`
(nikdy kľúč OpenAI) a aplikácia ho odmieta, pretože vstup v bezplatnej
úrovni môže poskytovateľ používať na zlepšovanie svojich produktov.
Odpoveď poskytovateľa 429 je chybou daného riadka, nie pozastavením.
Reporty aj register holdout uvádzajú poskytovateľa, aby sa výsledok Gemini
nikdy nečítal ako výsledok OpenAI. `npm run eval:ai:models` iba vypíše
modely dostupné pre kľúč Gemini; nič negeneruje.

Čo živý vyhodnocovač odmieta (testované v
`qa/ai/tests/eval-*.test.js`):

- **Databázu vyhodnocovania, ktorá je databázou aplikácie pod akýmkoľvek názvom** —
  ten istý súbor cez junction, symbolický či pevný odkaz, inú veľkosť písmen,
  sprievodný názov SQLite alebo zatiaľ nevytvorený súbor pod aliasovaným
  priečinkom. Chránené sú `data/wallet.db` aj `DB_PATH`. Exit 2 pred čítaním.
- **`--split all` v živom režime.** Jeden split na beh: `--split dev`
  (predvolené) alebo `--split holdout`. Exit 2.
- **Druhý beh holdout** pre ten istý korpus, model a deklarované verzie
  bez ohľadu na to, kto ho spustil a ako skončil (chyba, zastavenie,
  zabitie), pokiaľ `--rerun-holdout "<reason>"` nezaznamená dôvod.
  Rezervácia prebehne v jednej transakcii pred prvým volaním;
  záznamy sa nikdy nemažú. Exit 3.
- **Beh holdout, ktorý sa nezmestí do dnešného zostávajúceho limitu.**
  Exit 3, nič sa nerezervuje.

Suchý beh nič neposiela ani nezapisuje. Ak `data/ai-eval.db` už existuje,
otvorí ho iba na čítanie a ukáže počet volaní zostávajúcich na dnešok.

Každý report teraz uvádza:

- **Rozsah** — `FULL` alebo `PARTIAL` a vybrané/dostupné riadky splitu.
- **Verdikt** — `PILOT_ONLY` pri každom čiastočnom živom behu
  (`--limit 1` PASS je úspešný pilot, nie akceptácia),
  `DEV_THRESHOLDS_MET`/`_NOT_MET` alebo
  `HOLDOUT_THRESHOLDS_MET`/`_NOT_MET` len pre celý split,
  `NOT_ASSESSED` pri nedokončenom behu alebo zmene zdroja počas behu.
- **Požiadavky** — skutočné požiadavky na poskytovateľa a lokálne falošné
  požiadavky oddelene.
- **Spotreba tokenov** — známa pri K z N volaní; zvyšok neznámy,
  nikdy 0; počítajú sa aj nepoužiteľné odpovede s nahlásenou spotrebou
  (účtované, napr. `incomplete`, D-038 L7). Cena sa nepočíta.
- **Kód** — obsahový manifest: sha256 každého povoleného zdrojového
  súboru plus súhrnný hash na začiatku a na konci, vrátane
  nesledovaných súborov. Git HEAD je doplnkový údaj.

Pred prvým skutočným volaním potvrďte zvolený model podľa aktuálnej
dokumentácie OpenAI pre Responses API s JSON Schema v `text.format`,
`store:false` a spracovaním odmietnutia. Adaptér vznikol podľa tejto
dokumentácie a bol testovaný lokálnym falošným poskytovateľom;
kompatibilita so skutočným účtom nie je overená.

Pravidlá holdout pre jeho prípadné spustenie: najprv dev; najviac dve
zdokumentované revízie promptu; potom holdout raz pre zmrazenú verziu
(`--split holdout`), s každým zlyhaním a jeho klasifikáciou zaznamenanými
tu. Žiadne opakovanie len preto, aby sa objavilo priaznivé číslo.
Aj pilot `--split holdout --limit 1` sa pre dané verzie a model už
počíta ako beh holdout.
