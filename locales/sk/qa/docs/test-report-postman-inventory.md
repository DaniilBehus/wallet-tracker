[English](../../../../qa/docs/test-report-postman-inventory.md) · **Slovenčina**

<a id="healthregistration-postman-inventory--bounded-f19-pilot"></a>

# Inventár Health/registrácie v Postman — obmedzený pilot F19

[← Späť na README](../../README.md#qa-evidence) · [Aktuálny inventár zdroja](../../../../qa/docs/postman-health-inventory.json) · [Ďalej: stav QA →](../../docs/qa-status.md)

**2026-10-13; lokálny necommitnutý checkout na HEAD
`b270355`.** Ide o statické mapovanie zdroja na katalóg
pre presný priečinok Postman `01 · Health and registration`
a zodpovedajúcu časť katalógu. Nespúšťa Newman,
nepreukazuje aktuálne výsledky PASS, nedokončuje F19,
neoveruje CI ani nemení UAT/zručnosti vlastníka.

<a id="reviewed-scope-and-mechanism"></a>

## Preskúmaný rozsah a mechanizmus

Nezmenená kolekcia má v presnom priečinku 12 požiadaviek;
nezmenená časť katalógu má 12 aktívnych riadkov:
TC-API-001–009 a TC-API-106–108. Každá aktuálna
požiadavka je prepojená aspoň s jedným preskúmaným
prípadom a každý prípad katalógu v rozsahu má väzbu
na požiadavku. Aktuálne odvodené počty sú **12
požiadaviek, 12 prípadov, 12 väzieb**; vznikli
zo vstupov, nie z kopírovaného celoprojektového
percenta pokrytia.

[Preskúmané mapovanie](../../../../qa/traceability/postman-health.json)
pomenúva presný priečinok, názov požiadavky, metódu
a surovú URL. Každá väzba zaznamenáva SHA-256
fingerprint úplného payloadu požiadavky/udalosti,
marker testovacieho skriptu a ľudsky preskúmaný
dôvod orákula. Mapovanie osobitne fixuje kontext
pomocnej funkcie/autentifikácie na úrovni kolekcie
a text každého riadka prípadu.
[Samostatný validátor](../../../../scripts/postman-inventory.js)
číta JSON štruktúrne; Markdown zámerne obmedzuje
na TC ID v prvej bunke a presnú pilotnú časť.
Poradie požiadaviek a formát LF/CRLF nie sú
identitou. Duplicitné selektory či anotácie
prípadov zlyhajú; jeden prípad môže mať
oprávnene viac odlišných väzieb požiadaviek.

[Vygenerovaný JSON](../../../../qa/docs/postman-health-inventory.json)
obsahuje zdrojové cesty a SHA-256 hashe, selektory,
väzby, medzery `declaredOnly`/`sourceOnly`
a výslovné markery `PARTIAL_STATIC_SOURCE_INVENTORY`,
`NOT_RUN` a `NOT_CHECKED`. Sú zámerné: ostatné
priečinky Postman a testovacie vrstvy pilot
**nekontroluje**.

<a id="local-verification"></a>

## Lokálne overenie

| Príkaz / kontrola | Výsledok |
|---|---|
| `node --test qa/gates/postman-inventory.test.js` | Záverečných 8/8 PASS. Pozitívne fixtúry pokrývajú LF/CRLF, zmenu poradia požiadaviek a oprávnenú druhú požiadavku mapovanú na rovnaký prípad. |
| Negatívne kontroly fixtúr | Zmazaná/presunutá požiadavka; neznáme/nepilotné ID; duplicitný, zmazaný, zmenený alebo nový nepreskúmaný riadok katalógu; chýbajúca väzba; zmenená asercia požiadavky alebo spoločná pomocná funkcia; ďalšia/duplicitná požiadavka; konfliktný selektor; opakovaná anotácia; prázdne/chybné vstupy; chybné TC ID v pilote aj mimo neho; nejednoznačná/chýbajúca hranica časti; kolízia cesty výstupu/vstupu — všetko zlyhá uzavretým spôsobom. |
| `node scripts/postman-inventory.js --collection qa/api/wallet.postman_collection.json --catalogue qa/docs/test-cases.md --mapping qa/traceability/postman-health.json --output qa/docs/postman-health-inventory.json` | Z nezmenených vstupov vytvoril aktuálny JSON 12/12/12. Výstup sa zapisuje až po validácii a nemôže cieliť na jeden z troch zdrojových vstupov. |
| `node scripts/traceability.js` | Existujúci statický kontrolér F13 PASS: 280 ID prípadov a 78 definícií pravidiel; bez tvrdenia o vykonaní. |
| `node scripts/check.js` | Existujúce statické brány 8 PASS, 0 preskočených. |

Prvé zlyhanie pre chýbajúci modul pri postupe test-first
bolo červené nastavenie, **nie** reprodukcia existujúcej
produktovej chyby. Nová fixtúra potom odhalila skutočnú
medzeru prvej implementácie: chybné `TC-API-10`
v susednej časti sa potichu vynechalo z množiny známych
ID celého katalógu. Parser sa sprísnil; pôvodne
priveľmi úzka gramatika ID tiež odmietala platné
`TC-E2E-001` a potom sa opravila. Záverečných
8/8 je po oboch opravách. Skripty kolekcie, riadky
katalógu ani produktové súbory sa nemenili.

Vstupné SHA-256 vo vygenerovanom artefakte:
kolekcia
`2f231d50879f2264bd904cc4a12577ab47474147a9687b4fb0f61907fd4f120b`;
katalóg
`a2d1ff0cb206113ac82ec8f6014a5d17d7627265a26602dd6cb81f52962b512d`;
preskúmané mapovanie
`2e5471e432a1434ed0cfb6721cfbbcdc84ec39d9bfe2feefce96efcf2cd33dff`.
SHA-256 vygenerovaného inventára:
`816f35a4afd0c13fc623952df98bc8e53871aef43e007cfca126f2e40ce191c5`.

Väzba požiadavky na prípad je preskúmaná
deklarácia, nie behaviorálne pokrytie.
Asercie kolekcie sa tu nespúšťali a mapovanie
samo nedokazuje, že je overená každá veta
očakávanej bunky katalógu. Napríklad požiadavka
TC-API-107 overuje 400/`VALIDATION_FAILED`;
statický pilot nezávisle nedokazuje ďalšie
tvrdenie katalógu „účet nevznikne“. Historické
riadky PASS sú nezmenené a nepreklasifikujú
sa na nové výsledky.

<a id="limits-and-next-decision"></a>

## Hranice a ďalšie rozhodnutie

F19 zostáva OPEN. Ostatné priečinky API, záťažové
testy, vykonateľné väzby prehliadača/Pythonu/DB/
Selenium, predbežný import a pomocné kontroly
vyžadujú samostatnú revíziu v danom rozsahu.
Širšia brána vydania, vzdialené CI a prijatie
vlastníkom zostávajú nedotknuté. V tomto pilote
sa neurobil commit ani push.
