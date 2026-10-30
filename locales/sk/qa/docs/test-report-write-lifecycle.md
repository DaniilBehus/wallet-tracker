[English](../../../../qa/docs/test-report-write-lifecycle.md) · **Slovenčina**

<a id="f06f10-local-write-recovery-and-request-lifecycle-report"></a>

# F06/F10 lokálny report obnovy zápisu a životného cyklu požiadavky

[← Späť na README](../../README.md#qa-evidence) · [Kontrakt obnovy](analysis-write-recovery.md) · [Ďalej: nastavenie testov →](../../docs/testing.md)

Dátum: 2026-10-17. Opisuje **necommitnutý lokálny
checkout**, nie výsledok vzdialeného CI, vydanie,
UAT vlastníka ani dôkaz každej sieťovej chyby.

<a id="observed-problem-and-repair"></a>

## Pozorovaný problém a oprava

Tri riadené browserové testy pred opravou zlyhali:
bežné Save a Pay sa commitli na jednorazový server,
ale stratili odpoveď a neponúkli obnovu s rovnakou
identitou; staršia odpoveď Month nahradila novší
súčet. Testy používajú skutočný lokálny commit
nasledovaný zadržanou odpoveďou prehliadača,
nie falošný úspešný výsledok. Po oprave Save
a Pay s kľúčom pred odoslaním uložia zmrazenú
operáciu v rozsahu účtu do úložiska prehliadača.
Neistý výsledok zostáva viditeľný; iba výslovná
kontrola/opakovanie použije ten istý kľúč a telo.
Nová zámerná akcia dostane iný kľúč. Serverová
voliteľná vetva Pay atómovo zaznamená/opakuje
kľúč vrátane poslednej splátky pôžičky; Pay
bez kľúča zostáva kompatibilný. Nečitateľný
záznam obnovy blokuje nové finančné zápisy
namiesto tichého odhodenia dôkazu.

Prehliadač stráži aktuálnu reláciu a generáciu
obrazovky po parsovaní tela odpovede aj pri
odmietnutých požiadavkách, obmedzuje hlavičky
**aj telo** požiadavky desaťsekundovým termínom
a dovoľuje uvoľniť ovládanie iba aktuálnemu
vlastníkovi stavu busy. Pôvodné odovzdanie
relácie z auth do aplikácie nechávalo `busy`
nastavené; lokálna oprava sa potvrdila cielenou
regresiou. Navigácia po obrazovkách finančný
zápis automaticky neopakuje.

Skorší spravovaný základný beh so **210 testmi**
po prvej oprave prešiel 204/210. Odhalil regresie
textu odmietnutého Pay a navigácie pri štarte
aplikácie; tie sa opravili a prešli cielenými
opakovaniami. Samostatné zlyhanie krátko žijúceho
toastu nemalo preukázanú príčinu; spätne sa
neoznačuje za flaky ani vyriešené aserciou.
Neskoršie doplnené testy zvýšili zistený súčet
na 218, takže nižšie uvedené behy nemajú
rovnaký inventár.

<a id="local-results"></a>

## Lokálne výsledky

| Kontrola | Výsledok a hranica |
|---|---|
| Riadené testy pred opravou | 3 očakávané červené: Save so stratenou odpoveďou, Pay so stratenou odpoveďou, zastaraný súčet Month. |
| Nové browserové scenáre `support_control:` | 26/26 na telefóne a desktope po záverečnej úprave bariéry callbacku: opakovanie commitnutých Save/Pay, odlišná ďalšia akcia, uzavretie poslednej splátky, obnovenie/oddelenie účtov, zlyhania úložiska a neplatného tela, konečný termín tela, zastarané callbacky 401/sieťovej chyby/čítania/obrazovky/busy. Doplnkové kontroly, **nie** nové ID katalógu. |
| Hlavná spravovaná browserová sada | Skorší beh s 210 testmi: 204/210 s vyššie uvedenými rozdielmi. Neskorší beh s 218 testmi: 217/218; jedna desktopová fixtúra zlyhala pri `page.goto('/')` s `net::ERR_ABORTED` pred scenárom stavu kategórie. Presne ten scenár potom prešiel samostatne 2/2. Po testovacej úprave bariéry callbacku samostatný úplný spravovaný beh so štyrmi lokálnymi workermi prešiel **218/218**. |
| AI v prehliadači a syntetický import | 50/50 browserových scenárov s lokálnym falošným poskytovateľom; 11/11 offline kontrol syntetického importu. Bez volania živého poskytovateľa. |
| Kontraktové a statické kontroly | 18/18 kontraktových testov (vrátane Pay s kľúčom a starého správania); 62/62 kontrol inventára/sledovateľnosti/validátora; 13/13 kontrol plánu CI; aktuálny inventár zdroja 280 hlavných prípadov; statická sledovateľnosť 280 ID/78 definícií; OpenAPI 21/21 operácií a 308 lokálnych referencií; `scripts/check.js` 8/8. Tieto statické kontroly nevykonávajú 280 prípadov katalógu. |

Zlyhanie nastavenia v behu 217/218 sa bez dôkazov
nepripisuje produktu ani neoznačuje za flaky;
neskorší celý zelený beh je samostatný dôkaz,
nie spätný úspech toho behu či skoršieho 204/210.
Netvrdí sa vzdialený beh CI ani publikovanie
na presnom SHA. Lokálne úložisko prehliadača
nie je atómový zámok medzi kartami; ručne
opustená neistá operácia sa už mohla commitnúť,
preto je varovanie zámerné. Kontrola vlastníka,
úplné kombinované overenie a rozhodnutie o vydaní
zostávajú oddelené.

<a id="scoped-independent-local-review--2026-10-17"></a>

## Nezávislá lokálna revízia v danom rozsahu — 2026-10-17

Nezávislý agent preskúmal zmrazený zdroj F06/F10
a lokálne dôkazy a prijal **obe zistenia lokálne**.
Počet lokálne prijatých zistení je teraz **23/25
(92% podľa počtu zistení, nie pokrytia, námahy,
času ani pripravenosti vydania)**. Revízia
nemení statický inventár na behaviorálne
vykonanie, nedokazuje vzdialené CI necommitnutého
stromu, neuzatvára UAT vlastníka ani neoprávňuje
publikovanie. Overenie kombinovaného stromu
a rozhodnutie o vydaní zostávajú otvorené.
