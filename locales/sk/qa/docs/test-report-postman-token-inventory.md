[English](../../../../qa/docs/test-report-postman-token-inventory.md) · **Slovenčina**

<a id="token-handling-postman-inventory--bounded-f19-family"></a>

# Inventár spracovania tokenov v Postman — obmedzená rodina F19

[← Späť na README](../../README.md#qa-evidence) · [Aktuálny inventár Token](../../../../qa/docs/postman-token-inventory.json) · [Ďalej: pilot Health →](test-report-postman-inventory.md)

**2026-10-13; lokálny necommitnutý checkout na HEAD
`b270355`.** Prijatý [samostatný validátor](../../../../scripts/postman-inventory.js)
sa použil bez zmeny. Report pokrýva iba priečinok
`02 · Token handling` a časť katalógu
`## API · Token handling`: päť požiadaviek,
päť prípadov TC-API-010–014 a päť preskúmaných
deklaratívnych väzieb. Nie je to beh Newman,
nový výsledok PASS, úplné pokrytie F19,
dôkaz vzdialeného CI ani prijatie vlastníkom.

<a id="reviewed-source-links"></a>

## Skontrolované väzby na zdroj

[Skontrolované mapovanie](../../../../qa/traceability/postman-token.json)
fixuje presný selektor priečinka/názvu/metódy/surovej URL,
úplný fingerprint požiadavky/udalosti, kontext spoločnej
pomocnej funkcie/autentifikácie kolekcie, fingerprint riadka
prípadu a zmysluplný testovací marker.
[Odvodený JSON](../../../../qa/docs/postman-token-inventory.json) sa znovu
vygeneroval z nezmenenej kolekcie/katalógu a tohto
mapovania; uvádza `PARTIAL_STATIC_SOURCE_INVENTORY`,
`NOT_RUN`, `NOT_CHECKED` a v rámci týchto piatich
prípadov nemá medzeru „len deklarované“ ani „len v zdroji“.
Poradie požiadaviek a LF/CRLF nie sú identitou.

| Prípad | Orákulum skontrolované v zdroji a hranica |
|---|---|
| TC-API-010 | `GET /api/categories` prepíše zdedenú bearer autentifikáciu pomocou `noauth`, nemá hlavičku Authorization a volá `expectError(401, 'UNAUTHORIZED')`. |
| TC-API-011 | Rovnaká trasa posiela výslovnú schému `Token` namiesto `Bearer` a očakáva 401. |
| TC-API-012 | Skript pred požiadavkou zmení posledný znak podpisu; test porovná nezmenenú hlavičku/payload a zmenený reťazec podpisu, potom očakáva 401. Toto sa tu skontrolovalo, **nespustilo**. |
| TC-API-013 | Kolekcia kontroluje hodnotu tvaru JWT, číselné `exp` staršie než `Date.now()` a potom 401. [Zdroj runnera](../../../../qa/api/run.js) vytvorí token s expiráciou desať dní v minulosti a vloží ho ako `tokenExpired`. V režime vlastného servera používa rovnaké `SECRET` na podpis aj v detskom serveri. Externé `QA_BASE_URL` je iný režim a nedokazuje zhodné tajomstvo. Runner **nie je** jedným z troch fingerprintovaných vstupov validátora: tento odsek je samostatná kontrola zdroja iba na čítanie, nie nová automatická ochrana runnera. |
| TC-API-014 | Bearer token novo registrovaného používateľa B žiada transakcie a overí 200, `total: 0` a prázdne items. V tomto skorom bode používateľ A ešte nemá vytvorenú transakciu; **nie je** to úplný test izolácie s naplneným A. |

Pomocná funkcia `expectError` na úrovni kolekcie
kontroluje stav odpovede, schému/kód chyby a nie-500;
`expectOk` kontroluje stav a schému odpovede. Statická
väzba stále nie je automatickým sémantickým dôkazom
každej vety katalógu ani správania auth middleware
na iných trasách.

<a id="commands-and-controls"></a>

## Príkazy a kontroly

Použitý lokálny Node 22.14.0:

- `node scripts/postman-inventory.js --collection qa/api/wallet.postman_collection.json --catalogue qa/docs/test-cases.md --mapping qa/traceability/postman-token.json --output qa/docs/postman-token-inventory.json` vytvoril **5 požiadaviek / 5 prípadov / 5 väzieb**, statický stav `NOT_RUN`.
- `node --test qa/gates/postman-token-inventory.test.js`: **6/6 PASS**. Pamäťové negatívne kontroly odmietajú neznáme/nepilotné ID, chýbajúcu väzbu/riadok, odstránenú/presunutú požiadavku, zmenenú hlavičku Authorization, zmenené poškodenie pred požiadavkou alebo aserciu číselného exp, duplicitný selektor/anotáciu a prázdne/chybné vstupy. Pozitívne kontroly prijímajú zmenu poradia, LF/CRLF a oprávnenú druhú požiadavku jedného prípadu.
- `node --test qa/gates/postman-inventory.test.js`: nezmenené kontroly Health **8/8 PASS**. Odvodený Token JSON sa hlboko porovnal s novým buildom zo zdrojových bajtov.

SHA-256 kolekcie:
`2f231d50879f2264bd904cc4a12577ab47474147a9687b4fb0f61907fd4f120b`;
katalógu:
`a2d1ff0cb206113ac82ec8f6014a5d17d7627265a26602dd6cb81f52962b512d`;
mapovania Token:
`2928afc2eb72d499803237b0420088aa8ece8f9e63b65b61725c10ca053f4bca`;
vygenerovaného Token JSON:
`cb39d06ef73e22b92d939c279141b5a121cf791f90987fff6b6c6498640449c4`.
Samostatne skontrolované `qa/api/run.js` SHA-256:
`d918fcbaa5255be13771840af1d5709665e886bcbd05feac0e83ae2bb8c7af0c` —
hash je zaznamenaný pre pôvod, tento validátor ho nevynucuje.

Nemenil sa skript kolekcie, riadok katalógu, runner,
validátor, produktový kód ani súbor CI. Historické
riadky PASS ostávajú historické. Ostatné rodiny API
a testovacie vrstvy sú `NOT_CHECKED`; úplné F19
zostáva OPEN a neurobil sa commit ani push.
