[English](../../../../qa/docs/test-cases.md) · **Slovenčina**

<a id="test-cases--wallet"></a>

# Testovacie prípady · WALLET

[← Späť na README](../../README.md#qa-evidence) · [Ďalej: analýza mesačného limitu →](analysis-monthly-limit.md)

**Na dátumoch výsledkov záleží.** Historické stavy prípadov si
ponechávajú dôkazy pomenované vo svojich častiach. Aktuálny
automatizovaný beh je viditeľný v [GitHub Actions](https://github.com/DaniilBehus/wallet-tracker/actions/workflows/ci.yml);
verejné architektonické poznámky sú v
[`spec/architecture.md`](../../spec/architecture.md).
Lokálne spustenie Playwright vyžaduje hostiteľa schopného spustiť Chromium.

Rozhranie je v angličtine a peniaze sa zobrazujú ako `€12.50`
(D-018, D-019). Nižšie uvedené očakávané hodnoty sú aktuálne;
staré slovenské reťazce tu nie sú zachované, lebo register opisuje
terajšie správanie aplikácie. Jediným miestom, kde staré reťazce
zámerne zostávajú, je report BUG-003. Cituje reálne zachytený
výstup a jeho úprava by ho sfalšovala.

Každý prípad je automatizovaný — prípad existujúci iba v dokumente
nikto nespúšťa. **Automatizované v** pomenúva súbor, ktorý ho
vykonáva, aby sa každý výsledok dal sledovať ku kódu.

**Väzba na** teraz smeruje k aktuálnemu verejnému pravidlu alebo
pomenovanému záznamu chyby/limitu.
[Index migrácie základných pravidiel](../../spec/core-requirements.md#legacy-reference-migration-index)
vysvetľuje vyradené čísla článkov a označenia D. Statický kontrolér
vie overiť identitu, zdroj a kotvy; nevie rozhodnúť, či prípad
pravidlo naozaj precvičuje, bol spustený alebo dokazuje aktuálny
výsledok CI. Význam stále vyžaduje kontrolu krokov,
očakávanej hodnoty a datovaného dôkazu.

**Priorita:** `P1` nesprávne peniaze, únik dát medzi používateľmi
alebo nepoužiteľná aplikácia · `P2` nesplnená zdokumentovaná
požiadavka · `P3` kozmetická chyba.

**Stav:** `PASS` · `FAIL` · `BLOCKED` zo zaznamenaných behov.

Predpoklady pre každý prípad: server beží, `npm run check`
vypíše `OK` a prípad má čerstvo vytvorený účet. Riadky
sa pripravujú cez API, pokiaľ sa prípad netýka ich vytvárania.

---

<a id="api--health-and-registration--qaapiwalletpostman_collectionjson"></a>

## API · Health a registrácia · `qa/api/wallet.postman_collection.json`

| ID | Prípad | Kroky | Očakávané | Väzba na | Pri | Stav |
|---|---|---|---|---|---|---|
| TC-API-001 | Kontrola health | `GET /api/health` | 200, `{status, version, db}`, `db` je `ok`, bez autentifikácie | [REQ-CORE-01](../../spec/core-requirements.md#req-core-01) | P2 | PASS |
| TC-API-002 | Registrácia | `POST /auth/register`, nový e-mail | 201, telo je iba `{token}` | [REQ-CORE-02](../../spec/core-requirements.md#req-core-02) | P1 | PASS |
| TC-API-003 | Registrácia druhého používateľa | Rovnako, iný e-mail | 201, token sa líši od TC-API-002 | [REQ-CORE-02](../../spec/core-requirements.md#req-core-02) | P1 | PASS |
| TC-API-004 | Duplicitný e-mail | Znovu registrovať adresu TC-API-002 | 409 `CONFLICT` | [REQ-CORE-02](../../spec/core-requirements.md#req-core-02); [REQ-CORE-16](../../spec/core-requirements.md#req-core-16) | P2 | PASS |
| TC-API-005 | Heslo kratšie než 8 znakov | Registrovať s `"short"` | 400 `VALIDATION_FAILED` | [REQ-CORE-03](../../spec/core-requirements.md#req-core-03) | P2 | PASS |
| TC-API-006 | Chýbajúce heslo | Bez poľa `password` | 400 | [REQ-CORE-03](../../spec/core-requirements.md#req-core-03) | P2 | PASS |
| TC-API-007 | Prihlásenie | `POST /auth/login`, správne údaje | 200, `{token}` | [REQ-CORE-02](../../spec/core-requirements.md#req-core-02) | P1 | PASS |
| TC-API-008 | Nesprávne heslo | Správny e-mail, nesprávne heslo | 401 `UNAUTHORIZED` | [REQ-CORE-02](../../spec/core-requirements.md#req-core-02) | P1 | PASS |
| TC-API-009 | Neznámy e-mail sa nedá odlíšiť | Prihlásiť sa neregistrovanou adresou | 401 s **rovnakou správou** ako TC-API-008 — formulár nesmie prezradiť existujúce adresy | [REQ-CORE-02](../../spec/core-requirements.md#req-core-02); [REQ-CORE-17](../../spec/core-requirements.md#req-core-17) | P1 | PASS |
| TC-API-106 | Najdlhšie heslo, ktoré bcrypt prečíta celé | Registrovať 72 znakmi ASCII | 201 a token — samotná hranica sa prijíma, neodmieta | [REQ-CORE-03](../../spec/core-requirements.md#req-core-03); [BUG-017](../../log/BUGS.md) | P2 | PASS |
| TC-API-107 | Jeden bajt nad limitom | Registrovať 73 znakmi ASCII | 400 `VALIDATION_FAILED`; účet nevznikne, lebo uložený hash by ignoroval 73. bajt | [REQ-CORE-03](../../spec/core-requirements.md#req-core-03); [BUG-017](../../log/BUGS.md) | P1 | PASS |
| TC-API-108 | Limit počíta bajty, nie znaky | Registrovať s 37 × `é` — 37 znakov, 74 bajtov v UTF-8 | 400 `VALIDATION_FAILED`, hoci heslo má polovicu limitu znakov | [REQ-CORE-03](../../spec/core-requirements.md#req-core-03); [BUG-017](../../log/BUGS.md) | P1 | PASS |

<a id="api--token-handling"></a>

## API · Spracovanie tokenov

| ID | Prípad | Kroky | Očakávané | Väzba na | Pri | Stav |
|---|---|---|---|---|---|---|
| TC-API-010 | Bez tokenu | `GET /categories`, bez hlavičky | 401 v štandardnom tvare chyby | [REQ-CORE-02](../../spec/core-requirements.md#req-core-02) | P1 | PASS |
| TC-API-011 | Nesprávna schéma | `Authorization: Token <jwt>` | 401 | [REQ-CORE-02](../../spec/core-requirements.md#req-core-02) | P2 | PASS |
| TC-API-012 | Poškodený token | Platný token, posledný znak podpisu otočený | 401 — hlavička a payload bez zmeny, takže server, ktorý len dekóduje, by ho prijal | [REQ-CORE-02](../../spec/core-requirements.md#req-core-02) | P1 | PASS |
| TC-API-013 | Expirovaný token | JWT podpísaný skutočným tajomstvom, `exp` 10 dní v minulosti | 401. Najprv overí, že token **je** expirovaný, potom 401 | [REQ-CORE-02](../../spec/core-requirements.md#req-core-02) | P1 | PASS |
| TC-API-014 | Token iného používateľa patrí jemu | `GET /transactions` ako používateľ B | 200, `total` je 0 | [REQ-CORE-04](../../spec/core-requirements.md#req-core-04) | P1 | PASS |

<a id="api--categories"></a>

## API · Kategórie

| ID | Prípad | Kroky | Očakávané | Väzba na | Pri | Stav |
|---|---|---|---|---|---|---|
| TC-API-015 | Predvyplnené pri registrácii | `GET /categories` | 200, neprázdne pole podľa schémy | [REQ-CORE-05](../../spec/core-requirements.md#req-core-05) | P2 | PASS |
| TC-API-016 | Kategórie sú podľa používateľa | `GET /categories` ako používateľ B | 200, žiadne ID používateľa A | [REQ-CORE-04](../../spec/core-requirements.md#req-core-04); [REQ-CORE-05](../../spec/core-requirements.md#req-core-05) | P1 | PASS |
| TC-API-017 | Vytvorenie | `POST /categories` s názvom a emoji | 201, vráti názov a ikonu | [REQ-CORE-05](../../spec/core-requirements.md#req-core-05) | P2 | PASS |
| TC-API-018 | Duplicitný názov | Opakovať TC-API-017 | 409 | [REQ-CORE-05](../../spec/core-requirements.md#req-core-05); [REQ-CORE-16](../../spec/core-requirements.md#req-core-16) | P2 | PASS |
| TC-API-019 | Prázdny názov | `"   "` | 400 | [REQ-CORE-05](../../spec/core-requirements.md#req-core-05); [REQ-CORE-16](../../spec/core-requirements.md#req-core-16) | P2 | PASS |
| TC-API-020 | Názov s 61 znakmi | Jeden nad limitom | 400 | [REQ-CORE-05](../../spec/core-requirements.md#req-core-05); [REQ-CORE-16](../../spec/core-requirements.md#req-core-16) | P2 | PASS |
| TC-API-021 | Názov presne so 60 znakmi | Povolená strana hranice | 201, uložený názov má 60 znakov | [REQ-CORE-05](../../spec/core-requirements.md#req-core-05) | P2 | PASS |


<a id="api--transactions"></a>

## API · Transakcie

| ID | Prípad | Kroky | Očakávané | Väzba na | Pri | Stav |
|---|---|---|---|---|---|---|
| TC-API-022 | Vytvoriť výdavok | Suma + kategória | 201, `spent_on` je predvolene dnes, suma sa vráti ako odoslané celé číslo | [REQ-CORE-06](../../spec/core-requirements.md#req-core-06) | P1 | PASS |
| TC-API-023 | `amount_cents` = 0 | Hranica | 400 | [REQ-CORE-06](../../spec/core-requirements.md#req-core-06) | P1 | PASS |
| TC-API-024 | `amount_cents` = 1 | Najmenšia platná | 201 | [REQ-CORE-06](../../spec/core-requirements.md#req-core-06) | P1 | PASS |
| TC-API-025 | `amount_cents` = strop | 100,000,000 = €1,000,000 | 201, hodnota sa zachová presne | [REQ-CORE-06](../../spec/core-requirements.md#req-core-06) | P1 | PASS |
| TC-API-026 | `amount_cents` = strop + 1 | 100 000 001 | 400 | [REQ-CORE-06](../../spec/core-requirements.md#req-core-06) | P1 | PASS |
| TC-API-027 | Desatinná suma | `12.5` | 400 — desatinný cent znamená preniknutý float | [REQ-CORE-06](../../spec/core-requirements.md#req-core-06) | P1 | PASS |
| TC-API-028 | Suma ako reťazec | `"1250"` | 400, bez konverzie | [REQ-CORE-06](../../spec/core-requirements.md#req-core-06) | P2 | PASS |
| TC-API-029 | Chýbajúca suma | Bez poľa | 400 | [REQ-CORE-06](../../spec/core-requirements.md#req-core-06) | P2 | PASS |
| TC-API-030 | Skrátené telo JSON | Telo prerušené uprostred objektu | **400, nie 500**, telo je JSON, nie HTML | [REQ-CORE-16](../../spec/core-requirements.md#req-core-16) | P1 | PASS |
| TC-API-031 | Nesprávny formát `spent_on` | `02/09/2026` | 400 | [REQ-CORE-07](../../spec/core-requirements.md#req-core-07) | P2 | PASS |
| TC-API-032 | `spent_on` o 30 dní dopredu | §4.3 dovoľuje najviac jeden deň | 400 | [REQ-CORE-07](../../spec/core-requirements.md#req-core-07) | P2 | PASS |
| TC-API-033 | Cudzie `category_id` | POST s kategóriou používateľa B | **404, výslovné overenie, že nie 403** | [REQ-CORE-04](../../spec/core-requirements.md#req-core-04) | P1 | PASS |
| TC-API-034 | Zoznam je predvolene za tento mesiac | `GET /transactions` | 200 `{items,total}`, najnovšie najprv | [REQ-CORE-08](../../spec/core-requirements.md#req-core-08) | P2 | PASS |
| TC-API-035 | `limit=201` | Jeden nad stropom | 400 | [REQ-CORE-08](../../spec/core-requirements.md#req-core-08) | P2 | PASS |
| TC-API-036 | `limit=200` | Samotný strop | 200 | [REQ-CORE-08](../../spec/core-requirements.md#req-core-08) | P2 | PASS |
| TC-API-037 | `from` neskôr než `to` | Otočený rozsah | 400 | [REQ-CORE-08](../../spec/core-requirements.md#req-core-08) | P2 | PASS |
| TC-API-038 | Filtrovať podľa cudzej kategórie | `?category_id=<B's>` | 404, nie 403 — filter nesmie byť sondou | [REQ-CORE-04](../../spec/core-requirements.md#req-core-04) | P1 | PASS |
| TC-API-039 | Zmazať cudzí riadok | `DELETE` ako používateľ B | 404, nie 403 | [REQ-CORE-04](../../spec/core-requirements.md#req-core-04) | P1 | PASS |
| TC-API-040 | Zmazať | Vlastný riadok | 204, prázdne telo | [REQ-CORE-09](../../spec/core-requirements.md#req-core-09) | P2 | PASS |
| TC-API-041 | Zmazať znovu | Opakovať TC-API-040 | 404 | [REQ-CORE-09](../../spec/core-requirements.md#req-core-09) | P2 | PASS |
| TC-API-042 | Nečíselné ID | `/transactions/not-a-number` | 400 | [REQ-CORE-16](../../spec/core-requirements.md#req-core-16) | P3 | PASS |


<a id="api--schedules-and-loans"></a>

## API · Pravidelné plány a pôžičky

| ID | Prípad | Kroky | Očakávané | Väzba na | Pri | Stav |
|---|---|---|---|---|---|---|
| TC-API-043 | Vytvoriť predplatné | Bez `total_count` | 201, `total_count`/`remaining_*` sú null | [REQ-CORE-11](../../spec/core-requirements.md#req-core-11) | P1 | PASS |
| TC-API-044 | `day_of_month` = 0 | Hranica | 400 | [REQ-CORE-11](../../spec/core-requirements.md#req-core-11) | P2 | PASS |
| TC-API-045 | `day_of_month` = 1 | Najnižšia platná | 201, `next_due` na 1. deň | [REQ-CORE-11](../../spec/core-requirements.md#req-core-11) | P2 | PASS |
| TC-API-046 | `day_of_month` = 28 | Existuje v každom mesiaci | 201, `next_due` na 28. deň | [REQ-CORE-12](../../spec/core-requirements.md#req-core-12) | P2 | PASS |
| TC-API-047 | `day_of_month` = 31 so začiatkom vo februári | Prípad, ktorý zlomí naivné implementácie | 201, `next_due` je **posledný deň toho februára** (29 v priestupnom roku) — skrátené, nie preskočené | [REQ-CORE-12](../../spec/core-requirements.md#req-core-12) | P1 | PASS |
| TC-API-048 | `day_of_month` = 32 | Hranica | 400 | [REQ-CORE-11](../../spec/core-requirements.md#req-core-11) | P2 | PASS |
| TC-API-049 | `total_count` = 0 | Hranica | 400 | [REQ-CORE-11](../../spec/core-requirements.md#req-core-11) | P2 | PASS |
| TC-API-050 | `starts_on` = `2026-13-45` | Má tvar dátumu, ale nie je dátum | 400 | [REQ-CORE-07](../../spec/core-requirements.md#req-core-07) | P2 | PASS |
| TC-API-051 | Vytvoriť pôžičku | `total_count` 2 | 201, `paid_count` 0, `remaining_count` 2, `remaining_cents` = 2 × suma | [REQ-CORE-11](../../spec/core-requirements.md#req-core-11) | P1 | PASS |
| TC-API-052 | Zoradený a konzistentný zoznam | `GET /schedules` | Podľa `next_due` vzostupne; pri každej pôžičke `remaining_cents` = `remaining_count` × `amount_cents` | [REQ-CORE-11](../../spec/core-requirements.md#req-core-11); [REQ-CORE-12](../../spec/core-requirements.md#req-core-12) | P1 | PASS |
| TC-API-053 | Filter aktívnych | `?active=1` | Každý riadok má `active` 1 | [REQ-CORE-11](../../spec/core-requirements.md#req-core-11) | P2 | PASS |
| TC-API-054 | Uhradiť splátku | `PATCH /:id/pay` | 200, `paid_count` 1, `remaining_count` 1, `finished` false | [REQ-CORE-13](../../spec/core-requirements.md#req-core-13) | P1 | PASS |
| TC-API-055 | Platba vytvorila transakciu | Znovu načítať vrátené ID | Riadok existuje, `schedule_id` ho spája, suma je splátka | [REQ-CORE-13](../../spec/core-requirements.md#req-core-13) | P1 | PASS |
| TC-API-056 | Uhradiť poslednú splátku | Znovu `PATCH` | 200, `remaining_count` 0, `finished` **true** | [REQ-CORE-13](../../spec/core-requirements.md#req-core-13) | P1 | PASS |
| TC-API-057 | Uhradiť uzavretú pôžičku | Ešte raz `PATCH` | **409, výslovné overenie, že nie 400** — prechod stavu, nie zlý vstup | [REQ-CORE-13](../../spec/core-requirements.md#req-core-13); [REQ-CORE-16](../../spec/core-requirements.md#req-core-16) | P1 | PASS |
| TC-API-058 | Uzavretá pôžička opustí aktívny zoznam | `?active=1` | Jej ID chýba | [REQ-CORE-13](../../spec/core-requirements.md#req-core-13) | P2 | PASS |
| TC-API-059 | Uhradiť plán iného používateľa | `PATCH` ako používateľ B | 404, nie 403 | [REQ-CORE-04](../../spec/core-requirements.md#req-core-04) | P1 | PASS |
| TC-API-060 | Uhradiť neexistujúci plán | `/schedules/99999999/pay` | 404 | [REQ-CORE-16](../../spec/core-requirements.md#req-core-16) | P2 | PASS |
| TC-API-109 | Najväčšia podporovaná pôžička | 1200 splátok pri strope sumy | 201; `remaining_cents` je presne 99 999 999 × 1200 a stále bezpečné celé číslo | [REQ-CORE-11](../../spec/core-requirements.md#req-core-11); [BUG-018](../../log/BUGS.md) | P1 | PASS |
| TC-API-110 | O jednu splátku priveľa | `total_count` 1201 | 400 `VALIDATION_FAILED` | [REQ-CORE-11](../../spec/core-requirements.md#req-core-11); [BUG-018](../../log/BUGS.md) | P1 | PASS |
| TC-API-111 | Pôžička z reportu chyby | 99 999 999 splátok po 99 999 999 centov | 400. Pred opravou: 201, s `remaining_cents` o cent pod presným súčinom | [REQ-CORE-11](../../spec/core-requirements.md#req-core-11); [BUG-018](../../log/BUGS.md) | P1 | PASS |
| TC-API-112 | Číslo, ktoré nie je počtom | `total_count` 1e30 | 400. `Number.isInteger(1e30)` je true, preto sa predtým ukladalo | [REQ-CORE-11](../../spec/core-requirements.md#req-core-11); [BUG-018](../../log/BUGS.md) | P2 | PASS |
| TC-API-113 | Strop platí aj pri úprave | `PATCH` zvýši `total_count` na 1201 | 400 — vytvorenie aj úprava používajú rovnaké pravidlo pre dvojicu | [REQ-CORE-11](../../spec/core-requirements.md#req-core-11); [BUG-018](../../log/BUGS.md) | P1 | PASS |


<a id="api--summary-and-contract-edges"></a>

## API · Súhrn a okraje kontraktu

| ID | Prípad | Kroky | Očakávané | Väzba na | Pri | Stav |
|---|---|---|---|---|---|---|
| TC-API-061 | Mesačný súhrn | `GET /summary` | 200; súčty podľa kategórií sa **rovnajú** mesačnému súčtu; predvolený je aktuálny mesiac | [REQ-CORE-15](../../spec/core-requirements.md#req-core-15) | P1 | PASS |
| TC-API-062 | Výslovný mesiac | `?month=2026-01` | 200, odpoveď za daný mesiac | [REQ-CORE-15](../../spec/core-requirements.md#req-core-15) | P2 | PASS |
| TC-API-063 | Chybný mesiac | `?month=January` | 400 | [REQ-CORE-07](../../spec/core-requirements.md#req-core-07); [REQ-CORE-16](../../spec/core-requirements.md#req-core-16) | P2 | PASS |
| TC-API-064 | Súhrn podľa používateľa | Ako používateľ B, keď A míňal | 200, súčet 0, prázdny rozpis | [REQ-CORE-04](../../spec/core-requirements.md#req-core-04) | P1 | PASS |
| TC-API-065 | Neznáma cesta `/api` | `GET /api/nope-<run>` | 404 v JSON, bez `<html` v tele | [REQ-CORE-16](../../spec/core-requirements.md#req-core-16) | P2 | PASS |
| TC-API-066 | 403 je nedostupný | Cudzie čítanie z opačného smeru | 404, výslovné overenie, že nie 403. §5 uvádza 403, ale aplikácia vracia 404 pre všetko, čo používateľ nesmie vidieť; overuje sa náhradná vlastnosť | [REQ-CORE-04](../../spec/core-requirements.md#req-core-04); [REQ-CORE-16](../../spec/core-requirements.md#req-core-16) | P1 | PASS |

<a id="api--login-rate-limiting--folder-09"></a>

## API · Obmedzenie frekvencie prihlásenia · priečinok `09`

Limity prichádzajú z runnera ako globálne hodnoty, preto prípady
nemajú pevne zakódovanú hranicu. Dva čakajú na skutočné plynutie
času — inde je pevné čakanie zakázané, no okno, ktoré expiruje
podľa času, sa bez jeho uplynutia nedá testovať.

| ID | Prípad | Kroky | Očakávané | Väzba na | Pri | Stav |
|---|---|---|---|---|---|---|
| TC-API-067 | Zlyhanie v rámci limitu | Počkať na koniec okna, potom jedno nesprávne heslo | 401, výslovne **nie** 429 | [REQ-CORE-17](../../spec/core-requirements.md#req-core-17) | P1 | PASS |
| TC-API-068 | Až po jeden pod limitom | Opakovať až po posledný povolený pokus | Každý vráti 401 so schémou chyby; cyklus používa nastavený limit, nie doslovnú 5 | [REQ-CORE-17](../../spec/core-requirements.md#req-core-17) | P1 | PASS |
| TC-API-069 | Jeden nad limitom | Ešte jedno nesprávne heslo | **429** `RATE_LIMITED`, `Retry-After` je prítomné a kladné | [REQ-CORE-17](../../spec/core-requirements.md#req-core-17); [BUG-004](../../log/BUGS.md) | P1 | PASS |
| TC-API-070 | Blokovanie neprezradí existenciu účtu | Prečítať správu 429 | Nič nehovorí o hesle ani existencii účtu | [REQ-CORE-17](../../spec/core-requirements.md#req-core-17) | P1 | PASS |
| TC-API-071 | Správne heslo počas blokovania | Počas blokovania poslať správne heslo | Stále 429 — správnosť ho nesmie zrušiť, inak nič nechráni | [REQ-CORE-17](../../spec/core-requirements.md#req-core-17) | P1 | PASS |
| TC-API-072 | Okno sa uvoľní samo | Počkať na koniec okna, skúsiť znovu | 401 — bez administrátora a reset endpointu. Inak by niekto poznajúci e-mail vedel zablokovať vlastníka | [REQ-CORE-17](../../spec/core-requirements.md#req-core-17) | P1 | PASS |
| TC-API-073 | Úspešné prihlásenie vynuluje počítadlo | Po zlyhaniach sa správne prihlásiť | 200; skoršie zlyhania ho neblokujú | [REQ-CORE-17](../../spec/core-requirements.md#req-core-17) | P2 | PASS |

<a id="api--settings-and-the-month-balance--folder-08"></a>

## API · Nastavenia a mesačný zostatok · priečinok `08`

Mesačný príjem (D-021). Nula vyjadruje „nenastavený“ — §3
zakazuje záporný príjem, takže nula nemôže znamenať nič iné.

| ID | Prípad | Kroky | Očakávané | Väzba na | Pri | Stav |
|---|---|---|---|---|---|---|
| TC-API-074 | Nový účet | `GET /settings` pred nastavením | 200, `monthly_income_cents` je 0 — nie 404 | [REQ-CORE-14](../../spec/core-requirements.md#req-core-14) | P2 | PASS |
| TC-API-075 | Nastaviť príjem | `PUT` 150000 | 200, vráti číslo | [REQ-CORE-14](../../spec/core-requirements.md#req-core-14) | P1 | PASS |
| TC-API-076 | Druhý zápis nahradí prvý | `PUT` 200000 | 200, spätné čítanie 200000 — upsert, nie druhý riadok | [REQ-CORE-14](../../spec/core-requirements.md#req-core-14) | P1 | PASS |
| TC-API-077 | Nula je platná | `PUT` 0 | 200 — nula znamená „nenastavený“ | [REQ-CORE-14](../../spec/core-requirements.md#req-core-14) | P2 | PASS |
| TC-API-078 | Záporná | `PUT` −1 | 400 | [REQ-CORE-14](../../spec/core-requirements.md#req-core-14) | P1 | PASS |
| TC-API-079 | Desatinná | `PUT` 12.5 | 400 — desatinný cent je preniknutý float | [REQ-CORE-14](../../spec/core-requirements.md#req-core-14) | P1 | PASS |
| TC-API-080 | Reťazec | `PUT` "150000" | 400, bez konverzie | [REQ-CORE-14](../../spec/core-requirements.md#req-core-14) | P2 | PASS |
| TC-API-081 | Chýbajúce pole | `PUT {}` | 400 | [REQ-CORE-14](../../spec/core-requirements.md#req-core-14) | P2 | PASS |
| TC-API-082 | Nad stropom | `PUT` 100000001 | 400 — rovnaký strop ako amount_cents | [REQ-CORE-14](../../spec/core-requirements.md#req-core-14) | P2 | PASS |
| TC-API-083 | Bez tokenu | `GET /settings` bez hlavičky | 401 | [REQ-CORE-02](../../spec/core-requirements.md#req-core-02); [REQ-CORE-14](../../spec/core-requirements.md#req-core-14) | P1 | PASS |
| TC-API-087 | Príjem = 1 | `PUT` 1 | 200 — najmenší príjem, ktorý niečo znamená, lebo 0 je „nenastavený“ | [REQ-CORE-14](../../spec/core-requirements.md#req-core-14) | P2 | PASS |
| TC-API-088 | Príjem = presne strop | `PUT` 100 000 000 | 200, zachová sa presne. Testoval sa iba strop+1; chyba o jeden by prešla pôvodným párom | [REQ-CORE-14](../../spec/core-requirements.md#req-core-14) | P1 | PASS |
| TC-API-089 | Príjem výslovne null | `PUT` null | 400 — iná cesta validátorom než pri chýbajúcom poli | [REQ-CORE-14](../../spec/core-requirements.md#req-core-14) | P2 | PASS |
| TC-API-090 | `PUT /settings` bez tokenu | Zápis bez hlavičky | 401. Predtým sa skúšalo iba `GET`; pri zápise je to dôležitejšie | [REQ-CORE-02](../../spec/core-requirements.md#req-core-02); [REQ-CORE-14](../../spec/core-requirements.md#req-core-14) | P1 | PASS |
| TC-API-084 | Súhrn obsahuje príjem | `GET /summary` | `income_cents` je práve zapísané číslo | [REQ-CORE-15](../../spec/core-requirements.md#req-core-15) | P1 | PASS |
| TC-API-085 | Zostatok je presný | Rovnaká odpoveď | `remaining_cents` = `income_cents` − `total_cents` presne na cent | [REQ-CORE-15](../../spec/core-requirements.md#req-core-15) | P1 | PASS |
| TC-API-086 | Príjem neuniká medzi používateľmi | `GET /settings` ako B | 200, 0 — používateľ B má vlastný | [REQ-CORE-04](../../spec/core-requirements.md#req-core-04) | P1 | PASS |


<a id="api--monthly-spending-limit--folder-12"></a>

## API · Mesačný limit výdavkov · priečinok `12`

Limit nastavený človekom pre mesiac a z neho odvodený stav.
Požiadavky, rozhodovacia tabuľka, hranice a matica
sledovateľnosti sú v [`analysis-monthly-limit.md`](analysis-monthly-limit.md).
`T` je mesačný súčet, `L` limit.

| ID | Prípad | Kroky | Očakávané | Väzba na | Pri | Stav |
|---|---|---|---|---|---|---|
| TC-API-091 | Nastaviť limit | `PUT /settings` s `monthly_limit_cents` 12000 | 200, vráti 12000; neskorší `GET` ho vráti; príjem sa nemení | [REQ-ML-01](analysis-monthly-limit.md#req-ml-01) | P1 | PASS |
| TC-API-092 | Zrušiť limit | `PUT` s `monthly_limit_cents: null` | 200, potom `GET` hlási `null` — „bez limitu“, nie nulu | [REQ-ML-02](analysis-monthly-limit.md#req-ml-02) | P1 | PASS |
| TC-API-093 | Vynechanie nie je zmena | `PUT` iba s príjmom | 200, uložený limit bez zmeny | [REQ-ML-03](analysis-monthly-limit.md#req-ml-03) | P2 | PASS |
| TC-API-094 | Súhrn obsahuje limit, stav a zostatok | `GET /summary` s nastaveným limitom | `limit_cents`, `limit_status`, `limit_remaining_cents` = `L − T` presne na cent, stav podľa tabuľky | [REQ-ML-04](analysis-monthly-limit.md#req-ml-04) | P1 | PASS |
| TC-API-095 | Bez limitu → `not_set` (R1, R2) | `GET /summary` bez limitu v prázdnom aj míňajúcom mesiaci | `not_set`, obe peňažné polia `null`, mesačný súčet bez zmeny | [REQ-ML-05](analysis-monthly-limit.md#req-ml-05) | P1 | PASS |
| TC-API-096 | Pod limitom (R3, R4) | `L` nad `T` vrátane `T = 0` | `within`, zostatok je presne `L − T` | [REQ-ML-05](analysis-monthly-limit.md#req-ml-05) | P1 | PASS |
| TC-API-097 | Presne na limite (R5) | `L = T` | `reached`, zostatok `0` — nie `exceeded` | [REQ-ML-05](analysis-monthly-limit.md#req-ml-05) | P1 | PASS |
| TC-API-098 | O cent nad limitom (R6) | `L = T − 1` | `exceeded`, zostatok `−1` | [REQ-ML-05](analysis-monthly-limit.md#req-ml-05) | P1 | PASS |
| TC-API-099 | Nulový limit je limitom (R7, R8) | `L = 0` pri `T = 0`, potom pri `T > 0` | `reached`, potom `exceeded` so zostatkom `−T` | [REQ-ML-05](analysis-monthly-limit.md#req-ml-05) | P1 | PASS |
| TC-API-100 | Najmenší kladný limit | `L = 1` v prázdnom mesiaci | `within`, zostáva jeden cent | [REQ-ML-05](analysis-monthly-limit.md#req-ml-05) | P2 | PASS |
| TC-API-101 | Limit nikdy neblokuje uloženie | Vytvoriť výdavok nad limitom | 201; súčet aj stav sa zmenia; nič sa neodmietne | [REQ-ML-06](analysis-monthly-limit.md#req-ml-06) | P1 | PASS |
| TC-API-102 | Neplatné limity | −1, 12.5, `"12000"`, `true`, strop + 1 | každý 400 `VALIDATION_FAILED`; následný `GET` ukáže nezmenený limit | [REQ-ML-07](analysis-monthly-limit.md#req-ml-07) | P1 | PASS |
| TC-API-103 | Presne strop | `L` = 100 000 000 | 200, uložené presne | [REQ-ML-07](analysis-monthly-limit.md#req-ml-07) | P2 | PASS |
| TC-API-104 | Limit patrí jednému účtu | Druhý účet nastaví vlastný limit | Každý číta svoj; ani jeden nevidí cudzí | [REQ-ML-08](analysis-monthly-limit.md#req-ml-08) | P1 | PASS |
| TC-API-105 | Bez tokenu | `GET` a `PUT /settings` bez hlavičky | oba 401 | [REQ-ML-08](analysis-monthly-limit.md#req-ml-08) | P1 | PASS |


<a id="database--the-limit-column-migration--qadbmigrationtestjs"></a>

## Databáza · Migrácia stĺpca limitu · `qa/db/migration.test.js`

Jediná aktualizácia, ktorú táto funkcia robí na existujúcej databáze.
Každá iná vrstva začína s prázdnym súborom, kde `CREATE TABLE`
už obsahuje stĺpec a chránený `ALTER TABLE` v `src/db.js`
sa nikdy nespustí — preto sú tieto tri prípady jediné,
ktoré preverujú kód aktualizujúci používanú databázu.
Každý vytvorí vlastnú dočasnú databázu v podobe pred limitom
a potom ju zmaže; nič v `data/` sa nemení.

| ID | Prípad | Kroky | Očakávané | Väzba na | Pri | Stav |
|---|---|---|---|---|---|---|
| TC-DB-001 | Stará databáza získa stĺpec | Vytvoriť databázu s tabuľkou `settings` pred limitom, účtom a uloženým príjmom; spustiť na nej databázovú vrstvu | Stĺpec existuje a je nullable; príjem bez zmeny; limit číta `null` — „nenastavený“, nie nula | [REQ-CORE-28](../../spec/core-requirements.md#req-core-28) | P1 | PASS |
| TC-DB-002 | Opakovaný štart je bezpečný | Spustiť, uložiť limit, spustiť ešte dvakrát, zrušiť limit | Stĺpec sa pridá raz; každý štart uspeje; uložený limit prežije ďalší štart; zrušenie vráti `null` | [REQ-CORE-28](../../spec/core-requirements.md#req-core-28) | P1 | PASS |
| TC-DB-003 | Obe cesty končia rovnakou tabuľkou | Porovnať `table_info(settings)` aktualizovanej databázy s novou podľa súčasnej schémy | Rovnaké stĺpce, typy a nullability | [REQ-CORE-28](../../spec/core-requirements.md#req-core-28) | P2 | PASS |

<a id="python-api-scenarios--qapythontest_apipy"></a>

## Scenáre API v Pythone · `qa/python/test_api.py`

Doplnková vrstva, nie druhá kópia kolekcie Newman (`D-032`).
Cez fixtúru vlastní dočasnú databázu, proces, port a tajomstvo,
potom používa nezávislého HTTP klienta pre triedy vstupov
a nižšie uvedené stavové toky.

| ID | Prípad | Kroky | Očakávané | Väzba na | Pri | Stav |
|---|---|---|---|---|---|---|
| TC-PY-001 | Parametrizovaná validácia transakcií | Poslať varianty bez hodnoty, zápornú, nulovú, desatinnú, reťazcovú, logickú a chybný dátum | Každá trieda vracia JSON 400, nikdy INTERNAL | [REQ-CORE-06](../../spec/core-requirements.md#req-core-06); [REQ-CORE-07](../../spec/core-requirements.md#req-core-07) | P1 | PASS |
| TC-PY-002 | Chybný JSON zostáva podľa kontraktu | Poslať neúplné telo JSON do transakcií | JSON 400, nie HTML ani 500 | [REQ-CORE-16](../../spec/core-requirements.md#req-core-16) | P1 | PASS |
| TC-PY-003 | Odmietané podoby tokenu | Zavolať chránenú trasu bez tokenu, s chybným, poškodeným a skutočne expirovaným | Každá podoba vracia 401 | [REQ-CORE-02](../../spec/core-requirements.md#req-core-02) | P1 | PASS |
| TC-PY-004 | Izolácia čítania a zmeny medzi používateľmi | Vlastník vytvorí výdavok; iný používateľ ho vypíše, upraví a zmaže | Riadok je v zozname neviditeľný; PATCH a DELETE vracajú 404, nikdy 403 | [REQ-CORE-04](../../spec/core-requirements.md#req-core-04) | P1 | PASS |
| TC-PY-005 | Životný cyklus výdavku | Nastaviť príjem; vytvoriť, čiastočne upraviť, prečítať súhrn a zmazať výdavok | Upravené centy sú v súhrne a zostatku; zmazanie vráti súčet na nulu | [REQ-CORE-06](../../spec/core-requirements.md#req-core-06); [REQ-CORE-09](../../spec/core-requirements.md#req-core-09); [REQ-CORE-15](../../spec/core-requirements.md#req-core-15) | P1 | PASS |
| TC-PY-006 | Stavový životný cyklus pôžičky | Vytvoriť pôžičku s dvoma splátkami; dvakrát zaplatiť; skúsiť tretiu platbu | Aktívna → dokončená s počtom 0; tretia platba je 409 | [REQ-CORE-13](../../spec/core-requirements.md#req-core-13) | P1 | PASS |

<a id="python--request-id-and-request-log--qapythontest_request_logpy"></a>

## Python · ID požiadavky a jej log · `qa/python/test_request_log.py`

Tieto prípady spustia vlastný server so zapnutým logom požiadaviek
a výstupom do súborov, takže každý vytlačený riadok sa prečíta
(docs/support).

| ID | Prípad | Kroky | Očakávané | Väzba na | Pri | Stav |
|---|---|---|---|---|---|---|
| TC-PY-007 | Každá odpoveď nesie ID požiadavky | 200, 400 chybný JSON, 401, 404 a 503 od vypnutej AI | Každá má `X-Request-Id` ako malé UUID, všetky odlišné; každé chybové telo je stále presne `{error:{code,message}}` | [REQ-CORE-24](../../spec/core-requirements.md#req-core-24) | P1 | PASS |
| TC-PY-008 | ID volajúceho sa zachová len ako UUID | Poslať platné ID, potom príliš krátke, príliš dlhé, veľké písmená, medzery, markup a hodnoty rozbíjajúce JSON | Platné sa zopakuje; každé iné nahradí nové UUID a nikdy nie je v logu | [REQ-CORE-24](../../spec/core-requirements.md#req-core-24) | P1 | PASS |
| TC-PY-009 | Jeden riadok na požiadavku s názvom trasy | Vytvoriť, upraviť a vypísať výdavky; zavolať bez tokenu a neznámu cestu | Po jednom riadku s časom, úrovňou, ID požiadavky, metódou, vzorom trasy, stavom, trvaním a ID používateľa; `/api/transactions/:id`, nikdy ID riadka alebo query | [REQ-CORE-24](../../spec/core-requirements.md#req-core-24) | P1 | PASS |
| TC-PY-010 | V logu nie sú prihlasovacie údaje ani obsah | Registrovať sa, prihlásiť, neúspešne sa prihlásiť, uložiť poznámku, poslať opis AI | E-mail, heslá, tokeny, poznámka ani opis sa neobjavia; bez `Bearer` a hlavičky Authorization | [REQ-CORE-24](../../spec/core-requirements.md#req-core-24) | P1 | PASS |
| TC-PY-011 | Nezachytená chyba zachová ID požiadavky | Iné spojenie drží zámok databázy na zápis, potom sa uloží výdavok | 500 s nezmeneným telom INTERNAL; jeden riadok `UNHANDLED` s rovnakým ID požiadavky, `SQLITE_BUSY` a stackom | [REQ-CORE-24](../../spec/core-requirements.md#req-core-24) | P1 | PASS |
| TC-PY-012 | Riadok konceptu AI používa rovnaké ID | Poslať koncept pri vypnutej AI | Riadok `ai_draft` aj riadok požiadavky majú ID z odpovede | [REQ-CORE-24](../../spec/core-requirements.md#req-core-24) | P2 | PASS |
| TC-PY-013 | Tichý prepínač | Spustiť server s `WALLET_REQUEST_LOG=off` a poslať požiadavky | Každá odpoveď stále má ID; riadky požiadaviek sa nepíšu | [REQ-CORE-24](../../spec/core-requirements.md#req-core-24) | P2 | PASS |


<a id="python--sql-diagnostics--qapythontest_sql_diagnosticspy"></a>

## Python · Diagnostika SQL · `qa/python/test_sql_diagnostics.py`

Dopyty sa čítajú z `docs/support/sql-diagnostics.md` a vykonávajú
na pripojení iba na čítanie k databáze servera danej relácie,
do ktorej zapisovala aplikácia.

| ID | Prípad | Kroky | Očakávané | Väzba na | Pri | Stav |
|---|---|---|---|---|---|---|
| TC-PY-014 | Každý zdokumentovaný dopyt je bezpečné spustiť | Spustiť každý blok stránky na pripojení odmietajúcom zápisy | Každý je jeden `SELECT`, ktorého placeholdery zodpovedajú zdokumentovaným parametrom, a vracia presne zdokumentované stĺpce | [REQ-CORE-25](../../spec/core-requirements.md#req-core-25) | P1 | PASS |
| TC-PY-015 | Dopyty na mesiac a limit súhlasia so súhrnom | Získať ID používateľa podľa neúhľadne napísaného e-mailu; porovnať mesačný súčet a stav limitu troch účtov | Rovnaký súčet a stav ako `GET /api/summary`; *bez settings*, *bez limitu* a *nulový limit* sa odlišujú podľa tabuľky na stránke | [REQ-CORE-25](../../spec/core-requirements.md#req-core-25); [REQ-ML-05](analysis-monthly-limit.md#req-ml-05) | P1 | PASS |
| TC-PY-016 | Platby, kľúče a kvóta znamenajú to, čo stránka tvrdí | Pôžička dvakrát zaplatená so zmazaným výdavkom jednej platby; uloženie s kľúčom raz zopakované a iné zmazané; AI vypnutá | 2 zaplatené, 1 prepojený, 1 neprepojený; jeden riadok na kľúč, `live` a `tombstone`; bez riadkov kvóty | [REQ-CORE-25](../../spec/core-requirements.md#req-core-25); [REQ-CORE-10](../../spec/core-requirements.md#req-core-10); [REQ-CORE-13](../../spec/core-requirements.md#req-core-13) | P2 | PASS |

<a id="python--log-reading-exercise--qapythontest_log_exercisepy"></a>

## Python · Cvičenie čítania logu · `qa/python/test_log_exercise.py`

Vypracovaná odpoveď v `docs/support/log-exercise.md` cituje log,
ktorý `scripts/support-exercise.js` pri každom behu znovu vytvorí
s novými ID.

| ID | Prípad | Kroky | Očakávané | Väzba na | Pri | Stav |
|---|---|---|---|---|---|---|
| TC-PY-017 | Cvičenie presne cituje svoj log | Prečítať citované riadky stránky a commitnutý log | Každý citovaný riadok je riadkom logu; referencia prvej otázky je jediné 500 v logu s vlastným riadkom `UNHANDLED`; v logu nie je priečinok počítača ani e-mailová adresa | [REQ-CORE-24](../../spec/core-requirements.md#req-core-24) | P2 | PASS |

<a id="selenium--browser-checks--qaselenium"></a>

## Selenium · kontroly prehliadača · `qa/selenium/`

Druhá, menšia browserová vrstva v Pythone: Selenium WebDriver
s pytest a Page Objects popri sade Playwright, nie namiesto nej.
Dáta vznikajú cez API s novým účtom pre každý test; prehliadač
robí iba testované správanie.

| ID | Prípad | Kroky | Očakávané | Väzba na | Pri | Stav |
|---|---|---|---|---|---|---|
| TC-SEL-001 | Registrovať cez formulár | Vytvoriť účet na prihlasovacej obrazovke | Prihlásenie na obrazovke Add s kategóriami nového účtu; Month ukazuje €0.00 bez riadkov | [REQ-CORE-02](../../spec/core-requirements.md#req-core-02); [REQ-CORE-22](../../spec/core-requirements.md#req-core-22) | P1 | PASS |
| TC-SEL-002 | Nesprávne heslo ukáže referenciu | Prihlásiť sa nesprávnym heslom | *E-mail or password is incorrect.* a 8-znaková referencia z úvodu `X-Request-Id` odpovede 401, prečítaná zo sieťového logu Chrome | [REQ-CORE-24](../../spec/core-requirements.md#req-core-24) | P1 | PASS |
| TC-SEL-003 | Výdavok uložený cez klávesnicu pribudne v mesiaci | Jeden výdavok cez API; zadať 7.40 na klávesnici, vybrať Groceries, pridať poznámku a uložiť | Súčet narastie presne o €7.40 a nový riadok ukazuje poznámku, kategóriu a sumu | [REQ-CORE-18](../../spec/core-requirements.md#req-core-18); [REQ-CORE-19](../../spec/core-requirements.md#req-core-19) | P1 | PASS |
| TC-SEL-004 | Stavový rámček sleduje limit | Pod, presne na a nad limitom, po jednom behu | Biely obrys bez výplne, keď rozpočet zostáva; plná červená s bielym textom po vyčerpaní; *Limit reached* pri rovnosti bez triedy „over“; číslo limitu bez rámčeka | [REQ-ML-05](analysis-monthly-limit.md#req-ml-05); [REQ-CORE-26](../../spec/core-requirements.md#req-core-26) | P1 | PASS |
| TC-SEL-005 | Zrušiť limit z obrazovky | Vymazať pole limitu a uložiť | Ponúkne sa *Set limit*, stavový rámček zmizne, číslo limitu je bez rámčeka a API hlási `null` | [REQ-ML-10](analysis-monthly-limit.md#req-ml-10) | P2 | PASS |
| TC-SEL-006 | BUG-015 cez obrazovku | Upraviť iba poznámku nezaradeného výdavku | Uložené; riadok zostane *Uncategorised*; API má novú poznámku a null kategóriu | [REQ-CORE-09](../../spec/core-requirements.md#req-core-09); [BUG-015](../../log/BUGS.md) | P1 | PASS |
| TC-SEL-007 | Uhradiť splátku pôžičky | Pôžička s troma splátkami; jednu zaplatiť na Upcoming | *3 of 3 left · €150.00* sa zmení na *2 of 3 left · €100.00*; API počíta 1 zaplatenú a 2 zostávajúce | [REQ-CORE-13](../../spec/core-requirements.md#req-core-13); [REQ-CORE-20](../../spec/core-requirements.md#req-core-20) | P1 | PASS |
| TC-SEL-008 | TC-SEL-003 v šírke telefónu | Rovnaké kroky s emuláciou stránky pri 375 px | Rovnaký výsledok | [REQ-CORE-22](../../spec/core-requirements.md#req-core-22) | P2 | PASS |

<a id="load--qaload"></a>

## Záťaž · `qa/load/`

Merané, nie pocitovo tvrdené: každý beh zaznamenáva `GET /api/health`
v pokoji **aj** pod záťažou; zistením je rozdiel (R6).

| ID | Prípad | Kroky | Očakávané | Väzba na | Pri | Stav |
|---|---|---|---|---|---|---|
| TC-LOAD-001 | Súbežné zápisy | 50 používateľov zapisuje výdavky 30 s | Bez 5xx, `SQLITE_BUSY` a stratených zápisov. Health zostane pod 250 ms na p95 | [LIMIT-001](../../log/BUGS.md) | P1 | PASS |
| TC-LOAD-002 | Vlna neúspešných prihlásení | 20 spojení posiela nesprávne heslá 15 s | Health zostane pod 250 ms na p95 počas pokusov | [REQ-CORE-17](../../spec/core-requirements.md#req-core-17); [BUG-004](../../log/BUGS.md) | P1 | PASS |
| TC-LOAD-003 | Prihlásenia povolené limiterom | 5 súbežných nesprávnych hesiel na serveri s vypnutým limiterom | Health zostane pod 100 ms na p95 — zaznamenaný zvyšok BUG-004, teraz uzavretý | [BUG-004](../../log/BUGS.md) | P1 | PASS |


<a id="end-to-end--authentication--qae2eauthspecjs"></a>

## End-to-end · Autentifikácia · `qa/e2e/auth.spec.js`

| ID | Prípad | Kroky | Očakávané | Väzba na | Pri | Stav |
|---|---|---|---|---|---|---|
| TC-E2E-001 | Registrovať cez formulár | Vyplniť a odoslať v režime registrácie | Otvorí Add; predvyplnené dlaždice a navigácia viditeľné | [REQ-CORE-02](../../spec/core-requirements.md#req-core-02); [REQ-CORE-22](../../spec/core-requirements.md#req-core-22) | P1 | PASS |
| TC-E2E-002 | Prihlásiť sa znovu | Vyčistiť reláciu, obnoviť, prihlásiť sa | Vráti do aplikácie | [REQ-CORE-02](../../spec/core-requirements.md#req-core-02) | P1 | PASS |
| TC-E2E-003 | Nesprávne heslo | Odoslať nesprávne heslo | Chybový toast, zostáva na prihlásení, bez relácie | [REQ-CORE-02](../../spec/core-requirements.md#req-core-02); [REQ-CORE-16](../../spec/core-requirements.md#req-core-16) | P1 | PASS |
| TC-E2E-004 | Prázdny formulár | Odoslať obe polia prázdne | `Enter both an e-mail and a password`, nič sa neodošle | [REQ-CORE-02](../../spec/core-requirements.md#req-core-02); [REQ-CORE-22](../../spec/core-requirements.md#req-core-22) | P3 | PASS |
| TC-E2E-005 | Uložená relácia | Token v lokálnom úložisku, otvoriť `/` | Aplikácia sa otvorí priamo | [REQ-CORE-02](../../spec/core-requirements.md#req-core-02); [REQ-CORE-22](../../spec/core-requirements.md#req-core-22) | P2 | PASS |
| TC-E2E-073 | Priveľmi dlhé heslo sa odmietne v prehliadači | Registrovať so 73 znakmi | Toast uvádza limit 72 bajtov a **neodošle sa žiadna požiadavka** | [REQ-CORE-03](../../spec/core-requirements.md#req-core-03); [BUG-017](../../log/BUGS.md) | P2 | PASS |
| TC-E2E-074 | Aj prehliadač počíta bajty | Registrovať s 37 × `é` | Odmietne rovnako, hoci heslo má 37 znakov — pravidlo klienta súhlasí so serverom | [REQ-CORE-03](../../spec/core-requirements.md#req-core-03); [BUG-017](../../log/BUGS.md) | P2 | PASS |
| TC-E2E-083 | Chyba vstupu nemá referenciu | Odoslať prázdny prihlasovací formulár | Správa sa zobrazí bez referencie, lebo nebola požiadavka | [REQ-CORE-24](../../spec/core-requirements.md#req-core-24) | P3 | PASS |

<a id="end-to-end--adding-an-expense--qae2eadd-expensespecjs"></a>

## End-to-end · Pridanie výdavku · `qa/e2e/add-expense.spec.js`

| ID | Prípad | Kroky | Očakávané | Väzba na | Pri | Stav |
|---|---|---|---|---|---|---|
| TC-E2E-006 | **Definícia hotového** — dve kliknutia a uloženie | Zadať 1250, kliknúť na kategóriu, Save, otvoriť Month | `€12.50`; úspešný toast; suma a výber sa vynulujú; mesačný súčet `€12.50` s jedným riadkom | [REQ-CORE-18](../../spec/core-requirements.md#req-core-18) | P1 | PASS |
| TC-E2E-007 | Klávesnica a vymazanie | Stlačiť 9, 9, 9 a potom C | `€0.09` → `€0.99` → `€9.99` → `€0.00` | [REQ-CORE-18](../../spec/core-requirements.md#req-core-18) | P2 | PASS |
| TC-E2E-008 | Uloženie bez sumy | Kliknúť na kategóriu, uložiť | `Enter an amount` | [REQ-CORE-06](../../spec/core-requirements.md#req-core-06); [REQ-CORE-18](../../spec/core-requirements.md#req-core-18) | P2 | PASS |
| TC-E2E-009 | Uloženie bez kategórie | Zadať sumu, uložiť | `Choose a category` | [REQ-CORE-18](../../spec/core-requirements.md#req-core-18) | P2 | PASS |
| TC-E2E-010 | Dva výdavky, dve kategórie | Pridať oba, otvoriť Month | Súčet sa rovná ich sume; dva riadky a dva stĺpce | [REQ-CORE-19](../../spec/core-requirements.md#req-core-19) | P1 | PASS |
| TC-E2E-039 | Poznámka sa stane názvom riadka | Pridať 40 € do Other s poznámkou "new tyre" | Riadok má `new tyre` a pod ním `Other` — zmysel D-020 | [REQ-CORE-19](../../spec/core-requirements.md#req-core-19) | P1 | PASS |
| TC-E2E-040 | Poznámka sa po uložení vyčistí | Uložiť výdavok s poznámkou | Pole je prázdne, takže sa nepripojí k ďalšiemu výdavku | [REQ-CORE-19](../../spec/core-requirements.md#req-core-19) | P1 | PASS |
| TC-E2E-041 | Výdavok bez poznámky ukáže kategóriu | Uložiť bez poznámky | Riadok použije ako náhradný názov kategóriu | [REQ-CORE-19](../../spec/core-requirements.md#req-core-19) | P2 | PASS |
| TC-E2E-011 | Každá dlaždica má čitateľný názov | Nájsť každú predvolenú kategóriu podľa roly a názvu | Všetky sa nájdu podľa roly **aj** testid | [REQ-CORE-22](../../spec/core-requirements.md#req-core-22) | P2 | PASS |


<a id="end-to-end--income-and-the-donut--qae2eincomespecjs"></a>

## End-to-end · Príjem a donut · `qa/e2e/income.spec.js`

Overuje sa aritmetika, nie obrázok. Donut sa ľahko nakreslí
jemne nesprávne a ťažko sa overuje; čísla vedľa neho nie.

| ID | Prípad | Kroky | Očakávané | Väzba na | Pri | Stav |
|---|---|---|---|---|---|---|
| TC-E2E-031 | Nový účet sa pýta, nevymýšľa si | Otvoriť Month v novom účte | `Set income` a `—` namiesto zostatku — nie `€0.00 left` | [REQ-CORE-14](../../spec/core-requirements.md#req-core-14); [REQ-CORE-19](../../spec/core-requirements.md#req-core-19) | P1 | PASS |
| TC-E2E-032 | Nastavený príjem ukáže zostatok | Nastaviť 1500.00 pri už minutých €125.50 | Príjem €1,500.00, minuté €125.50, zostáva €1,374.50 | [REQ-CORE-15](../../spec/core-requirements.md#req-core-15) | P1 | PASS |
| TC-E2E-033 | Príjem sa ukladá, nie pamätá v prehliadači | Nastaviť, obnoviť stránku | Stále tam je — prežije prehliadač | [REQ-CORE-14](../../spec/core-requirements.md#req-core-14) | P1 | PASS |
| TC-E2E-034 | Prekročený príjem hlási Over | Minúť €600 oproti €500 | Štítok je `Over`, hodnota €100.00 | [REQ-CORE-15](../../spec/core-requirements.md#req-core-15) | P1 | PASS |
| TC-E2E-035 | Zrušenie nič nemení | Otvoriť editor, písať, zrušiť | Pôvodné číslo zostáva | [REQ-CORE-14](../../spec/core-requirements.md#req-core-14); [REQ-CORE-19](../../spec/core-requirements.md#req-core-19) | P2 | PASS |
| TC-E2E-036 | Chybný príjem sa odmietne | Napísať "a lot", uložiť | Chybový toast, príjem bez zmeny | [REQ-CORE-14](../../spec/core-requirements.md#req-core-14) | P2 | PASS |
| TC-E2E-042 | Výdavky bez nastaveného príjmu | Pridať výdavok, otvoriť Month bez nastavenia príjmu | `Set income`, zostatok `—`, donut stále vykreslí výdavok | [REQ-CORE-14](../../spec/core-requirements.md#req-core-14); [REQ-CORE-15](../../spec/core-requirements.md#req-core-15) | P2 | PASS |
| TC-E2E-043 | Príjem bez výdavkov | Nastaviť príjem v prázdnom mesiaci | Zostáva celý príjem, bez oblúkov | [REQ-CORE-14](../../spec/core-requirements.md#req-core-14); [REQ-CORE-15](../../spec/core-requirements.md#req-core-15) | P2 | PASS |
| TC-E2E-044 | Minúť **presne** príjem | Minúť €500 oproti €500 | Štítok zostáva `Left`, číslo je `€0.00` — nie `Over €0.00`. Hranica medzi riadkami 4 a 6 | [REQ-CORE-14](../../spec/core-requirements.md#req-core-14); [REQ-CORE-15](../../spec/core-requirements.md#req-core-15) | P1 | PASS |
| TC-E2E-037 | Jeden oblúk na kategóriu | Dve kategórie s výdavkami | Dva výseky, každý dostupný cez ID kategórie | [REQ-CORE-19](../../spec/core-requirements.md#req-core-19) | P2 | PASS |
| TC-E2E-038 | Prázdny mesiac nič nekreslí | Otvoriť Month v novom účte | Donut existuje, nula výsekov, bez pádu | [REQ-CORE-19](../../spec/core-requirements.md#req-core-19) | P2 | PASS |

<a id="end-to-end--this-month--qae2emonthspecjs"></a>

## End-to-end · Tento mesiac · `qa/e2e/month.spec.js`

| ID | Prípad | Kroky | Očakávané | Väzba na | Pri | Stav |
|---|---|---|---|---|---|---|
| TC-E2E-012 | Súčet, stĺpce a zoznam súhlasia | Dva výdavky cez API, otvoriť Month | Súčet je ich suma; riadok a stĺpec pre každú kategóriu | [REQ-CORE-19](../../spec/core-requirements.md#req-core-19) | P1 | PASS |
| TC-E2E-013 | Stĺpce nesú podiel | €75.00 a €25.00 | `75%` a `25%` v prístupných názvoch stĺpcov | [REQ-CORE-19](../../spec/core-requirements.md#req-core-19) | P2 | PASS |
| TC-E2E-014 | Zmazať výdavok | Kliknúť na ovládanie zmazania jedného riadka | Riadok zmizne, druhý zostane, súčet klesne presne o danú sumu | [REQ-CORE-09](../../spec/core-requirements.md#req-core-09); [REQ-CORE-19](../../spec/core-requirements.md#req-core-19) | P1 | PASS |
| TC-E2E-015 | Prázdny mesiac | Otvoriť Month v novom účte | `€0.00`, bez riadkov a stĺpcov | [REQ-CORE-19](../../spec/core-requirements.md#req-core-19) | P2 | PASS |
| TC-E2E-016 | Výdavky iného používateľa sú neviditeľné | Vymeniť reláciu za druhý účet | `€0.00`, bez riadkov | [REQ-CORE-04](../../spec/core-requirements.md#req-core-04) | P1 | PASS |
| TC-E2E-081 | Najväčšia suma na obrazovke 320 px | Výdavok na strope sumy, viewport 320 × 568, otvoriť Month | Vykreslený názov a suma sa neprekrývajú; suma je `€1,000,000.00`, nie je orezaná a zostáva v riadku | [REQ-CORE-19](../../spec/core-requirements.md#req-core-19); [REQ-CORE-22](../../spec/core-requirements.md#req-core-22) | P2 | PASS |
| TC-E2E-065 | Limit a zostatok sú na obrazovke | Limit €200.00, minúť €50.00, otvoriť Month | Limit je €200.00; stavový riadok hovorí *Within limit* a €150.00 | [REQ-ML-09](analysis-monthly-limit.md#req-ml-09) | P1 | PASS |
| TC-E2E-066 | Nad limitom vyjadrujú slová, nie iba farba | Limit €100.00, minúť €125.00 | Stavový riadok hovorí *Over limit* s €25.00 a nesie triedu over | [REQ-ML-09](analysis-monthly-limit.md#req-ml-09); [REQ-CORE-26](../../spec/core-requirements.md#req-core-26) | P1 | PASS |
| TC-E2E-067 | Nastaviť limit z obrazovky | Zadať 60.00 v editore limitu a uložiť | Limit aj stav sa zmenia bez obnovenia stránky; API súhlasí | [REQ-ML-10](analysis-monthly-limit.md#req-ml-10) | P1 | PASS |
| TC-E2E-068 | Zrušiť limit z obrazovky | Vymazať pole a uložiť | Obrazovka znova ponúka nastavenie, stavový riadok zmizne, API hlási `null` | [REQ-ML-10](analysis-monthly-limit.md#req-ml-10) | P2 | PASS |
| TC-E2E-069 | Hodnota, ktorá nie je číslom | Zadať "not a number" a uložiť | Chybový toast; zobrazený aj uložený limit zostáva | [REQ-ML-10](analysis-monthly-limit.md#req-ml-10) | P2 | PASS |
| TC-E2E-076 | Bez limitu a bez rámčeka | Žiadny limit, otvoriť Month | Stavový riadok je skrytý a nemá ani jednu triedu rámčeka | [REQ-CORE-26](../../spec/core-requirements.md#req-core-26) | P2 | PASS |
| TC-E2E-077 | Zostávajúci rozpočet: biely obrys | Limit €200.00, minúť €50.00 | Bez výplne; biely obrys, nie červený, s kontrastom aspoň 3:1 voči obom koncom gradientu hlavičky | [REQ-CORE-26](../../spec/core-requirements.md#req-core-26) | P2 | PASS |
| TC-E2E-078 | Presne na limite | Limit €100.00, minúť €100.00 | Rámček je červený s bielym textom, lebo nič nezostáva; slová sú *Limit reached* a chýba trieda over — rovnosť nie je prekročenie | [REQ-CORE-26](../../spec/core-requirements.md#req-core-26); [REQ-ML-05](analysis-monthly-limit.md#req-ml-05) | P1 | PASS |
| TC-E2E-079 | Nad limitom: biela na plnej červenej | Limit €100.00, minúť €125.00 | Plná výplň červenou z palety; tučný biely text s kontrastom aspoň 4.5:1; trieda over | [REQ-CORE-26](../../spec/core-requirements.md#req-core-26) | P1 | PASS |
| TC-E2E-080 | Svetlá paleta | Nenačítať `theme.css`, aby sa vykreslila vlastná paleta `style.css`; pod limitom, potom nad ním | Biely obrys aspoň 3:1 voči hlavičke, potom biely text aspoň 4.5:1 na červenej | [REQ-CORE-26](../../spec/core-requirements.md#req-core-26) | P2 | PASS |
| TC-E2E-084 | Číslo limitu nikdy nemá rámček | Jeden účet prejde od nulového limitu cez stav pod, presne na a nad limitom | Číslo limitu nemá okraj v žiadnom stave; čísla príjmu, zostatku a limitu ostávajú na mieste | [REQ-CORE-26](../../spec/core-requirements.md#req-core-26) | P1 | PASS |
| TC-E2E-085 | Rámček sa zmestí na telefón | Najväčší limit bez zmeny, potom nulový limit s desiatimi výdavkami na strope; 320, 375 a 393 px | Každý rámček zostane v hlavičke, text sa neoreže a stránka sa neposúva vodorovne | [REQ-CORE-26](../../spec/core-requirements.md#req-core-26) | P2 | PASS |


<a id="end-to-end--schedules--qae2eschedulesspecjs"></a>

## End-to-end · Plány · `qa/e2e/schedules.spec.js`

| ID | Prípad | Kroky | Očakávané | Väzba na | Pri | Stav |
|---|---|---|---|---|---|---|
| TC-E2E-017 | Vytvoriť predplatné | Vyplniť formulár bez zaškrtnutia políčka | Úspešný toast, jeden riadok s názvom | [REQ-CORE-21](../../spec/core-requirements.md#req-core-21) | P2 | PASS |
| TC-E2E-018 | Checkbox je jediná vetva | Zaškrtnúť a odškrtnúť `Je to pôžička` | `total_count` skryté → viditeľné → skryté | [REQ-CORE-21](../../spec/core-requirements.md#req-core-21) | P2 | PASS |
| TC-E2E-019 | Pôžička hneď ukáže odpočítavanie | Vytvoriť pôžičku s 10 splátkami | `10 of 10 left · €1,000.00` | [REQ-CORE-11](../../spec/core-requirements.md#req-core-11); [REQ-CORE-20](../../spec/core-requirements.md#req-core-20) | P1 | PASS |
| TC-E2E-020 | Deň 31 sa prijme a vysvetlí | Zadať deň 12, potom 31; uložiť s februárovým začiatkom | Pomocný text len pre dni nad 28; ďalšia platba je posledný februárový deň | [REQ-CORE-12](../../spec/core-requirements.md#req-core-12); [REQ-CORE-21](../../spec/core-requirements.md#req-core-21) | P1 | PASS |
| TC-E2E-021 | Chybná suma | `not a number` | `Amount must be a number, for example 15.00`, nič sa nevytvorí | [REQ-CORE-11](../../spec/core-requirements.md#req-core-11); [REQ-CORE-21](../../spec/core-requirements.md#req-core-21) | P2 | PASS |
| TC-E2E-022 | Deň mimo 1–31 | Deň 32 | `Day of month must be between 1 and 31`, nič sa nevytvorí | [REQ-CORE-11](../../spec/core-requirements.md#req-core-11); [REQ-CORE-21](../../spec/core-requirements.md#req-core-21) | P2 | PASS |
| TC-E2E-023 | Plán vytvorený cez API sa zobrazí | Vytvoriť cez API, otvoriť obrazovku | Názov, suma a `Subscription` na riadku | [REQ-CORE-11](../../spec/core-requirements.md#req-core-11); [REQ-CORE-21](../../spec/core-requirements.md#req-core-21) | P2 | PASS |
| TC-E2E-075 | Pôžička dlhšia, než aplikácia podporuje | Zaškrtnúť pôžičku, žiadať 1201 splátok | Toast uvádza strop 1200, nič sa nevytvorí a **neodošle sa požiadavka** | [REQ-CORE-11](../../spec/core-requirements.md#req-core-11); [BUG-018](../../log/BUGS.md) | P2 | PASS |

<a id="end-to-end--upcoming-and-payment--qae2eupcomingspecjs"></a>

## End-to-end · Nadchádzajúce a platba · `qa/e2e/upcoming.spec.js`

| ID | Prípad | Kroky | Očakávané | Väzba na | Pri | Stav |
|---|---|---|---|---|---|---|
| TC-E2E-024 | Pôžička odpočítava a uzavrie sa | Trikrát zaplatiť pôžičku s 3 splátkami | `3 of 3` → `2 of 3` → `1 of 3` → **`0 of 3`**; dokončený stav; tlačidlo platby zmizne | [REQ-CORE-13](../../spec/core-requirements.md#req-core-13); [REQ-CORE-20](../../spec/core-requirements.md#req-core-20) | P1 | PASS |
| TC-E2E-025 | Predplatné sa nikdy nedokončí | Raz zaplatiť predplatné | Stále platiteľné, stále `Subscription`, bez dokončeného stavu | [REQ-CORE-11](../../spec/core-requirements.md#req-core-11); [REQ-CORE-20](../../spec/core-requirements.md#req-core-20) | P2 | PASS |
| TC-E2E-026 | Platba zaznamená výdavok | Zaplatiť, potom otvoriť Month | Mesačný súčet narastie o splátku; riadok nesie názov plánu | [REQ-CORE-13](../../spec/core-requirements.md#req-core-13) | P1 | PASS |
| TC-E2E-027 | Uzavretá pôžička opustí Upcoming | Uzavrieť, obnoviť | Nie je v zozname | [REQ-CORE-13](../../spec/core-requirements.md#req-core-13); [REQ-CORE-20](../../spec/core-requirements.md#req-core-20) | P2 | PASS |
| TC-E2E-028 | Poradie podľa ďalšej platby | Dva plány, dni 1 a 28 | Poradie na obrazovke súhlasí s `next_due` v API | [REQ-CORE-20](../../spec/core-requirements.md#req-core-20) | P2 | PASS |
| TC-E2E-029 | Tlačidlo platby hovorí, za čo platí | Nájsť podľa roly a názvu | Nájde sa ako `Pay Netflix` | [REQ-CORE-20](../../spec/core-requirements.md#req-core-20); [REQ-CORE-22](../../spec/core-requirements.md#req-core-22) | P2 | PASS |
| TC-E2E-082 | Odmietnutá platba ukáže referenciu | Uzavrieť pôžičku mimo obrazovky, stlačiť Pay | `X-Request-Id` odpovede 409 sa číta z prenosu; toast zachová správu a ukáže pri nej prvých osem znakov ID | [REQ-CORE-24](../../spec/core-requirements.md#req-core-24) | P1 | PASS |


<a id="end-to-end--double-submission--qae2edouble-submitspecjs"></a>

## End-to-end · Dvojité odoslanie · `qa/e2e/double-submit.spec.js`

| ID | Prípad | Kroky | Očakávané | Väzba na | Pri | Stav |
|---|---|---|---|---|---|---|
| TC-E2E-045 | Dve rýchle uloženia výdavku | Stlačiť Save dvakrát pred dokončením prvej požiadavky | Existuje presne jeden výdavok; ovládanie sa vypne synchrónne | [REQ-CORE-27](../../spec/core-requirements.md#req-core-27); [LIMIT-002](../../log/BUGS.md) | P1 | PASS |
| TC-E2E-046 | Opakované odoslanie plánu | Vo formulári plánu dvakrát stlačiť Enter | Existuje presne jeden plán | [REQ-CORE-27](../../spec/core-requirements.md#req-core-27); [LIMIT-002](../../log/BUGS.md) | P1 | PASS |
| TC-E2E-047 | Zámerný druhý výdavok | Uložiť, počkať na dokončenie, potom uložiť znovu | Existujú dva riadky — samostatné úkony sa nesmú deduplikovať | [REQ-CORE-27](../../spec/core-requirements.md#req-core-27); [LIMIT-002](../../log/BUGS.md) | P2 | PASS |

<a id="end-to-end--editing--qae2eeditingspecjs"></a>

## End-to-end · Úpravy · `qa/e2e/editing.spec.js`

| ID | Prípad | Kroky | Očakávané | Väzba na | Pri | Stav |
|---|---|---|---|---|---|---|
| TC-E2E-048 | Úprava sumy aktualizuje všetky mesačné pohľady | Zmeniť sumu výdavku | Riadok, súčet a donut sa zmenia konzistentne | [REQ-CORE-09](../../spec/core-requirements.md#req-core-09); [REQ-CORE-19](../../spec/core-requirements.md#req-core-19) | P1 | PASS |
| TC-E2E-049 | Čiastočná úprava zachová ostatné polia | Zmeniť jednu hodnotu v editore | Nezmenené polia si ponechajú predchádzajúce hodnoty | [REQ-CORE-09](../../spec/core-requirements.md#req-core-09); [REQ-CORE-19](../../spec/core-requirements.md#req-core-19) | P1 | PASS |
| TC-E2E-050 | Zrušiť úpravu | Otvoriť editor, zmeniť hodnotu, zrušiť | Riadok zostáva nezmenený | [REQ-CORE-09](../../spec/core-requirements.md#req-core-09); [REQ-CORE-19](../../spec/core-requirements.md#req-core-19) | P2 | PASS |
| TC-E2E-051 | Zmazané inde počas úpravy | Pred Save zmazať riadok cez API | UI hlási konflikt a obnoví sa | [REQ-CORE-09](../../spec/core-requirements.md#req-core-09); [REQ-CORE-16](../../spec/core-requirements.md#req-core-16) | P1 | PASS |
| TC-E2E-052 | Odmietnutá úprava zachová stav editora | Poslať sumu odmietnutú API | Editor zostane otvorený a uložený riadok bez zmeny | [REQ-CORE-09](../../spec/core-requirements.md#req-core-09); [REQ-CORE-16](../../spec/core-requirements.md#req-core-16) | P1 | PASS |
| TC-E2E-053 | Klávesnica otvorí editor | Zamerať riadok a použiť klávesovú akciu | Otvorí sa rovnaký editor bez ukazovateľa | [REQ-CORE-22](../../spec/core-requirements.md#req-core-22) | P2 | PASS |
| TC-E2E-070 | Úprava iba poznámky nezaradeného výdavku | Vytvoriť výdavok bez kategórie; zmeniť len poznámku | PATCH nesie poznámku a vôbec nie `category_id`; riadok zostane *Uncategorised* | [REQ-CORE-09](../../spec/core-requirements.md#req-core-09); [REQ-CORE-19](../../spec/core-requirements.md#req-core-19); [BUG-015](../../log/BUGS.md) | P1 | PASS |
| TC-E2E-071 | Uloženie nezmeneného nezaradeného výdavku | Otvoriť editor a uložiť bez dotyku | Výber kategórie je prázdny (*Uncategorised*) a **neodošle sa požiadavka** | [REQ-CORE-09](../../spec/core-requirements.md#req-core-09); [BUG-015](../../log/BUGS.md) | P2 | PASS |
| TC-E2E-072 | Platba z nezaradeného plánu | Zaplatiť plán bez kategórie, potom upraviť poznámku vytvoreného výdavku | Ako TC-E2E-070: v PATCH nie je `category_id` | [REQ-CORE-09](../../spec/core-requirements.md#req-core-09); [REQ-CORE-13](../../spec/core-requirements.md#req-core-13); [BUG-015](../../log/BUGS.md) | P2 | PASS |

<a id="end-to-end--pagination--qae2epaginationspecjs"></a>

## End-to-end · Stránkovanie · `qa/e2e/pagination.spec.js`

| ID | Prípad | Kroky | Očakávané | Väzba na | Pri | Stav |
|---|---|---|---|---|---|---|
| TC-E2E-054 | Mesiac s jednou stránkou | Vytvoriť najviac 50 výdavkov | Ovládanie stránkovania sa neukazuje | [REQ-CORE-08](../../spec/core-requirements.md#req-core-08) | P2 | PASS |
| TC-E2E-055 | Jeden riadok nad stránku | Vytvoriť 51 výdavkov | Ukáže sa ovládanie „viac“ a poctivý počet | [REQ-CORE-08](../../spec/core-requirements.md#req-core-08) | P1 | PASS |
| TC-E2E-056 | Starý strop 200 riadkov | Vytvoriť 201 výdavkov a prejsť stránkami | Všetky riadky sú dostupné a súčet súhlasí | [REQ-CORE-08](../../spec/core-requirements.md#req-core-08) | P1 | PASS |
| TC-E2E-057 | Zmazať po stránkovaní | Načítať viac strán, potom zmazať riadok | Počet aj zostávajúce riadky sú konzistentné | [REQ-CORE-08](../../spec/core-requirements.md#req-core-08) | P1 | PASS |

<a id="end-to-end--free-text-safety--qae2esecurityspecjs"></a>

## End-to-end · Bezpečnosť voľného textu · `qa/e2e/security.spec.js`

| ID | Prípad | Kroky | Očakávané | Väzba na | Pri | Stav |
|---|---|---|---|---|---|---|
| TC-E2E-058 | Poznámka výdavku so script tagom | Uložiť poznámku obsahujúcu script tag | Payload sa vykreslí ako text a nespustí sa | [REQ-CORE-23](../../spec/core-requirements.md#req-core-23) | P1 | PASS |
| TC-E2E-059 | Poznámka výdavku s event handlerom | Uložiť payload v štýle image/onerror | Payload sa vykreslí ako text a nespustí sa | [REQ-CORE-23](../../spec/core-requirements.md#req-core-23) | P1 | PASS |
| TC-E2E-060 | Poznámka výdavku s uzatváracím tagom | Uložiť closing-tag/script payload | Payload sa vykreslí ako text a nespustí sa | [REQ-CORE-23](../../spec/core-requirements.md#req-core-23) | P1 | PASS |
| TC-E2E-061 | Názov plánu so script tagom | Uložiť plán so skriptovým payloadom | Názov sa vykreslí ako text a nespustí sa | [REQ-CORE-23](../../spec/core-requirements.md#req-core-23) | P1 | PASS |
| TC-E2E-062 | Voľný text prežije úpravu | Previesť payload editorom a späť | Uložený text zostane nezmenený a nikdy sa nespustí | [REQ-CORE-23](../../spec/core-requirements.md#req-core-23); [REQ-CORE-09](../../spec/core-requirements.md#req-core-09) | P1 | PASS |

<a id="end-to-end--regressions--qae2eregressionsspecjs"></a>

## End-to-end · Regresie · `qa/e2e/regressions.spec.js`

Každý prípad sa volá po chybe, ktorú stráži. Každý preukázateľne
zlyhal po jej opätovnom zavedení — pozri S05.

| ID | Prípad | Kroky | Očakávané | Väzba na | Pri | Stav |
|---|---|---|---|---|---|---|
| TC-REG-001 | Tlačidlo Save je čitateľné | Prečítať **vypočítanú** farbu a účinné pozadie tlačidla; vypočítať pomer WCAG | Farby sa líšia **a** kontrast ≥ 4.5:1. Najprv sa overí `toBeVisible()` a `toHaveText()` — nimi BUG-001 prechádzal, hoci tlačidlo bolo neviditeľné | [REQ-CORE-18](../../spec/core-requirements.md#req-core-18); [BUG-001](../../log/BUGS.md) | P1 | PASS |
| TC-REG-002 | Počítadlo po poslednej splátke ukazuje nulu | Zaplatiť 2-splátkovú pôžičku do konca | `0 of 2 left · €0.00`, dokončený stav, tlačidlo platby zmizne | [REQ-CORE-13](../../spec/core-requirements.md#req-core-13); [BUG-002](../../log/BUGS.md) | P1 | PASS |
| TC-REG-003 | Tlačidlo platby sa po odmietnutí obnoví | Uzavrieť pôžičku mimo obrazovky, potom stlačiť Pay | Toast konfliktu; tlačidlo späť na `Pay` a zapnuté | [REQ-CORE-20](../../spec/core-requirements.md#req-core-20); [BUG-003](../../log/BUGS.md) | P1 | PASS |

---


<a id="contract-checks--openapi-and-real-http"></a>

## Kontraktové kontroly · OpenAPI a skutočné HTTP

Automatizuje [qa/contract/contract.test.js](../../../../qa/contract/contract.test.js).
Väzby nižšie používajú [požiadavky kontraktových kontrol](../../docs/api/README.md#requirements-for-the-contract-checks),
ktoré overujú existujúce API namiesto pridávania funkcií.
Výsledky a matica pozorovaných/nespustených stavov sú v
[lokálnom kontraktovom reporte](test-report-contract.md).
Jedenásť pomenovaných testov nie je 244 testovacích prípadov:
HTTP požiadavky aj pripravujú a overujú spoločný testovací stav.

| ID | Požiadavka a kontrola | Výsledok |
|---|---|---|
| TC-CONTRACT-001 | [REQ-CONTRACT-02](../../docs/api/README.md#req-contract-02), [REQ-CONTRACT-04](../../docs/api/README.md#req-contract-04): prísny Ajv, formáty, bez mutácie či zdedeného prostredia poskytovateľa | Lokálne PASS |
| TC-CONTRACT-002 | [REQ-CONTRACT-01](../../docs/api/README.md#req-contract-01), [REQ-CONTRACT-05](../../docs/api/README.md#req-contract-05): inventár zdroja/kontraktu; kontroly chýbajúcej/nesprávnej metódy a nepodporovaného skenera | Lokálne PASS |
| TC-CONTRACT-003 | [REQ-CONTRACT-03](../../docs/api/README.md#req-contract-03): health/ID požiadavky, registrácia, chyby JSON a chýbajúca autentifikácia každej chránenej operácie | Lokálne PASS |
| TC-CONTRACT-004 | [REQ-CONTRACT-03](../../docs/api/README.md#req-contract-03): trim/konverzia kategórie, null/nula/hranice, prísny PATCH a vlastníctvo | Lokálne PASS |
| TC-CONTRACT-005 | [REQ-CONTRACT-03](../../docs/api/README.md#req-contract-03): nastavenia a všetky štyri nezávislé stavy celkového/kategóriového rozpočtu | Lokálne PASS |
| TC-CONTRACT-006 | [REQ-CONTRACT-03](../../docs/api/README.md#req-contract-03): výdavok/filter/úprava, opakovanie s kľúčom/konflikty/snapshot a prázdne 204 | Lokálne PASS |
| TC-CONTRACT-007 | [REQ-CONTRACT-03](../../docs/api/README.md#req-contract-03): platba predplatného/pôžičky, dokončenie/opätovné otvorenie, hranice a vlastníctvo | Lokálne PASS |
| TC-CONTRACT-008 | [REQ-CONTRACT-03](../../docs/api/README.md#req-contract-03), [REQ-CONTRACT-04](../../docs/api/README.md#req-contract-04): AI vypnutá/demo, hranice NFC/tela/dátumu, kontext/kvóta a žiadny zápis výdavku | Lokálne PASS |
| TC-CONTRACT-009 | [REQ-CONTRACT-03](../../docs/api/README.md#req-contract-03): úspešné/odmietnuté prihlásenie/limit frekvencie a Retry-After | Lokálne PASS |
| TC-CONTRACT-010 | [REQ-CONTRACT-02](../../docs/api/README.md#req-contract-02), [REQ-CONTRACT-05](../../docs/api/README.md#req-contract-05): osem kontrol poškodenia skopírovaných skutočných zachytení; presné originály zachované | Lokálne PASS |
| TC-CONTRACT-011 | [REQ-CONTRACT-04](../../docs/api/README.md#req-contract-04), [REQ-CONTRACT-06](../../docs/api/README.md#req-contract-06): pozorované 2xx na každú zdrojovú operáciu, kontrola matice iba s 401, pravdivé množiny stavov a súkromie logu | Lokálne PASS |

<a id="totals"></a>

## Súhrnné počty

| Vrstva | Prípady | Behy | Stav |
|---|---|---|---|
| API — 271 požiadaviek, 939 asercí | 141 | 271 | lokálne PASS, 2026-09-28 |
| Databáza — prídavné migrácie, node:test | 6 | 6 | lokálne PASS, 2026-09-28 |
| Python — 17 zdokumentovaných scenárov, 27 položiek pytest | 17 | 27 | lokálne PASS, 2026-09-28 |
| Selenium — 9 zdokumentovaných scenárov, 11 položiek pytest | 9 | 11 | lokálne PASS, 2026-09-28 |
| Záťaž — 3 scenáre, vynucované prahy | 3 | 3 | historický PASS; v regresii limitov kategórií sa nespúšťalo znovu |
| End-to-end — 93 testov × 2 rozmery | 93 | 186 | lokálne PASS, 2026-09-28 |
| Kontrakt — 11 pomenovaných testov, 244 skutočných HTTP kontrol | 11 | 11 | lokálne PASS, 2026-09-28; bez tvrdenia o živej AI či novom CI |
| **Spolu** | **280** | **515** | **512 súčasných lokálnych vykonaní + 3 historické záťažové vykonania; nie nové GitHub CI** |

Prípady sú jedinečné aktívne ID v prvej bunke tabuľky
po odstránení tučných značiek a vyradených prečiarknutých riadkov.
E2E90 + REG3 tvoria 93 browserových prípadov. Prípady/hodnotenie AI
a iterácie pretekov sú registrované osobitne a nepridávajú sa
do súčtu vykonaní tohto základného katalógu.

**Počty sa overujú voči sadám, nie vypisujú z pamäti.**
Skorší počet tvrdil 138 prípadov, hoci existovalo len 135 riadkov;
tri prípady (TC-E2E-039…041) mali úspešné testy a tu vôbec nemali riadky.

**TC-E2E-030 je vyradený, nie chýbajúci.** Pokrýval odmietnutú
platbu a po vytvorení regresného súboru v S05 sa stal TC-REG-003.
Číslo sa znova nepoužije: opakovanie ID by spôsobilo,
že starý výsledok označuje iný prípad.

Sedem prípadov (TC-API-087…090, TC-E2E-042…044) existuje preto,
že funkcia príjmu prešla cez `qa/docs/test-design.md` **po**
vydaní. Žiadny nenašiel chybu; všetkých sedem sú triedy
pomenované postupom, ktoré človek pri ručnom písaní vynechal.

Dvadsať prípadov mesačného limitu (TC-API-091…105,
TC-E2E-065…069) vzniklo opačne: z požiadaviek a rozhodovacej
tabuľky v [`analysis-monthly-limit.md`](analysis-monthly-limit.md)
pred existenciou funkcie. Každý najprv zlyhal a potom prešiel —
lokálne v relácii, ktorá ich napísala; tento beh sa nedá
reprodukovať z histórie a
[`test-report-monthly-limit.md`](test-report-monthly-limit.md) §2
to výslovne uvádza.

TC-DB-001…003 prišli neskôr z medzery, nie z požiadavky:
chránený `ALTER TABLE` aktualizujúci používanú databázu
bol jediným riadkom funkcie, ktorý žiadna vrstva nevykonala.
Vypnutie ochrany zlyhá vo všetkých troch, čo môže ktokoľvek
reprodukovať.

API prípadov je 141, no Newman vykoná 271 požiadaviek.
Dva dôvody, ani jeden neznamená prípad bez riadka:
prípad môže potrebovať viac požiadaviek na prípravu stavu,
ktorý potom overí, a TC-API-068 je jedna požiadavka
opakovaná pre každý povolený pokus.

Sledovateľnosť: bunky katalógu teraz citujú
[verejný index základných pravidiel](../../spec/core-requirements.md),
analýzu [mesačných](analysis-monthly-limit.md) a
[kategóriových](analysis-category-limits.md) limitov,
[požiadavky kontraktových kontrol](../../docs/api/README.md#requirements-for-the-contract-checks)
alebo pomenovaný [záznam chyby/limitu](../../log/BUGS.md).
Mapovanie nedokazuje sémantickú zhodu ani pokrytie vykonaním;
samostatný [register AI](ai-test-plan.md#4-case-register-tc-ai)
a predbežný [syntetický import](analysis-synthetic-import.md)
sú mimo jeho obojstranného rozsahu. Tri regresné prípady
boli opätovne overené voči chybám, ktoré strážia. Štrnásť
prípadov napísaných pre BUG-015, BUG-017 a BUG-018
sa spustilo po odstránení ich opravy: prípady reprodukujúce
chybu zlyhali, TC-API-106 a TC-API-109 držiace prijatú
stranu nového limitu prešli, ako mali.


<a id="category-limit-database-migration"></a>

## Migrácia databázy pre limity kategórií

Automatizuje [migration.test.js](../../../../qa/db/migration.test.js).
Priorita P1; všetky tri PASS lokálne 2026-09-28 popri
pôvodných troch migračných prípadoch.

| Prípad | Požiadavka | Očakávaný výsledok |
|---|---|---|
| TC-DB-004 | [REQ-CL-13](analysis-category-limits.md#req-cl-13) | Staré riadky kategórií zachovajú ID, vlastníka, názov a ikonu; nový nullable limit je NULL |
| TC-DB-005 | [REQ-CL-13](analysis-category-limits.md#req-cl-13) | Opakovaný štart nepridá duplicitný stĺpec a zachová uloženú nulu |
| TC-DB-006 | [REQ-CL-13](analysis-category-limits.md#req-cl-13) | Stĺpce novej/aktualizovanej databázy sú rovnaké; CHECK odmietne záporný priamy SQL zápis |

<a id="category-limit-browser-checks"></a>

## Kontroly limitov kategórií v prehliadači

Automatizuje [category-limits.spec.js](../../../../qa/e2e/category-limits.spec.js).
Všetkých osem PASS lokálne 2026-09-28 v oboch rozmeroch.
Priorita P1 pre peniaze a Nezaradené, P2 pre rozloženie,
klávesnicu a prezentáciu chýb. Zmrazená
[analýza](analysis-category-limits.md) určuje očakávané správanie.

| Prípad | Väzba na | Očakávané |
|---|---|---|
| TC-E2E-086 | [REQ-CL-01](analysis-category-limits.md#req-cl-01), [REQ-CL-02](analysis-category-limits.md#req-cl-02), [REQ-CL-10](analysis-category-limits.md#req-cl-10), [REQ-CL-12](analysis-category-limits.md#req-cl-12) | Editor prevedie 60.00 na 6000; predvyplnenie, zrušenie, nesúvisiace nastavenia zachované |
| TC-E2E-087 | [REQ-CL-11](analysis-category-limits.md#req-cl-11); CR4/6/7/8 | Slová, biely obrys, červená výplň a kontrast textu >=4.5; bez rámčeka bez limitu |
| TC-E2E-088 | [REQ-CL-02](analysis-category-limits.md#req-cl-02), [REQ-CL-07](analysis-category-limits.md#req-cl-07), [REQ-CL-12](analysis-category-limits.md#req-cl-12); CR3/5/9 | Rozpočet bez výdavkov viditeľný; nula je skutočná; zrušenie skryje; bez prázdneho výseku donutu/NaN |
| TC-E2E-089 | [REQ-CL-04](analysis-category-limits.md#req-cl-04), [REQ-CL-12](analysis-category-limits.md#req-cl-12) | Neplatný vstup a Cancel nič neodošlú, zachovajú hodnotu |
| TC-E2E-090 | [REQ-CL-09](analysis-category-limits.md#req-cl-09); CR1 | Nezaradené prispieva k výdavkom, no neponúka limit/editor |
| TC-E2E-091 | [REQ-CL-11](analysis-category-limits.md#req-cl-11), [REQ-CL-12](analysis-category-limits.md#req-cl-12) | Dlhé názvy, maximálne sumy, rámčeky a editor sa zmestia pri 320px |
| TC-E2E-092 | [REQ-CL-12](analysis-category-limits.md#req-cl-12) | Focus vstupu, udržanie klávesnice, Escape vráti otvárací prvok |
| TC-E2E-093 | [REQ-CL-12](analysis-category-limits.md#req-cl-12) | Odmietnuté uloženie zostane otvorené, hodnota bez zmeny, bez úspešného toastu |

<a id="category-limit-selenium-check"></a>

## Kontrola limitov kategórií v Selenium

Automatizuje [test_limit.py](../../../../qa/selenium/test_limit.py);
priorita P1, PASS lokálne 2026-09-28 pri všetkých
jedenástich zelených vykonaniach Selenium.

| Prípad | Väzba na | Očakávané |
|---|---|---|
| TC-SEL-009 | [REQ-CL-11](analysis-category-limits.md#req-cl-11), [REQ-CL-12](analysis-category-limits.md#req-cl-12) | Nastaviť 60.00, vidieť reached, zrušiť; uložené centy a nezávislý celkový limit potvrdené |

<a id="category-limit-api-contract-and-decisions"></a>

## Kontrakt API a rozhodnutia limitov kategórií

Automatizuje priečinok 13 v
[kolekcii Postman](../../../../qa/api/wallet.postman_collection.json).
Celý lokálny beh vykonal 271 požiadaviek / 939 asercí
bez zlyhania pred integráciou prehliadača. Záverečný
kombinovaný beh zopakoval rovnaké počty bez zlyhaní,
2026-09-28. Priorita P1 pre peniaze/vlastníctvo;
P2 pre chybný vstup a hranice tela/cesty.


| Prípad | Väzba na | Očakávané |
|---|---|---|
| TC-API-114 | [REQ-CL-06](analysis-category-limits.md#req-cl-06), [REQ-CL-07](analysis-category-limits.md#req-cl-07); CR2/3 | Nové kategórie majú NULL; prázdne riadky bez rozpočtu sú skryté |
| TC-API-115 | [REQ-CL-01](analysis-category-limits.md#req-cl-01) | Nastaviť 20000; GET vráti limit a pôvodný názov |
| TC-API-116 | [REQ-CL-01](analysis-category-limits.md#req-cl-01); CR5 | Nahradiť aktuálnu hodnotu; bez výdavkov je pod limitom |
| TC-API-117 | [REQ-CL-01](analysis-category-limits.md#req-cl-01), [REQ-CL-10](analysis-category-limits.md#req-cl-10); CR9/10 | Nula je skutočná, pri nule reached a po platnom uložení exceeded |
| TC-API-118 | [REQ-CL-02](analysis-category-limits.md#req-cl-02); CR4 | Výslovné NULL zruší a riadok s kladnými výdavkami je not_set |
| TC-API-119 | [REQ-CL-03](analysis-category-limits.md#req-cl-03) | Prázdne, neznáme a serverom vlastnené polia odmietnuté; bez zmeny |
| TC-API-120 | [REQ-CL-04](analysis-category-limits.md#req-cl-04) | Nesprávne typy, záporná, desatinná hodnota a strop+1 odmietnuté |
| TC-API-121 | [REQ-CL-04](analysis-category-limits.md#req-cl-04) | Presný strop 100000000 prijatý |
| TC-API-122 | [REQ-CL-04](analysis-category-limits.md#req-cl-04), [REQ-CL-05](analysis-category-limits.md#req-cl-05) | Chybné ID v ceste 400; chýbajúca kategória kanonicky 404 |
| TC-API-123 | [REQ-CL-05](analysis-category-limits.md#req-cl-05) | Chýbajúca autentifikácia 401 |
| TC-API-124 | [REQ-CL-05](analysis-category-limits.md#req-cl-05) | Cudzie ID rovnaké 404; hodnota vlastníka bez zmeny |
| TC-API-125 | [REQ-CL-05](analysis-category-limits.md#req-cl-05) | GET kategórie a súhrn izolované podľa vlastníka |
| TC-API-126 | [REQ-CL-06](analysis-category-limits.md#req-cl-06); CR5/7/8 | L=1 pri T=0/1/2 dá within/reached/exceeded |
| TC-API-127 | [REQ-CL-06](analysis-category-limits.md#req-cl-06); CR6/11 | L=100, T=1 dá within a zostatok 99 |
| TC-API-128 | [REQ-CL-06](analysis-category-limits.md#req-cl-06); CR7 | Rovnosť je reached, zostatok nula |
| TC-API-129 | [REQ-CL-06](analysis-category-limits.md#req-cl-06); CR8 | O cent nad limitom, záporný zostatok |
| TC-API-130 | [REQ-CL-06](analysis-category-limits.md#req-cl-06); CR10 | L=0 s kladnými výdavkami je exceeded |
| TC-API-131 | [REQ-CL-07](analysis-category-limits.md#req-cl-07); CR5 | Nulové riadky s limitom prítomné, zoradené po výdavkoch; súčet platí |
| TC-API-132 | [REQ-CL-08](analysis-category-limits.md#req-cl-08); CR13 | Nezaplatený plán sa vynechá |
| TC-API-133 | [REQ-CL-08](analysis-category-limits.md#req-cl-08); CR12 | Zaplatená splátka sa zahrnie |
| TC-API-134 | [REQ-CL-09](analysis-category-limits.md#req-cl-09); CR1 | NULL kategória je vždy not_set; prispieva k celkovému súčtu |
| TC-API-135 | [REQ-CL-03](analysis-category-limits.md#req-cl-03), [REQ-CL-06](analysis-category-limits.md#req-cl-06), [REQ-CL-08](analysis-category-limits.md#req-cl-08), [REQ-CL-10](analysis-category-limits.md#req-cl-10); CR15 | Súčet kategórií nad celkovým limitom sa prijme; nastavenia/zápisy nezávislé |
| TC-API-136 | [REQ-CL-10](analysis-category-limits.md#req-cl-10) | Výdavok nad oboma limitmi sa uloží s 201 |
| TC-API-137 | [REQ-CL-06](analysis-category-limits.md#req-cl-06); CR16 | Úprava presunie výdavky kategórie; zmazanie prepočíta stav |
| TC-API-138 | [REQ-CL-06](analysis-category-limits.md#req-cl-06); CR14 | Iný mesiac sa vynechá; historický súhrn používa aktuálny limit |
| TC-API-139 | [REQ-CL-02](analysis-category-limits.md#req-cl-02), [REQ-CL-07](analysis-category-limits.md#req-cl-07); CR3/4 | Zrušenie skryje nulový riadok, zachová kladný ako not_set |
| TC-API-140 | [REQ-CL-04](analysis-category-limits.md#req-cl-04) | Chybný a neobjektový JSON 400, nie 500 |
| TC-API-141 | [REQ-CL-04](analysis-category-limits.md#req-cl-04) | Priveľké telo 413; odmietnuté telá zachovajú hodnotu |
