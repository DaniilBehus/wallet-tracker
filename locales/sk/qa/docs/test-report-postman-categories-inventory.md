[English](../../../../qa/docs/test-report-postman-categories-inventory.md) · **Slovenčina**

<a id="categories-postman-inventory--bounded-f19-family"></a>

# Inventár kategórií v Postman — obmedzená rodina F19

[← Späť na README](../../README.md#qa-evidence) · [Aktuálny inventár Categories](../../../../qa/docs/postman-categories-inventory.json) · [Predchádzajúca rodina Token](test-report-postman-token-inventory.md)

**2026-10-13; lokálny necommitnutý checkout na HEAD
`b270355`.** Prijatý [samostatný validátor](../../../../scripts/postman-inventory.js)
sa použil bez zmeny. Report pokrýva len priečinok kolekcie
`03 · Categories` a časť katalógu `## API · Categories`:
sedem požiadaviek, sedem riadkov prípadov TC-API-015–021
a sedem preskúmaných deklaratívnych väzieb. **Nie je**
to beh Newman, nový behaviorálny PASS, úplné pokrytie F19,
dôkaz vzdialeného CI ani prijatie vlastníkom.

<a id="reviewed-source-links"></a>

## Skontrolované väzby na zdroj

[Skontrolované mapovanie](../../../../qa/traceability/postman-categories.json)
fixuje presný selektor priečinka/názvu/metódy/surovej URL,
úplný fingerprint požiadavky/udalosti, kontext pomocnej
funkcie/autentifikácie kolekcie, fingerprint riadka prípadu
a testovací marker. [Odvodený JSON](../../../../qa/docs/postman-categories-inventory.json)
vznikol z nezmenenej [kolekcie Postman](../../../../qa/api/wallet.postman_collection.json),
[katalógu prípadov](test-cases.md) a mapovania. Hlási
`PARTIAL_STATIC_SOURCE_INVENTORY`, `NOT_RUN`,
`NOT_CHECKED` bez medzier „len deklarované“ alebo
„len v zdroji“ **v rámci týchto siedmich prípadov**.
Poradie požiadaviek a LF/CRLF nie sú identitou.

| Prípad | Orákulum skontrolované v zdroji a hranica |
|---|---|
| TC-API-015 | Zdedená bearer autentifikácia; `expectOk(200, 'categoryList')` kontroluje stav a schému; asercia vyžaduje neprázdny zoznam po registrácii. |
| TC-API-016 | Výslovný `tokenB` žiada zoznam používateľa B a kontroluje, že **neobsahuje** `catA`, **prvé** ID kategórie používateľa A uložené TC-API-015. Katalóg tvrdí, že neobsahuje žiadne ID A; túto širšiu podmienku zdrojová asercia **nepreukazuje**. |
| TC-API-017 | Posiela `QA {{runId}}` a 🧪 pre daný beh; očakáva 201/schému kategórie a vrátený názov a ikonu. |
| TC-API-018 | Po vytvorení posiela rovnaký názov/ikonu; očakáva 409 `CONFLICT` a schému chyby. Závisí od poradia kolekcie. |
| TC-API-019 | Posiela názov s **troma medzerami**, nie chýbajúci, prázdny či null názov; očakáva 400 `VALIDATION_FAILED`. |
| TC-API-020 | Skript pred požiadavkou vytvorí `'x'.repeat(61)` a telo používa `{{name61}}`; očakáva 400 `VALIDATION_FAILED`. |
| TC-API-021 | Skript pred požiadavkou vytvorí 60-znakový názov pre daný beh; očakáva 201/schému kategórie a vrátený názov dĺžky 60. |

Pomocná funkcia kolekcie definuje `expectOk` ako
stav plus schému JSON a `expectError` ako stav,
schému/kód chyby a nie-500. Skript pred požiadavkou
na úrovni kolekcie tiež definuje schémy `categoryList`/
`category` a jedinečné hodnoty `runId`; tieto
definície sa skontrolovali a fingerprintovali,
**nespustili**. Statický validátor preukazuje identitu
zdroja a deklarované väzby, nie sémantickú úplnosť
každej očakávanej podmienky či správanie API.
Historické označenia `PASS` v katalógu zostávajú
historické; táto úloha ich nespúšťala znova.

<a id="commands-and-controls"></a>

## Príkazy a kontroly

Použitý overený lokálny spustiteľný Node 22.14.0:

- `node scripts/postman-inventory.js --collection qa/api/wallet.postman_collection.json --catalogue qa/docs/test-cases.md --mapping qa/traceability/postman-categories.json --output qa/docs/postman-categories-inventory.json`: **7 požiadaviek / 7 prípadov / 7 väzieb**, statický stav `NOT_RUN`.
- `node --test qa/gates/postman-categories-inventory.test.js qa/gates/postman-token-inventory.test.js qa/gates/postman-inventory.test.js`: **21/21 PASS** (Categories 7, Token 6, Health 8). Pamäťové negatívne kontroly odmietajú neznáme/nepilotné ID, chýbajúcu väzbu/riadok, odstránené/presunuté/nadbytočné požiadavky, odchýlku autentifikácie/tela/asercie/hraničnej hodnoty tokenu B, duplicitné selektory/anotácie a chybné/prázdne vstupy. Pozitívne kontroly prijímajú zmenu poradia, CRLF a oprávnenú ďalšiu požiadavku už mapovaného prípadu. Uložený Categories JSON sa hlboko porovnal s novým buildom.
- `node scripts/traceability.js`: staticky **280 ID prípadov / 78 definícií pravidiel**; bez sémantického či runtime tvrdenia.
- `node scripts/check.js`: **8 pass / 0 skip / 0 fail** statických brán.

SHA-256: kolekcia
`2f231d50879f2264bd904cc4a12577ab47474147a9687b4fb0f61907fd4f120b`;
katalóg
`a2d1ff0cb206113ac82ec8f6014a5d17d7627265a26602dd6cb81f52962b512d`;
mapovanie Categories
`593ab3362dcc35a350b967fec08647694b8b6f0a09c32d4b19b2ddb29ec27477`;
odvodený JSON
`07ceeb49caf1ed6db14600bffca6fc847046ee951121efbd954aef38ddb8137a`.

Nemenil sa skript kolekcie, riadok katalógu,
validátor, runner, produktový kód ani súbor CI.
Ostatné rodiny API a testovacie vrstvy sú
`NOT_CHECKED`; úplné F19 zostáva **OPEN**
s nezmeneným predchádzajúcim súčtom projektu
**17/25**. Neurobil sa commit ani push.
