[English](../../../../qa/docs/analysis-synthetic-import.md) · **Slovenčina**

<a id="synthetic-expense-import--provisional-analysis"></a>

# Import syntetických výdavkov — predbežná analýza

> Návrh vytvorený agentom pre demonštráciu osobného projektu. Vlastník tieto obchodné voľby ešte neskontroloval ani neprijal. Bankové prepojenie, skutočný externý účet ani skutočné transakčné údaje nepatria do rozsahu.

[← Späť na README](../../README.md) · [Architektúra](../../spec/architecture.md) · [Ďalej: kontrakt API →](../../../../spec/openapi.json)

[Poznámka k lokálnej regresii](test-report-synthetic-import.md)

<a id="goal-and-boundary"></a>

## Cieľ a hranica

Umožniť prihlásenej osobe prezrieť najviac desať syntetických záznamov
externých výdavkov a potom ich výslovne potvrdiť do Wallet. Náhľad je iba na
čítanie. Potvrdenie využíva existujúce kontrakty transakcie a uloženia s
kľúčom; po stratenej odpovedi nesmie nikdy vytvoriť neúplnú dávku ani
duplikovať externý záznam.

Zdroj má pevný identifikátor `synthetic-demo-v1`. Produktové API prijíma JSON
dodaný volajúcim, **nie pripojenie k externému poskytovateľovi**. Nerobí
požiadavku na poskytovateľa a nemá jeho prihlasovacie údaje, nahrávanie
súborov, plánovanú synchronizáciu ani automatické uloženie. Samostatný
testovací loopback adaptér a jednorazový HTTP stub preverujú spracovanie
timeoutu, chybnej odpovede a odmietnutej autorizácie; nie sú pripojené
k verejnej trase ani produktovému toku a nedokazujú skúsenosť s integráciou
skutočného poskytovateľa.

<a id="provisional-decisions-for-owner-review"></a>

## Predbežné rozhodnutia na kontrolu vlastníkom

- **P1 — všetko alebo nič:** jediný neplatný záznam, neznáma kategória či
  konflikt odmietne celú potvrdzovanú dávku. Žiadny čiastočný úspech.
  Náhľad odmietne rovnaký neplatný vstup bez akéhokoľvek zápisu.
- **P2 — neznáme kategórie:** názov kategórie musí presne zodpovedať jednej
  kategórii prihláseného používateľa. Žiadne tiché vytvorenie, hádanie,
  náhradná nekategorizovaná možnosť ani hľadanie u iného používateľa.
- **P3 — identita:** `(user_id, source, external_id)` identifikuje jeden
  importovaný záznam. Jeho opätovné použitie s inou sumou, dátumom, názvom
  kategórie či poznámkou vyvolá viditeľný konflikt `409`. Opakovanie
  rovnakého záznamu vráti identitu pôvodnej transakcie, nie ďalší výdavok.
  Zmazaný originál zostáva náhrobným záznamom a opakovaním sa neobnoví.
- **P4 — neukladaný náhľad:** náhľad nerezervuje záznamy ani neudeľuje
  schválenie. Potvrdenie znovu validuje odoslanú dávku voči aktuálnym dátam.
  Prehliadač vyžaduje výslovnú kontrolu/akciu Confirm; volajúci API môže
  zavolať confirm priamo. Token náhľadu vynucovaný serverom je mimo tejto
  prvej etapy.
- **P5 — malý pevný rozsah:** jeden zdroj a najviac desať záznamov na
  požiadavku. Nejde o hromadný importér, parser CSV, bankový konektor ani
  univerzálnu synchronizačnú službu.

<a id="request-and-response-outline"></a>

## Náčrt požiadavky a odpovede

`POST /api/imports/preview` a `POST /api/imports/confirm` vyžadujú bežný
bearer token a dedia `X-Request-Id` i štandardný tvar chyby JSON.
Obe prijímajú presne:

```json
{
  "source": "synthetic-demo-v1",
  "records": [
    {
      "external_id": "sample-grocery-001",
      "amount_cents": 3500,
      "spent_on": "2026-09-29",
      "category_name": "Groceries",
      "note": "Synthetic example"
    }
  ]
}
```

Hodnoty príkladu sú vymyslené; `3500` znamená €35.00. Fixtúry ani logy
nesmú obsahovať skutočné mená, kontakty, čísla účtov či záznamy obchodníkov.

- Vyžadujte objekt JSON presne s `source` a `records`; 1–10 záznamov
  a jedinečné externé ID v dávke. Odmietnite ďalšie polia, prázdne polia
  záznamov a nepodporované zdroje.
