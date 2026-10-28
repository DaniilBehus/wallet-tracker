[English](../../../../qa/docs/analysis-write-recovery.md) · **Slovenčina**

<a id="financial-write-recovery-and-request-lifecycle"></a>

# Zotavenie finančného zápisu a životný cyklus požiadavky

[← Späť na README](../../README.md#qa-evidence) · [Ďalej: lokálne overenie](test-report-write-lifecycle.md)

<a id="scope-and-evidence-boundary"></a>

## Rozsah a hranica dôkazov

**Základný stav pred implementáciou, zaznamenaný 2026-10-17:** bežné
uloženie výdavku v Add a Pay pri pravidelnej platbe nemali v prehliadači
identitu na zotavenie, keď server zápis potvrdil, ale odpoveď sa stratila.
Vtedy tento dokument definoval kontrakt voliteľného zotavenia;
netvrdil, že strata odpovede bola reprodukovaná v prehliadači,
a súbehy čítania jadra boli rizikami zdroja čakajúcimi na kontrolované testy.
Tieto vety opisujú skorší stav, **nie** aktuálnu lokálnu implementáciu.
[Neskoršia lokálna správa](test-report-write-lifecycle.md) zaznamenáva
skutočné dôkazy z prehliadača pred opravou a po nej, samotnú opravu
a ohraničenú nezávislú kontrolu. Existujúce kontrakty AI a syntetického
importu zostávajú osobitné.

<a id="one-deliberate-financial-action"></a>

## Jedna vedomá finančná akcia

Pred odoslaním vytvorte UUID a zmrazte záznam viazaný na účet. Save
zmrazí sumu, kategóriu, poznámku a výslovný lokálny `spent_on`; Pay
zmrazí ID pravidelnej platby, zobrazený názov/sumu/kategóriu/počet
zaplatených a celkový počet, aj výslovný dátum. Každé UUID operácie
má vlastný kľúč v lokálnom úložisku pod menným priestorom účtu JWT `sub`,
nie jeden prepísateľný slot účtu. Záznam neobsahuje token. Ak trvalý
zápis zlyhá, odoslanie sa odmietne; chybné uložené záznamy sa izolujú
a blokujú ďalšiu finančnú akciu namiesto tichého zahodenia. Zobrazujú
sa všetky nevyriešené záznamy aktívneho účtu; žiadny iný účet ich
nesmie vidieť ani odoslať. Viac kariet prehliadača môže stále súťažiť:
lokálne úložisko nie je atómový zámok medzi kartami a návrh nesľubuje
presne jeden *zámer*.

Stavy: `prepared → sending → confirmed | refused | uncertain`.
Platná úspešná odpoveď zhodná s tvarom a identitou operácie ju potvrdí
a odstráni iba jej vlastný kľúč z úložiska. Známa odpoveď 4xx pred
commitom je odmietnutá s konkrétnym vysvetlením; odpovede o konflikte
alebo zázname po vymazaní zostávajú viditeľné, kým ich osoba nepotvrdí.
Čerstvý kľúč sa nevyrába na obídenie konfliktu. Chyba siete, prerušenie,
10-sekundová lehota, 5xx, neplatná/ne-JSON/neúplná 2xx alebo prerušené
čítanie tela znamenajú **neistý** výsledok, nikdy „neuložené“.
Automatické opakovanie neexistuje. Výslovné **Check/retry** odošle
totožný kľúč, trasu a zmrazené telo. Pri upustení od neistého
záznamu treba varovať, že pôvodný zápis sa už mohol potvrdiť.
Skutočne nový rovnaký nákup alebo ďalšia splátka dostanú nové UUID
až po vyriešení predchádzajúcej akcie. Jedna nevyriešená akcia
blokuje nové Save/Pay v danom účte, kým sa nevyrieši alebo sa od nej
výslovne neupustí.

Navigácia záznamy zachováva; odhlásenie ich skryje bez zmazania
či opätovného odoslania. Znovunačítanie alebo opätovné prihlásenie
do rovnakého účtu obnoví `sending` ako `uncertain`; iný účet
ich nemôže obnoviť. Neskorá odpoveď alebo `finally` smie aktualizovať
iba pôvodný účet/reláciu/akciu, nikdy novšiu. Zlyhanie úložiska
nesmie ticho zmeniť zápis s kľúčom na zápis bez kľúča.

<a id="server-contracts"></a>

## Kontrakty servera

`POST /api/transactions` už prijíma `Idempotency-Key` viazaný na účet
s výslovným `spent_on`, atómové uloženie kľúča a výdavku, opakovanie
s rovnakým kľúčom, konflikt pri zmenenom obsahu a záznam po vymazanom
origináli. Bežné Save ho bude používať. Jeho API bez kľúča zostáva
nezmenené.

`PATCH /api/schedules/{id}/pay` získava voliteľné telo s kľúčom
obsahujúce `expected_paid_count`, `expected_amount_cents`,
`expected_category_id`, `expected_name`, `expected_total_count`,
`spent_on`. ID v trase a zmrazené polia tvoria kanonický hash
oddelený podľa druhu operácie. V jednej transakcii `BEGIN IMMEDIATE`
sa najprv kontroluje existujúci kľúč účtu: zhodný hash a pôvodný
výdavok stále vlastnený účtom a naviazaný na túto pravidelnú platbu
vrátia uložený pôvodný výsledok, aj keď posledná splátka už pôžičku
uzavrela. Zmenený obsah alebo opätovné použitie kľúča v inom druhu
operácie je 409; zmazaný originál je 409 pre nedostupné opakovanie.
Pri novom kľúči sa pred vytvorením jedného naviazaného výdavku
overí vlastníctvo, dátum, aktívny stav a nezmenené zobrazené
predpoklady; potom sa zvýši `paid_count`, prípadne uzavrie
posledná splátka pôžičky a atómovo sa uloží odpoveď/kľúč.
Čerstvý kľúč so zastaraným zobrazením je 409, nie odhadnuté
opakovanie. Existujúce stĺpce `transaction_requests` stačia;
migrácia nie je potrebná. Požiadavka a odpoveď Pay bez kľúča
zostávajú kompatibilné.

<a id="read-lifecycle-and-finite-deadline"></a>

## Životný cyklus čítania a konečná lehota

Každá požiadavka jadra zachytí token a epochu relácie. Odpoveď 401
môže odhlásiť iba stále aktuálnu reláciu. Každé načítanie obrazovky
má generáciu a zmeny stavu, DOM, kurzora, tlačidla zaneprázdnenia
a oznámenia po *každom* await — vrátane parsovania tela JSON —
vyžadujú tú istú generáciu účtu/relácie/obrazovky/akcie.
Zrušenie nahradeného čítania je optimalizácia, nie dôkaz správnosti.
10-sekundová lehota pokrýva hlavičky aj telo. Finančný zápis,
ktorý vyprší alebo sa preruší, zostáva neistý a nikdy sa automaticky
neodošle znova.

<a id="verification-oracle"></a>

## Overovacie kritérium

Prehliadačové testy musia najprv zachytiť chybné stopy pred opravou.
Pre Save aj Pay musí `route.fetch()` nechať skutočný zápis na
jednorazovom serveri potvrdiť a potom zadržať/prerušiť odpoveď;
overiť uložené ID transakcie a počet platieb, neisté rozhranie,
rovnaký zmrazený kľúč/telo pri opakovaní, jeden uložený výsledok
a odlišnú identitu ďalšej skutočne novej akcie. Pokryte opakovanie
poslednej splátky pôžičky, zotavenie po znovunačítaní/prihlásení
do rovnakého účtu, skrytie pred cudzím účtom, zlyhanie úložiska
a neplatný tvar úspešnej odpovede. Pri čítaniach kontrolujte
staršie/novšie odpovede Month (vrátane oneskoreného JSON po hlavičkách),
zastarané 401/chybu/úspech po odhlásení a novom prihlásení,
opustenú obrazovku a zastarané dokončenie stavu zaneprázdnenia.
Ide iba o lokálne regresné výsledky; statické kontroly, výstup
plánu CI a UAT vlastníka sú oddelené triedy dôkazov.
