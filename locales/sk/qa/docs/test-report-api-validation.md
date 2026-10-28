[English](../../../../qa/docs/test-report-api-validation.md) · **Slovenčina**

<a id="safe-numeric-and-text-input--local-http-regression-2026-10-09"></a>

# Bezpečné číselné a textové vstupy — lokálna HTTP regresia, 2026-10-09

[← Späť na README](../../README.md#qa-evidence) · [Príkazy behov](../../docs/testing.md) · [Kontraktové testy](../../../../qa/contract/contract.test.js) · [Kontrakt OpenAPI](../../../../spec/openapi.json)

Základ HEAD: `b270355c8c850282b10cc0a7bdeb81c88b784765`
plus skoršie lokálne zmeny kontrol validátora a táto
validačná etapa, všetko **necommitnuté**. Nižšie uvedené
HTTP pozorovania použili existujúci kontraktový harness:
skutočné loopback servery Express, jednorazové SQLite,
syntetické účty, náhodné tajomstvá JWT a offline sieťovú
ochranu. Nepoužila sa databáza vlastníka, `.env` ani
živý poskytovateľ. Nejde o výsledok GitHub CI či UAT vlastníka.

<a id="before-the-fix"></a>

## Pred opravou

Dve nové HTTP kontroly na pôvodných produktových validátoroch
zlyhali, zatiaľ čo kompatibilné vstupy stále prechádzali:

| Vstup | Pozorované predtým | Požadované |
|---|---|---|
| `offset=1e30` | 500 `INTERNAL` | 400 `VALIDATION_FAILED` |
| `offset=9007199254740992` | 200 | 400 |
| Nebezpečne veľké ID v URL a ID vlastnených kategórií | 404 (nenájdené) | 400 pri nebezpečnej veľkosti |
| Objekt vlastnenej kategórie s `toString: null` | 500 | 400 |
| Nekonvertovateľný objekt alebo vnorené pole v note/icon pri POST bez kľúča, POST s kľúčom, PATCH a POST kategórie | Osem odpovedí 500 | Osem odpovedí 400 |

Záporné, desatinné a bežné neplatné hodnoty query už
vracali 400; zostávajú regresnými triedami, nie novými
chybami. Bezpečný offset `9007199254740991` vrátil
200 s prázdnou stránkou. Žiadny neplatný zápis nezmenil
počet transakcií, existujúcu poznámku ani počet kategórií;
odmietnutá poznámka s kľúčom nerezervovala kľúč.

<a id="local-fix-and-compatibility"></a>

## Lokálna oprava a kompatibilita

Spoločné číselné parsery teraz vyžadujú nezáporné/kladné
hodnoty `Number.isSafeInteger` a výnimku pri `Number(...)`
menia na 400 špecifické pre pole. Offset prijíma
**0–9007199254740991**; limit si zachováva existujúci
strop **0–200** aj predvolené hodnoty. Bezpečné, ale
neexistujúce ID stále vracajú 404 v rozsahu vlastníctva.
Jeden spoločný validátor nullable textu zachováva
`String(value)` pre konvertovateľný JSON a mení iba
výnimku pri konverzii na 400 špecifické pre pole.
Používa ho ikona kategórie, výdavok bez kľúča,
kanonický hash/uloženie s kľúčom a PATCH výdavku.
Samostatné prísnejšie pravidlo poznámky pri importe
sa nemenilo.

Skutočné HTTP pozitívne triedy overili číslo, obe
logické hodnoty, obyčajný objekt, pole, null,
vynechanie a bežný reťazec. Uloženia s kľúčom
opakovali pôvodný snapshot pri prijatých hodnotách
poznámky; null a vynechaná poznámka zdieľali
rovnaký kanonický payload. Bezpečné číselné/
reťazcové/polové/vnorené-polové ID kategórií
(a `true`, keď existuje ID 1) sa pod jedným kľúčom
opakovali s rovnakou odpoveďou. Pravidlo prijímanej
konverzie, tvar hashu a správanie opakovania sa nemenili.

Po oprave obe cielené HTTP kontroly prešli **2/2**.
Celý `npm run test:contract` prešiel **14/14 testov,
335 validovaných skutočných HTTP odpovedí a 21/21
pozorovaných zdrojových operácií**.
`npm run check:openapi` prešiel **21/21 operácií,
298 lokálnych referencií**. Opisy OpenAPI teraz
uvádzajú bezpečné hranice a vysvetľujú, že typy JSON
sa prijímajú iba pri konverzii bez výnimky; nezužujú
nepravdivo note/icon len na reťazce.

<a id="combined-local-validation-status"></a>

## Stav kombinovanej lokálnej validácie

`npm run test:gates` prešiel **23/23**;
`npm run check` **8/8**; `npm run test:db` **6/6**;
`npm run test:api` **274 požiadaviek a 945 asercí**;
`npm run test:python` **27/27**; `npm run test:import`
**11/11**. `npm run eval:ai` prešiel **116/116 offline
fixtúr** s `MODEL_QUALITY=NOT_MEASURED`.
Záverečný bezpečný `npm run test:race` dokončil
**120 dvojíc v každom zo siedmich scenárov**:
nula porušení v šiestich vynucovaných scenároch;
siedmy nameral **120/120 duplicitných riadkov pri
bežných požiadavkách bez kľúča**, nie úspech idempotencie.

Celý `npm run test:ai` **zlyhal (exit 1)** na
asercie limitného okna vyhodnocovača W9.
Jediná následná diagnostika v **jednorazovej kópii**,
nie v pôvodnom nastavení checkoutu W9, zaznamenala
tri výstupy vyhodnocovača s kódom 2, nula požiadaviek
poskytovateľovi, nula rezervácií a nula odmietnutí
limitom. Príčina **nie je preukázaná**; nedokazuje
rovnakú koreňovú príčinu ako W9 ani nezávislosť
zlyhania od tejto etapy. Zdroj AI/vyhodnocovača
sa nemenil a neopakovalo sa až do zeleného výsledku.
Browserové sady sa pri tejto zmene bez UI nespúšťali
znovu. Nejde o úspech celého stromu ani zelené CI.

Táto etapa nerieši konzistentnosť offsetového
stránkovania pri súbežnom vkladaní, dátumovú doménu,
browserové UI, konverziu ostatných polí API ani
celkovú spoľahlivosť. Netvrdí sa commit, push
ani nový beh GitHub CI.