- Každý záznam musí mať presné polia vyššie, iba `note` možno vynechať alebo
  nastaviť na `null`. `external_id` má 1–64 znakov ASCII: písmená, číslice,
  `_` alebo `-`; voliteľná poznámka je obmedzená na 160 znakov.
  Tieto hranice vstupu sú predbežné.
- `amount_cents` je kladné celé JSON **číslo** v existujúcom hornom limite
  sumy. Číslo v úvodzovkách, desatinné číslo, nula, záporná alebo príliš
  vysoká hodnota je neplatná. Neprebieha prevod na EUR ani zaokrúhľovanie.
- `spent_on` je platný lokálny dátum `YYYY-MM-DD` a rešpektuje existujúce
  ohraničenie dátumu výdavku. `category_name` je presný neprázdny názov
  vlastnenej kategórie; chýbajúca kategória či kategória iného používateľa
  je nedostupná a nemapuje sa na jeho ID.
- Náhľad vracia normalizované záznamy s vyriešenou vlastnenou kategóriou
  a príznakom `new` alebo `already_imported`. Nevytvára transakciu,
  riadok registra požiadaviek ani riadok náhľadu. Konfliktná externá
  identita vracia `409` bez zápisu.
- Potvrdenie vracia ID každej transakcie a informáciu, či vznikla nanovo
  alebo bola opakovaná; opakovaná dávka dá tie isté ID bez nových transakcií.
  Odpoveď neobsahuje prihlasovacie údaje, surový upstream payload ani
  záznamy iného používateľa.


<a id="atomicity-and-retry-design"></a>

## Návrh atomicity a opakovania

Zdrojom pravdy sú existujúci [register `transaction_requests`](../../../../src/schema.sql),
cesta uloženia transakcie s kľúčom a správanie náhrobných záznamov. Odvoďte
stabilný operačný kľúč s 8–64 znakmi z pevného zdroja a externého ID,
vymedzený existujúcim `user_id` v registri. Jeho prefix `import_` zámerne
leží mimo abecedy verejného `Idempotency-Key`, aby bežné uloženie výdavku
nemohlo obsadiť identitu importu. Pred prijatím opakovania porovnajte
kanonický odtlačok **všetkých sémantických polí dodaných zvonka**; zmeny
sa nesmú ticho prepísať. Znovu použite jadro ukladania transakcií
s kľúčom; nestavajte druhé nezávislé úložisko deduplikácie.

Potvrdenie musí spracovať celú dávku v jednej SQLite transakcii
`BEGIN IMMEDIATE`. Vnorené pomocné funkcie ukladania s kľúčom môžu
používať savepointy, no nezachytená chyba musí vrátiť všetky zápisy
vonkajšej transakcie. Prehliadač nesmie reťaziť samostatné volania
`POST /api/transactions`: to by umožnilo čiastočne uloženú dávku.
Odpojený klient alebo simulovaná strata odpovede môže opakovať s rovnakým
zdrojom/ID a dostať pôvodný výsledok. Náhľad môže čítať existujúce
položky registra, ale nesmie ich meniť.

<a id="traceability-and-evidence-to-add-with-implementation"></a>

## Sledovateľnosť a dôkazy, ktoré treba pridať pri implementácii

| Požiadavka | Automatizovaný dôkaz |
|---|---|
| PRE-1 Náhľad je iba na čítanie | Porovnať riadky transakcií a registra kľúčov pred/po náhľade, aj pri zlyhaní. |
| VAL-1 Prísny tvar, celé centy, dátum a vlastnená kategória | API prípady neplatného typu/hraníc/dátumu/kategórie/nadbytočného poľa vytvoria nula zápisov. |
| AT-1 Potvrdenie je všetko alebo nič | Neskorší záznam zlyhá po skoršom platnom; nezostane výdavok ani kľúč. |
| ID-1 Opakovanie s tou istou externou identitou je bezpečné | Prvé potvrdenie, opakovanie rovnakej dávky a simulovaná strata odpovede vytvoria jeden výdavok na ID. |
| ID-2 Zmenený obsah vyvolá konflikt | Rovnaké ID so zmenenou sumou/dátumom/kategóriou/poznámkou vráti `409` bez prepísania. |
| ISO-1 Izolácia podľa používateľa | Dvaja používatelia môžu mať rovnaké externé ID bez zdieľania výsledkov; cudzia kategória sa odmietne. |
| UI-1 Výslovná kontrola pred uložením | Test prehliadača overí, že samotný náhľad nemení počty; uloží iba Confirm. |

