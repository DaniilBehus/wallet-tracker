[English](../../../spec/ai-expense-entry.md) · **Slovenčina**

<!-- locale-links-v1: source-relative links rebased for locales/sk -->

<!-- Original English heading anchors retained for stable cross-language references. -->
<a id="wallet--ai-expense-entry--feature-contract"></a>
# Wallet · AI zadanie výdavku — kontrakt funkcie

[← Späť na README](../README.md#ai-expense-entry) · [Ďalej: plán testov AI →](../qa/docs/ai-test-plan.md)

Stav: ACTIVE od 2026-09-14.

Tento súbor je normatívny pre danú funkciu. `spec/architecture.md` §§1, 4, 5 a 7 poskytujú okolité rozhodnutia o produkte, API, rozhraní a rozsahu. Pri rozpore s testovacím plánom má prednosť tento súbor.

---

<a id="1-what-it-is"></a>
## 1. Čo to je

Voliteľný druhý spôsob zadania výdavku na obrazovke Add. Človek napíše krátky opis **jedného už zaplateného výdavku v EUR**. Server vráti **upraviteľný návrh**. Nič sa neuloží, kým človek návrh neskontroluje a nestlačí **Save expense**, ktoré používa bežné `POST /api/transactions`.

Jazykový model je extraktor bez právomocí: žiadne nástroje, SQL, história ani schopnosť ukladať, mazať, platiť, plánovať alebo meniť príjem.

Vstupné jazyky v1: angličtina, ukrajinčina, slovenčina. Ruština/transliterácia sú len prieskumné. Mimo rozsahu: OCR, hlas, viac výdavkov, konverzia mien, príjem, refundácie, prevody, rozvrhy, pamäť chatu, RAG a volanie nástrojov.

<a id="2-rules-acceptance-ids"></a>
## 2. Pravidlá (akceptačné ID)

| ID | Pravidlo |
|---|---|
| <a id="ai-r01"></a>AI-R01 | Parsovanie nikdy nevytvorí ani nezmení finančný záznam |
| <a id="ai-r02"></a>AI-R02 | Každé uloženie je výslovná akcia po upraviteľnej kontrole návrhu |
| <a id="ai-r03"></a>AI-R03 | Zadanie klávesnicou funguje aj pri vypnutom, nedostupnom, obmedzenom alebo nesprávne nastavenom AI |
| <a id="ai-r04"></a>AI-R04 | Presne jeden dokončený výdavok; viacero sa nikdy nezlučuje ani nesčítava |
| <a id="ai-r05"></a>AI-R05 | Chýbajúca alebo nejednoznačná suma zostáva prázdna; nič sa nevymýšľa |
| <a id="ai-r06"></a>AI-R06 | Sumy sa prevádzajú z reťazcov číslic na celočíselné centy |
| <a id="ai-r07"></a>AI-R07 | Iba EUR; výslovná iná mena nie je podporovaná a nikdy sa neprepočítava |
| <a id="ai-r08"></a>AI-R08 | Relatívne dátumy používajú overený referenčný dátum a kalendárne pravidlá |
| <a id="ai-r09"></a>AI-R09 | Chýbajúci dátum sa viditeľne predvolí na dnešok; nerozpoznaný dátum nikdy nie |
| <a id="ai-r10"></a>AI-R10 | Návrhy kategórií pochádzajú iba z vlastných kategórií používateľa |
| <a id="ai-r11"></a>AI-R11 | Neznáma kategória zostáva nevybraná |
| <a id="ai-r12"></a>AI-R12 | Bežné logy neobsahujú vstupný text, telo poskytovateľa, autentifikačnú hlavičku ani kľúč |
| <a id="ai-r13"></a>AI-R13 | Predvolené testy a PR CI nevykonávajú skutočné sieťové volania |
| <a id="ai-r14"></a>AI-R14 | Odmietnutie, skrátenie, neplatný výstup, timeout a zlyhanie poskytovateľa sú odlíšené |
| <a id="ai-r15"></a>AI-R15 | Úprava, zrušenie, odhlásenie alebo odchod zneplatní čakajúcu požiadavku |
| <a id="ai-r16"></a>AI-R16 | Opakovanie jedného potvrdeného uloženia nemôže vložiť druhý výdavok |
| <a id="ai-r17"></a>AI-R17 | Dva zámerné rovnaké nákupy zostávajú dvoma výdavkami |
| <a id="ai-r18"></a>AI-R18 | Limity sa vynucujú pred každým volaním poskytovateľa aj pri súbehu |
| <a id="ai-r19"></a>AI-R19 | Ovládateľné klávesnicou, funguje pri 320×568 a zodpovedá existujúcemu štýlu |
| <a id="ai-r20"></a>AI-R20 | Reporty oddeľujú chyby modelu, odmietnutie aplikáciou a chybu prenosu |
| <a id="ai-r21"></a>AI-R21 | Tvrdenia o funkcii neprekračujú dôkazy jej testov a reportov |

<a id="3-modes"></a>
## 3. Režimy

`WALLET_AI_MODE` = `off` (predvolené) · `demo` · `live`.

- **off** — poskytovateľ sa vôbec nevytvorí; informácia o dostupnosti hlási vypnutie.
- **demo** — iba cez `npm run ai:demo`, ktorý nainštaluje syntetické odpovede z fixtures pre malú pomenovanú množinu príkladových viet. Všetko ostatné vráti `unsupported` s `DEMO_UNSUPPORTED`. Nastavenie `WALLET_AI_MODE=demo` na bežnom serveri **nič** nezapne: fixtures sú v `qa/`. Demo runner zvyšuje denné/minútové stropy, pretože nevolá platenú službu; samotný obmedzovač stále funguje (D-036).
- **live** — zapne sa iba pri súčasnej prítomnosti `OPENAI_API_KEY`, `WALLET_AI_MODEL` a `WALLET_AI_LIVE_ALLOWED=true`. Chýbajúce predpoklady vypnú funkciu bez pádu Wallet. Live nikdy automaticky neprejde na demo.

`WALLET_AI_PROVIDER` = `openai` (predvolené, aj pri prázdnej hodnote) · `gemini` (D-040).

- **openai** — jediný poskytovateľ, ktorého aplikácia môže použiť v režime live.
- **gemini** — Gemini Free, iba pre syntetický vyhodnocovací korpus (`qa/ai/evaluate.js --live`). Aplikácia ho nikdy nevytvorí bez ohľadu na kľúč, model alebo prepínač: funkcia sa vypne a požiadavka na návrh dostane `503 AI_UNAVAILABLE` s pevnou správou "The Gemini test provider is for synthetic evaluation only and does not accept real financial records; enter the expense manually".
- Iná hodnota nič nezapne. Poskytovateľ nikdy automaticky nenahradí iného a kľúč jedného nesplní predpoklady druhého.

<a id="4-endpoints-both-behind-requireauth"></a>
## 4. Endpointy (oba za `requireAuth`)

<a id="41-get-apiaicapabilities--200"></a>
### 4.1 `GET /api/ai/capabilities` → 200

```json
{ "enabled": false, "mode": "off", "provider": null, "max_input_chars": 500,
  "languages": ["en", "uk", "sk"], "requires_external_consent": false }
```

`provider` je `"OpenAI"` v live, `"demo"` v demo a `null` pri vypnutí alebo nedostupnosti (vrátane `WALLET_AI_PROVIDER=gemini`, D-040). `requires_external_consent` je true iba v live. Nikdy sa nevracajú názvy tajomstiev, kvóty, detaily účtu ani URL.

<a id="42-post-apiaiexpense-draft"></a>
### 4.2 `POST /api/ai/expense-draft`

Požiadavka — presne tieto kľúče, žiadne iné:

| Kľúč | Pravidlo |
|---|---|
| `text` | povinný reťazec, nie iba medzery, najviac 500 Unicode kódových bodov po NFC |
| `reference_date` | povinné `YYYY-MM-DD`, najviac jeden kalendárny deň od dneška v lokálnom čase servera |
| `locale` | voliteľné `en` · `uk` · `sk` · `auto` (predvolené `auto`) |
| `consent_to_external_processing` | voliteľný boolean; v live musí byť `true` |

Surové telo JSON tejto cesty nesmie prekročiť 8 KiB.

Úspech → **200**:

```json
{
  "request_id": "uuid",
  "mode": "live",
  "status": "ready | needs_input | unsupported",
  "draft": { "amount_cents": 1800, "category_id": 12, "spent_on": "2026-09-13", "note": "обід" },
  "provenance": { "amount": "source", "category": "suggested", "date": "source",
                  "currency": "source", "note": "source" },
  "issues": [ { "field": "date", "code": "DATE_DEFAULTED", "severity": "info" } ],
  "versions": { "schema": "1", "prompt": "1", "normalizer": "2" }
}
```

Každé pole návrhu môže byť `null`. Hodnoty pôvodu: `source` (doslovný text nájdený v opise), `suggested` (odvodenie kategórie), `default` (EUR / dnešok), `none`. Odpovede `unsupported` majú všetky polia návrhu `null`.

<a id="43-status-precedence-and-errors"></a>
### 4.3 Poradie stavových kontrol a chyby

Poradie kontrol; každý krok pred 7 dokazuje nula volaní poskytovateľa:

1. JSON parser (veľkosť, syntax) — rovnako ako v celej aplikácii
2. autentifikácia
3. tvar požiadavky, dĺžka, bajty tela, referenčný dátum
4. zapnutý režim
5. súhlas (live)
6. hranice kontextu kategórií
7. miesto v obmedzovači súbehu a následne atomická rezervácia kvóty
8. volanie poskytovateľa
9. validácia výstupu poskytovateľa
10. deterministická normalizácia

| HTTP | Kód | Kedy |
|---|---|---|
| 400 | VALIDATION_FAILED | nesprávny tvar, kľúče, typy, dĺžka alebo bajty tela |
| 400 | REFERENCE_DATE_MISMATCH | referenčný dátum je viac než jeden deň od dneška na serveri |
| 401 | UNAUTHORIZED | existujúce zlyhanie autentifikácie |
| 403 | AI_CONSENT_REQUIRED | live požiadavka bez `consent_to_external_processing: true` |
| 413 | PAYLOAD_TOO_LARGE | ľubovoľná cesta, ktorej JSON prekročí limit parsera (uzatvára BUG-019) |
| 422 | AI_CONTEXT_TOO_LARGE | viac než 100 kategórií alebo 8 000 UTF-8 bajtov názvov |
| 429 | AI_RATE_LIMITED | lokálna kvóta alebo súbeh, s `Retry-After` |
| 502 | AI_INVALID_RESPONSE | neplatný tvar, neznámy odkaz na kategóriu, porušenie pôvodu alebo skrátenie |
| 502 | AI_PROVIDER_FAILED | HTTP/sieťové zlyhanie poskytovateľa, presmerovanie alebo chyba konfigurácie |
| 503 | AI_UNAVAILABLE | režim off alebo chýbajúce predpoklady live |
| 503 | AI_PROVIDER_BUSY | poskytovateľ vrátil 429/503 |
| 504 | AI_TIMEOUT | prekročený časový limit poskytovateľa |

**Odmietnutie modelom** je výsledok 200 `unsupported` s `MODEL_REFUSED`, nikdy text odmietnutia. Chybové telá zachovávajú `{error:{code,message}}` s pevnými správami; telo poskytovateľa sa nikdy nevracia ani neloguje.

<a id="5-provider-output-untrusted"></a>
## 5. Výstup poskytovateľa (nedôveryhodný)

Presne tieto kľúče, všetky prítomné, pri absencii `null`, žiadne ďalšie:

| Kľúč | Typ |
|---|---|
| `intent` | `expense` · `multiple_expenses` · `non_expense` · `unclear` |
| `language` | `en` · `uk` · `sk` · `other` · `mixed` · `unknown` |
| `amount_text` | reťazec ≤ 40 alebo null |
| `currency_text` | reťazec ≤ 24 alebo null |
| `date_text` | reťazec ≤ 60 alebo null |
| `category_ref` | jeden z odkazov tejto požiadavky (`c0`…`c99`) alebo null |
| `note_text` | reťazec ≤ 200 alebo null |

Každé nenulové `*_text` musí byť doslovným podreťazcom opisu normalizovaného NFC. `amount_text` musí navyše pomenovať celý jeden číselný token opisu (`18` vnútri `180` je porušenie) po odstránení značiek meny na jeho okrajoch — `"18 €"`, `"€18"` a `"18"` pomenúvajú rovnaký token (D-036). Porušenia sú 502.

Model nikdy neposkytuje centy, dátumy, ID ani vysvetlenia. Všetky konečné hodnoty odvodzuje server.

<a id="6-deterministic-guards-independent-of-the-model"></a>
## 6. Deterministické ochrany (nezávislé od modelu)

Server sám prehľadáva opis. Ochrana môže výsledok urobiť len **bezpečnejším** (ready → needs_input → unsupported), nikdy naopak.

**Unsupported** bez ohľadu na výstup modelu: výslovná mena iná ako EUR (`USD $ GBP £ CZK Kč UAH ₴ грн CHF PLN zł HUF Ft`, dollar/dolár/долар/гривн…); dve alebo viac súm označených menou; budúci zámer (`tomorrow`, `zajtra`, `завтра`, `will`, `буду`, `budem`…); jednoduchý zápor (`did not`, `didn't`, `не купив`, `nekúpil`…); slová príjmu/refundácie/prevodu/opakovania (`salary`, `refund`, `transfer`, `every month`, `зарплата`, `повернення`, `переказ`, `щомісяця`, `výplata`, `vrátenie`, `prevod`, `každý mesiac`…); zámer modelu iný než `expense`/`unclear`.

**Suma** — peňažné tokeny sú číslice s voliteľnými oddeľovačmi skupín po troch (medzera, U+00A0, U+202F) a voliteľnou desatinnou časťou s `.`/`,`.

| Vstup | Výsledok |
|---|---|
| `18`, `18.5`, `18,50`, `1 234,56`, `1 234.56` | presné centy |
| `≤ 0`, `> 1 000 000.00` | `INVALID_AMOUNT` / `AMOUNT_OUT_OF_RANGE`, suma null |
| viac než dve desatinné miesta alebo jeden oddeľovač nasledovaný presne tromi číslicami (`1,234`, `2.345`) | `AMBIGUOUS_AMOUNT` |
| súčasne `.` a `,` (`1,234.56`, `1.234,56`) | `AMBIGUOUS_AMOUNT` |
| `about`, `approx`, `~`, `cca`, `okolo`, `приблизно`, `близько` | `APPROXIMATE_AMOUNT` |
| alternatívy alebo rozsahy (`18 or 20`, `18-20`, `або`, `alebo`) | `AMBIGUOUS_AMOUNT` |
| aritmetika (`minus`, `discount`, `plus`, `tip`, `split`, `знижка`, `zľava`) | `AMBIGUOUS_AMOUNT` |
| úvodné mínus aj pred značkou meny (`-€10`, `-EUR 10`) | `INVALID_AMOUNT` |
| číslice dotýkajúce sa písmen, ktoré nie sú slovom meny (`1e3`, `Cafe2Go`, `3x`) | `AMBIGUOUS_AMOUNT` |
| uvedená mena bez číslic (`eighteen euros`) | `NUMERIC_AMOUNT_REQUIRED` |
| vôbec žiadne číslo | `AMOUNT_REQUIRED` |

Výber kandidáta: dátumové tokeny sa vylúčia; ak presne jeden peňažný token susedí so značkou meny, je sumou; bez označeného tokenu sa vyberie jediné zostávajúce číslo (mena sa predvolí); viac neoznačených čísel je `AMBIGUOUS_AMOUNT`. Ak `amount_text` modelu označuje iný token než sken alebo je null, hoci sken token našiel, výsledok je `AMBIGUOUS_AMOUNT` — žiadna strana nemá prednosť v dôveryhodnosti.

**Mena** — značky EUR: `€`, `EUR`, `eur`, `euro`, `euros`, `eura`, `eurá`, `євро`. Slová meny sa môžu dotýkať číslic (`10USD`, `USD10`, `18EUR`); ukončujú ich len písmená (D-037). Bez značky → `CURRENCY_DEFAULTED` (info). Mena modelu, ktorá nie je rozpoznanou značkou → `AMBIGUOUS_CURRENCY`.

**Dátum** — podporované zdrojové formy: ISO `YYYY-MM-DD`; `D.M.YYYY`; today / yesterday / day before yesterday; dnes / včera / predvčerom; сьогодні / вчора / учора / позавчора. Bez dátumového výrazu → referenčný dátum s `DATE_DEFAULTED` (info). Nejednoznačné lomky, deň.mesiac bez roka, názvy dní a frázy (`Monday`, `v pondelok`, `у понеділок`), `N days ago` / `N дні тому` / `pred N dňami`, `last month` → `AMBIGUOUS_DATE` alebo `UNSUPPORTED_DATE_FORMAT`, aj keď ich model vynechá (D-037). Nemožné dátumy → `INVALID_DATE`. Dva dátumové výrazy → `AMBIGUOUS_DATE`. Mimo 1900-01-01 … zajtrajška podľa lokálneho času servera → `DATE_OUT_OF_RANGE`. Nesúlad modelu/skenu → `AMBIGUOUS_DATE`. Bez normalizácie pretečenia a bez parsovania cez UTC.

**Kategória** — `category_ref` sa cez mapu danej požiadavky preloží na vlastnené ID; null → `CATEGORY_REQUIRED`.

**Poznámka** — iba `note_text`; nad 60 kódových bodov sa skráti na hranici slova s `NOTE_TRUNCATED` (info).

Závažnosť: `info` nikdy neblokuje Save; `needs_input` blokuje do opravy; `unsupported` ponúka preformulovanie alebo ručné zadanie.

<a id="7-limits-d-034"></a>
## 7. Limity (D-034)

| Premenná | Predvolené | Hranice |
|---|---|---|
| `WALLET_AI_TIMEOUT_MS` | 15000 | 1000–30000 |
| `WALLET_AI_MAX_OUTPUT_TOKENS` | 600 | 100–2000 |
| `WALLET_AI_GLOBAL_DAILY_CALLS` | 20 | 1–10000 |
| `WALLET_AI_USER_DAILY_CALLS` | 5 | 1–1000 |
| `WALLET_AI_USER_MINUTE_CALLS` | 3 | 1–100 |
| `WALLET_AI_MAX_CONCURRENT` | 2 (a 1 na používateľa) | 1–20 |

Denné a minútové počítadlá sa pred odoslaním atomicky rezervujú v SQLite (`ai_quota`) podľa serverového času, zostávajú spotrebované po zlyhaní, prežijú reštart a obsahujú iba deň/rozsah/používateľa/počet. Obmedzovač súbehu je lokálny pre proces a **nechráni** viac procesov. Telá odpovedí poskytovateľa sú počas streamovania obmedzené na 64 KiB. Jeden pokus je najviac jedna požiadavka poskytovateľa: bez opakovaní, opravných volaní a druhého modelu.

<a id="8-keyed-save-d-035"></a>
## 8. Uloženie s kľúčom (D-035)

`POST /api/transactions` prijíma voliteľnú hlavičku `Idempotency-Key` (8–64 znakov z `A-Z a-z 0-9 -`). Bez nej sa správanie nemení.

S kľúčom:

- `spent_on` je povinné (inak 400);
- jedna transakcia `BEGIN IMMEDIATE` vyhľadá `(user_id, key)`;
- nový kľúč → overenie, spoločné vloženie výdavku aj záznamu kľúča → 201;
- rovnaký kľúč a rovnaké kanonické dáta → pôvodné telo 201, hlavička `Idempotency-Replayed: true`, bez vloženia;
- rovnaký kľúč a odlišné dáta → **409 IDEMPOTENCY_CONFLICT**;
- rovnaký kľúč po zmazaní výdavku → **409 IDEMPOTENCY_REPLAY_UNAVAILABLE** (nikdy sa neobnoví);
- po úprave výdavku opakovanie vráti pôvodný výsledok a nevráti úpravu späť;
- kľúče sú oddelené podľa používateľa a uchovávajú sa po celý život účtu.

Kanonické dáta: `[amount_cents, category_id or null, spent_on, note or null]` po validácii tvaru; poradie kľúčov objektu nie je dôležité.

<a id="9-privacy"></a>
## 9. Súkromie

Poskytovateľ dostáva pevné pokyny, schému, opis, referenčný dátum, jazykovú pomôcku a názvy kategórií používateľa pod nepriehľadnými odkazmi. Nikdy: JWT, e-mail, heslo, ID používateľa, zostatky, históriu, ID iných kategórií ani prostredie. `store: false` nie je sľub nulového uchovávania a UI nič také netvrdí.

Gemini Free (D-040) môže odoslaný obsah použiť na zlepšovanie produktov Google. Preto dostáva iba riadky syntetického vyhodnocovacieho korpusu, nikdy opis skutočnej osoby, a to iba cez live evaluator po výslovnom rozhodnutí operátora. Aj Gemini adaptér posiela `store: false`; riadi tým ukladanie interakcie na serveri, nie použitie údajov v bezplatnej vrstve. Logy obsahujú len ID požiadavky, kód výsledku, trvanie, verzie a počty tokenov.
