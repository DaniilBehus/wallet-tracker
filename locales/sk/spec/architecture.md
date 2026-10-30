[English](../../../spec/architecture.md) · **Slovenčina**

<!-- locale-links-v1: source-relative links rebased for locales/sk -->

<!-- Original English heading anchors retained for stable cross-language references. -->
<a id="wallet-tracker--architecture-and-development-notes"></a>
# Wallet Tracker — architektúra a poznámky k vývoju

[← Späť na README](../README.md#architecture) · [Ďalej: moduly servera →](../../../src)

<a id="1-product-and-scope"></a>
## 1. Produkt a rozsah

Wallet Tracker je webová aplikácia navrhnutá prednostne pre telefón na zaznamenávanie výdavkov, opakovaných platieb a úverov. Výdavok už nastal; opakovaná platba sa zopakuje; úver je opakovaná platba s konečným počtom splátok. Takto zostáva doména zámerne malá a zároveň podporuje hlavné finančné postupy.

Voliteľný postup **Describe an expense** prijme jednu krátku vetu a vráti upraviteľný návrh. Finančný záznam nikdy neuloží automaticky: používateľ návrh skontroluje a použije bežnú akciu Save. Podrobný kontrakt je v [`ai-expense-entry.md`](ai-expense-entry.md).

<a id="2-architecture"></a>
## 2. Architektúra

| Oblasť | Voľba | Odôvodnenie |
|---|---|---|
| Beh aplikácie | Node.js s Express | Podporovaná verzia a minimálna úroveň Node-API sú uvedené v [nastavení testov](../docs/testing.md) a [metadátach balíka](../../../package.json) |
| Úložisko | SQLite cez `better-sqlite3` | Jeden lokálny databázový súbor vyhovuje aplikácii pre jedného používateľa |
| Autentifikácia | JWT s HS256 | Bezstavová autentifikácia tokenom Bearer; podpisové tajomstvo sa nastavuje mimo Gitu |
| Ukladanie hesiel | bcrypt | Heslá sa nikdy neukladajú ako obyčajný text |
| Frontend | Čisté HTML, CSS a JavaScript | Rýchle mobilné rozhranie bez réžie frameworku |
| Peniaze | Celočíselné centy | Predchádza chybám zaokrúhľovania s pohyblivou rádovou čiarkou vo finančných súčtoch |

Server nepoužíva aritmetiku s desatinnými číslami ani formátovanie meny. Sumy sa ukladajú ako `amount_cents`; formátovanie na zobrazenie prebieha až na strane prehliadača.

Dátumy sú lokálne kalendárne dátumy (`YYYY-MM-DD`) bez prevodu časového pásma. Produkt modeluje osobné výdavky, nie účtovníctvo naprieč časovými pásmami.

<a id="3-data-model-and-invariants"></a>
## 3. Dátový model a invarianty

| Tabuľka | Zodpovednosť | Dôležité invarianty |
|---|---|---|
| `users` | Identita účtu | Jedinečný e-mail; len hash hesla |
| `categories` | Vlastné kategórie výdavkov používateľa a ich voliteľné mesačné limity | Názov kategórie je pre vlastníka jedinečný; limit je nezáporný, `NULL` znamená bez limitu |
| `transactions` | Už uskutočnené výdavky | Kladné celočíselné centy; voliteľný zdrojový rozvrh |
| `schedules` | Budúce opakované platby a úvery | Kladná suma, platný deň mesiaca, stav aktivity a počet platieb |
| `settings` | Mesačný príjem a limit výdavkov používateľa | Najviac jeden riadok na používateľa; príjem je nezáporný, `NULL` znamená bez limitu |

Úver predstavuje rozvrh s `total_count`; predplatné má `total_count = NULL`. Hodnoty `remaining_count`, `remaining_cents` a `next_due` sa vypočítavajú pri čítaní namiesto ukladania, aby odvodené údaje nezostali zastarané.

Limit výdavkov je upozornenie, nie pravidlo blokujúce výdavok. Stavy `not_set`, `within`, `reached` a `exceeded` sa vypočítavajú z toho istého mesačného súčtu, ktorý je na obrazovke. [Rozhodovacia tabuľka a väzby na testy](../qa/docs/analysis-monthly-limit.md) dokumentujú hranice rovnosti a nulového limitu.

Kategória môže mať vlastný mesačný limit, vyhodnotený rovnakým pravidlom voči jej mesačným výdavkom: počíta sa pri čítaní, nikdy sa neukladá a je nezávislý od celkového limitu. Zaplatená splátka sa započítava do svojej kategórie; nezaplatená nie a výdavok bez kategórie nespadá pod žiadny limit kategórie. [Analýza limitov kategórií](../qa/docs/analysis-category-limits.md) obsahuje pravidlá a rozhodovaciu tabuľku.

Ak deň splatnosti rozvrhu v danom mesiaci neexistuje, dátum sa obmedzí na posledný deň mesiaca. Rozvrh nastavený na 31. deň preto pripadne na 28. február (v priestupnom roku na 29.), namiesto vynechania mesiaca.

Zaplatenie rozvrhu vytvorí jednu transakciu a zvýši `paid_count`. Úver sa stane neaktívnym po dosiahnutí `total_count`; pokus zaplatiť neaktívny rozvrh vráti konflikt.

<a id="4-api-design"></a>
## 4. Návrh API

Koreň API je `/api`, vstup aj výstup sú JSON. Okrem endpointov zdravia a autentifikácie vyžaduje každá cesta `Authorization: Bearer <token>`.

Každá chyba má jeden stabilný tvar:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "amount_cents must be a positive integer" } }
```

| Oblasť | Cesty a správanie |
|---|---|
| Zdravie | `GET /health` overuje dostupnosť služby a databázy bez čítania používateľských údajov |
| Autentifikácia | Registrácia a prihlásenie vydávajú JWT; neúspešné prihlásenia obmedzuje limit pred hashovaním hesla |
| Kategórie | Zoznam a vytvorenie vlastných kategórií, nastavenie alebo zrušenie mesačného limitu jednej kategórie cez `PATCH` (iba toto pole); cudzí zdroj sa hlási ako `404` |
| Transakcie | Vytvorenie, filtrovanie, úprava cez `PATCH` a zmazanie výdavkov; polia vlastnené serverom sa pri úprave odmietnu |
| Idempotencia | `POST /transactions` môže použiť `Idempotency-Key` na bezpečné zopakovanie pôvodného úspešného vytvorenia; konfliktné dáta sa odmietnu |
| Nastavenia a súhrn | Ukladanie príjmu a mesačného limitu s povoleným null; výpočet súčtov, podielov kategórií, zostatku príjmu, stavu celkového limitu a limitov kategórií |
| Rozvrhy | Vytvorenie, zoznam, úprava a zaplatenie opakovaných platieb alebo úverov; stav rozvrhu sa overuje atomicky |
| AI návrh | Informácie o dostupnosti a endpoint návrhu výdavku, ktorý vráti len overený návrh |

Validácia odmieta chybný vstup cez `400`, chýbajúcu alebo neplatnú autentifikáciu cez `401`, nedostupné zdroje cez `404`, konflikt s aktuálnym stavom cez `409` a obmedzené neúspešné prihlásenia cez `429`. Nadmerný JSON je `413`, nikdy neošetrená chyba servera.

Transakcie, rozvrhy a limit kategórie podporujú čiastočné úpravy `PATCH`. Prázdna úprava sa odmietne a stav vlastnený serverom, napríklad identifikátory, časové pečiatky, `paid_count` a `active`, klient nastaviť nemôže.

<a id="5-interface-and-interaction-design"></a>
## 5. Návrh rozhrania a interakcií

Produkt má štyri obrazovky navrhnuté prednostne pre mobil:

- **Add:** vlastná numerická klávesnica, výber kategórie a uloženie; voliteľná poznámka zostáva vedľajšia oproti rýchlemu zadaniu výdavku.
- **This month:** súčty, podiely kategórií, príjem, zostávajúci príjem a používateľský limit výdavkov; transakcie sú zoskupené podľa dňa a upraviteľné priamo na mieste. Riadok kategórie otvorí malý editor jej limitu; kategória s limitom ukazuje spotrebovanú časť a slovný stav aj pred prvým výdavkom.
- **Upcoming:** aktívne rozvrhy zoradené podľa najbližšej splatnosti vrátane priebehu splácania a akcie Pay.
- **Schedules:** jeden formulár pre opakované platby a úvery; úver sa vyberá výslovne a zobrazí počet splátok.

Každý interaktívny prvok alebo prvok overovaný testom má stabilný `data-testid`. Testy používajú tieto sémantické identifikátory alebo prístupné roly namiesto krehkých vizuálnych CSS selektorov. Rozhranie je v angličtine a formátuje peniaze ako `€12.50`.

<a id="6-quality-strategy"></a>
## 6. Stratégia kvality

Repozitár považuje testovanie za súčasť produktu:

| Vrstva | Účel |
|---|---|
| Kontroly API kontraktu | Overenie stavových kódov, schém, autentifikácie a chybových ciest |
| Python scenáre | Nezávislý klient API s výstupom kompatibilným s JUnit |
| Playwright | Hlavné používateľské postupy v mobilnom a desktopovom viewporte |
| Kontroly súbehu | Súbežné zápisy do jedného SQLite súboru |
| Záťažové kontroly | Meranie súperenia o zápis a obmedzovania neúspešného prihlasovania |
| Vyhodnotenie AI | Offline vyhodnotenie označených príkladov prevodu vety na návrh bez povinného volania poskytovateľa |
| Kontrolná brána | Vybrané invarianty zdrojov, ciest, testovacích ID a pokrytia |

Brána kontrolného súčtu zámerne eviduje tento dokument architektúry. Chráni dôležité predpoklady produktu pred nepovšimnutými zmenami; úmyselná úprava musí v tom istom review aktualizovať aj zaznamenaný SHA-256.

[Verejný index základných pravidiel](core-requirements.md) poskytuje stabilné sémantické ID existujúcej architektúry a odkazuje na samostatné pravidlá funkcií.

<a id="7-deliberate-limits"></a>
## 7. Zámerné obmedzenia

Wallet Tracker zámerne nie je banková ani účtovná platforma. Nezahŕňa viac mien, párovanie účtov, upozornenia na rozpočet, offline synchronizáciu, notifikácie, obnovu hesla, OAuth, CSV/PDF export, Docker ani frontend založený na frameworku.

Voliteľný AI postup nespracúva fotografie účteniek, hlas, viac výdavkov z jednej vety, historické údaje, externé nástroje ani autonómne akcie. Navrhne len upraviteľný koncept.