Pevná syntetická demo akcia otvorí na stránke Add kontrolný dialóg. Najprv
odošle náhľad, ponechá Confirm vypnuté do úspešnej kontroly a potvrdí až
po výslovnom kliknutí. Demo používa vygenerované externé ID a vyžaduje
štartovaciu kategóriu `Groceries`; ak chýba, odmietne pokračovať namiesto
kopírovania vlastného názvu kategórie do lokálneho úložiska. Rozpracovanú
syntetickú dávku uchová lokálne pod číselným ID daného účtu až do potvrdenej
odpovede, takže po strate odpovede a obnovení/znovuotvorení opakuje **to isté**
externé ID; do návrhu sa nekopíruje token ani skutočný text transakcie.
Nejde o všeobecný editor JSON ani externý konektor. Osobitný offline testovací
príkaz je `npm run test:import`; úloha API CI ho spúšťa. Test prehliadača je
`qa/e2e/synthetic-import.spec.js`. Lokálne príkazy ani zapojenie CI
nedokazujú zelený vzdialený beh pre nový commit.

Pred tvrdením, že implementácia je hotová, aktualizujte kontrakt OpenAPI,
kontroly zdrojovej operácie a skutočnej odpovede, kolekciu požiadaviek,
prehliadačové testy, trasu v README a príslušné sady CI. Zaznamenajte
skutočné lokálne výsledky; bez behu na presnom SHA ich neoznačujte za
výsledky GitHub CI. Prijatie vlastníkom zostáva otvorené, kým vlastník
nevykoná a nezaznamená vlastnú kontrolu.

<a id="offline-http-boundary--isolated-test-demonstrator-only"></a>

## Offline HTTP hranica — iba izolovaná testovacia demonštrácia

Commitnutý produkt stále prijíma syntetický JSON od volajúceho; žiadna
verejná trasa ani produktový tok neposiela HTTP požiadavku poskytovateľovi.
Lokálny adaptér a testy s jednorazovým stubom teraz vykonávajú skutočnú
loopback požiadavku, po ktorej nasleduje existujúci náhľad iba na čítanie.
Nie sú bankovým konektorom ani dôkazom skúsenosti s externým poskytovateľom.
Pred tým, než by sa toto správanie stalo produktovým, musí vlastník
skontrolovať nižšie uvedené predpoklady.

- Cieľ adaptéra je pevný loopback stub `http://127.0.0.1` zvolený nastavením
  testu/dema, nikdy URL dodaná volajúcim API. Presmerovania a externé hosty
  sa odmietajú. Akákoľvek autorizačná hodnota je falošná, jednorazová
  a chýba v odpovediach, logoch aj commitnutej konfigurácii.
- Jedna požiadavka má konečný časový limit a obmedzenú veľkosť tela odpovede;
  adaptér odmietne priveľké telo pred parsovaním. Prijíma iba objekt JSON
  s 1–10 záznamami, ktoré sa prísne mapujú na existujúci tvar náhľadu
  `synthetic-demo-v1` vrátane celočíselnej hodnoty `amount_cents`,
  platných dátumov a obmedzených polí. Existujúci náhľad zostáva
  konečným validátorom vlastníctva/kategórie/konfliktov.
- Timeout, chyba prenosu, stav mimo 2xx (vrátane odmietnutej autorizácie),
  neplatný JSON, neplatný tvar/typ poľa, priveľa záznamov či priveľká
  odpoveď vedú k bezpečnej všeobecnej chybe bez autorizačnej hodnoty
  stubu alebo surového payloadu. Presné mapovanie HTTP stavov a číselný
  časový/veľkostný limit sú **predbežné rozhodnutia na kontrolu vlastníkom**,
  nie zavedené produktové kontrakty. Nedochádza k automatickému
  opakovaniu ani uloženiu.
- Každé zlyhané načítanie či náhľad ponechá transakcie Wallet a register
  požiadaviek nezmenené. Úspešné načítanie iba zásobí existujúci náhľad
  na čítanie; uloženie stále vyžaduje neskoršie výslovné Confirm cez
  existujúcu atómovú idempotentnú cestu podľa používateľa. Stratená
  odpoveď Confirm sa opakuje s rovnakými externými ID, nikdy s novými.

Izolované testy musia preukázať: skutočná loopback požiadavka →
validovaný náhľad iba na čítanie → výslovné potvrdenie; odmietnutie
timeoutu, stavu mimo 2xx/autorizácie, chybného JSON, neplatného záznamu,
počtu záznamov a bajtového limitu s nulou zápisov; žiadny únik falošnej
autorizácie či payloadu; opakovanie po strate odpovede bez duplikátov
výdavkov; a izoláciu rovnakých externých ID a kategórií medzi dvoma
používateľmi. Tieto testy nedokazujú verejný konektor ani produktové
pravidlo prijaté vlastníkom.
