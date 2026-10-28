[English](../../../../docs/api/README.md) · **Slovenčina**

<!-- locale-links-v1: source-relative links rebased for locales/sk -->

<a id="api-contract-and-executable-evidence"></a>
# Kontrakt API a spustiteľné dôkazy

[← Späť na README](../../README.md#qa-evidence) · [Ďalej: lokálna správa o kontrakte →](../../qa/docs/test-report-contract.md)

[Dokument OpenAPI 3.0.3](../../../../spec/openapi.json) opisuje implementované REST API. Nie je to hosťovaná služba Swagger ani tvrdenie o produkčnom API. Verzia bola zvolená pre kompatibilitu parsera, nie ako údajne najnovšia verzia.

<a id="where-to-go"></a>
## Kam pokračovať

| Čo čítať alebo kontrolovať | Otvoriť |
|---|---|
| Metódy, polia, hlavičky a dokumentované stavy | [Strojovo čitateľný kontrakt](../../../../spec/openapi.json) |
| Architektúra a obchodné pravidlá | [Architektúra](../../spec/architecture.md) · [limity kategórií](../../qa/docs/analysis-category-limits.md) · [návrh AI](../../spec/ai-expense-entry.md) · [predbežný syntetický import](../../qa/docs/analysis-synthetic-import.md) |
| Skutočná implementácia | [Server a autentifikačné trasy](../../../../src/server.js) · [routery](../../../../src/routes) · [validácia](../../../../src/validate.js) |
| Kontrola odchýlky kontraktu | [Brána zdroj–schéma](../../../../scripts/lib/openapi.js) · [vstupný príkaz](../../../../scripts/check-openapi.js) |
| Test skutočných HTTP odpovedí | [Testy kontraktu](../../../../qa/contract/contract.test.js) · [prísny validátor odpovede](../../../../qa/contract/response-validator.js) |
| Výsledky a zostávajúce hranice pokrytia | [Lokálna správa](../../qa/docs/test-report-contract.md) · [register prípadov](../../qa/docs/test-cases.md#contract-checks--openapi-and-real-http) |

<a id="run-safely"></a>
## Bezpečné spustenie

```bash
npm ci
npm run check:openapi
npm run test:contract
npm run test:import
```

Nepotrebujete ručne spúšťať server ani mať `.env`, kľúč API či existujúcu databázu. Testy odpovedí vytvárajú dočasné databázy SQLite, syntetické účty, náhodné tajomstvá a servery dostupné iba cez loopback. AI je vypnutá a používa sa existujúci ukážkový poskytovateľ s pripravenými odpoveďami; sieťová ochrana sa načíta v testovacom aj serverových procesoch. Samostatný test syntetického importu používa rovnakú offline ochranu a jednorazový server; kontrolný postup v prehliadači pokrýva Playwright. Tieto testy nevolajú externého poskytovateľa. Záznamy zostávajú v pamäti; výstup uvádza pozorované množiny stavov, nie telá odpovedí, heslá alebo tokeny Bearer.

Skener zdrojového kódu má zámerne úzky rozsah: doslovne zapísané metódy aplikácie/routera a aktuálnu podobu chráneného mountu. Nepodporované úvodzovky, mounty, vypočítané, zreťazené alebo dynamické deklarácie zlyhajú namiesto tichého zmiznutia. Medzera okolo bodky je testovaná. Nejde o univerzálny interpret JavaScriptu či Expressu.

Swagger Parser kontroluje štruktúru a lokálne odkazy, pričom externé/file/http načítanie je vypnuté a kruhové odkazy sa odmietajú. Ďalšie kontroly overujú zhodu metód a ciest, jedinečné ID, účinnú autentifikáciu, parametre, typované odpovede, povinné korelačné hlavičky a prázdny stav 204. Jeho validácia špecifikácie pre Swagger 2 nenahrádza tieto kontroly OpenAPI 3.

Ajv 8 spolu s formátmi validuje vybraný skutočný stav, médium a hlavičky. `strict` je zapnutý; prevody typov, predvolené hodnoty a odstraňovanie nadbytočných polí sú vypnuté. Registrovaná je len neškodná anotácia OpenAPI `example`; neznáme validačné kľúčové slová zlyhajú. Nepoužíva sa široký adaptér, benevolentná náhrada ani upravovanie odpovede. Každá implementovaná operácia potrebuje pozorovaný úspech, nie iba 401.

<a id="synthetic-request-examples"></a>
## Syntetické príklady požiadaviek

Použite jednorazový lokálny účet, nie osobné údaje. Telá nižšie sú príklady, nie záznam vykonanej požiadavky; pri označených miestach prispôsobte dátum lokálnemu dátumu servera. Registrácia/prihlásenie vracia token, ktorý musí zostať lokálny a nesmie sa dostať do správy.

```http
POST /api/auth/register
Content-Type: application/json

{"email":"example@wallet.test","password":"synthetic-example-password"}
```

Autentifikované požiadavky používajú `Authorization: Bearer <local-token>`; text v zátvorkách je zástupný údaj, nie prihlasovací údaj. Peniaze sú celé centy.

```http
POST /api/transactions
Content-Type: application/json
Authorization: Bearer <local-token>
Idempotency-Key: example-key

{"amount_cents":1250,"spent_on":"2026-09-28","category_id":null,"note":"Synthetic lunch"}
```

Idempotentný kľúč je identifikátor operácie zvolený klientom, nie autentifikačný údaj. Autentifikácia stále vyžaduje osobitný token Bearer.

Jediný presný historický nález v koreňovom [`.gitleaksignore`](../../../../.gitleaksignore) je odtlačok: commit `9965d076cfffc0301a10d4ac881b61fdfb9082a8`, tento dokument, pravidlo `generic-api-key`, riadok 72. Skontrolovaný falošný poplach spôsoboval syntetický kľúč operácie v pôvodnom HTTP príklade. Výnimka platí iba pre tento presný historický nález; žiadny súbor, commit ani detekčné pravidlo sa nevypína. Aktuálny príklad používa `example-key`. Nové nálezy sken zablokujú.

Pri novom uložení s kľúčom použite platný dátum najneskôr zajtra podľa servera. Úspešné vytvorenie vracia 201. Opakovanie rovnakých kanonických údajov s rovnakým kľúčom vráti uložený obraz vytvorenia a `Idempotency-Replayed: true`, aj keď sa riadok neskôr upravil. Zmenené údaje s tým istým kľúčom vrátia 409 `IDEMPOTENCY_CONFLICT`; zmazaný pôvodný záznam vráti 409 `IDEMPOTENCY_REPLAY_UNAVAILABLE`. Bežný POST bez kľúča a platba rozvrhu nesľubujú idempotenciu.

```json
{"error":{"code":"VALIDATION_FAILED","message":"amount_cents must be a positive integer number of cents"}}
```

Toto ilustruje vnorený tvar chyby, nie zaručené doslovné znenie správy. Každá odpoveď má `X-Request-Id`, UUID s malými písmenami. Bežné chyby tento identifikátor nepridávajú do tela; návrh AI ho pridáva a musí sa zhodovať s hlavičkou.

```http
PATCH /api/categories/1
Content-Type: application/json
Authorization: Bearer <local-token>

{"monthly_limit_cents":0}
```

ID 1 je ilustračné: svoje ID kategórie získajte cez GET categories. Null rozpočet vymaže; nula je skutočný rozpočet. Nezávislé limity kategórie a celkový limit vyhodnocujú súčty aktuálneho alebo historického mesiaca pri čítaní a nikdy neblokujú platné uloženie.

<a id="implementation-details-that-schemas-alone-do-not-express"></a>
## Detaily implementácie, ktoré schémy samy nevyjadria

- Bežné vytvorenie POST a nastavenia PUT ignorujú nadbytočné polia; úpravy PATCH kategórií, transakcií a rozvrhov odmietajú prázdne objekty a neznáme alebo serverom vlastnené polia. PATCH platby rozvrhu ignoruje telo a nevyžaduje neprázdny objekt. Požiadavky na návrh AI sú tiež objekty s presne určenými kľúčmi.
- Názvy sa po orezaní medzier kontrolujú podľa dĺžky JavaScript UTF-16. Registrácia oreže e-mail, prevedie ho na malé písmená a použije regex aplikácie; heslo má minimum osem jednotiek UTF-16 a maximum 72 bajtov UTF-8, nie 72 znakov.
- ID kategórií prechádzajú prevodom Number a kontrolou vlastníctva. Ikona kategórie a poznámka výdavku používajú String pre nenulový JSON; tieto prevody nie sú skryté za nepravdivými schémami iba pre celé čísla alebo reťazce. Chýbajúce a cudzie ID vracajú 404.
- Pri výdavku bez kľúča sa chýbajúci/null dátum nastaví na dnes; uloženia s kľúčom vyžadujú výslovný dátum; null dátum pri PATCH je neplatný. Dátumy sú lokálne, nie časové značky UTC. `created_at` výdavku je text SQLite, nie RFC3339 dátum a čas.
- Aktívny príznak rozvrhu je celé číslo 0/1. Zostávajúce polia predplatného sú null. Opakovaný PATCH pay môže zapísať ďalšiu splátku; nie je to replay. `next_due` je formátovaný kalendárny text; okrajový rok 10000 na úrovni zdroja je priznaný v kontrakte, nie vydávaný za pozorovaný HTTP výsledok.
- Text AI sa normalizuje do NFC pred hranicou 500 kódových bodov. Surové telo JSON nad 8192 bajtov vracia 400 (globálny limit parsera 100 KiB vracia 413). Referenčný dátum musí byť serverový včerajšok/dnešok/zajtrajšok. Živý súhlas, kontext vlastných kategórií, kvóty a výstup poskytovateľa sa kontrolujú v tomto poradí. Návrhy nezapisujú výdavky, ale rezervácie kvóty zapisujú počítadlá. Súbežnosť v jednom procese nie je zárukou pre viac procesov. Ukážkové fixtures nie sú meranou kvalitou modelu.

<a id="requirements-for-the-contract-checks"></a>
## Požiadavky na kontroly kontraktu

Ide o verifikačné požiadavky tejto vrstvy, nie o nové funkcie produktu.

| ID | Požiadavka | Dôkaz |
|---|---|---|
| <a id="req-contract-01"></a>REQ-CONTRACT-01 | Lokálne odkazy OpenAPI a zhoda operácií/autentifikácie/parametrov so zdrojom; zlyhanie pri odchýlke | [Brána](../../../../scripts/lib/openapi.js), TC-CONTRACT-002 |
| <a id="req-contract-02"></a>REQ-CONTRACT-02 | Typovaný vybraný stav/médium/hlavička; prázdna 204; bez mutácie alebo náhrady | [Validátor](../../../../qa/contract/response-validator.js), TC-CONTRACT-001/010 |
| <a id="req-contract-03"></a>REQ-CONTRACT-03 | Skutočný úspech a zmysluplné scenáre odmietnutia, hraníc, vlastníctva a stavu | TC-CONTRACT-003…009 v [testoch](../../../../qa/contract/contract.test.js) |
| <a id="req-contract-04"></a>REQ-CONTRACT-04 | Jednorazové offline prostredie bez zdedených kľúčov poskytovateľa a logovaných JWT | [Harness](../../../../qa/contract/support.js), TC-CONTRACT-001/008/011 |
| <a id="req-contract-05"></a>REQ-CONTRACT-05 | Kontroly skutočných zachytení a inventára odmietajú poškodenie; originály zostávajú nezmenené | TC-CONTRACT-002/010 |
| <a id="req-contract-06"></a>REQ-CONTRACT-06 | Pozorovaný úspech pre každú operáciu zdroja; nevykonané stavy sú výslovné | TC-CONTRACT-011, [matica](../../qa/docs/test-report-contract.md#observed-status-matrix) |

Sledujte dôkazy: [požiadavka](#requirements-for-the-contract-checks) → [rozhodnutie implementácie](#run-safely) → [test](../../../../qa/contract/contract.test.js) → [výsledok](../../qa/docs/test-report-contract.md) → [hranice](../../qa/docs/test-report-contract.md#limitations).
