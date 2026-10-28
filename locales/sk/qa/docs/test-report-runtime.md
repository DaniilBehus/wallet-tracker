[English](../../../../qa/docs/test-report-runtime.md) · **Slovenčina**

<a id="runtime-compatibility--focused-local-report"></a>

# Kompatibilita runtime — cielená lokálna správa

[← Späť na README](../../README.md#qa-evidence) · [Ďalej: spustenie testov →](../../docs/testing.md)

<a id="requirement-and-risk"></a>

## Požiadavka a riziko

Nainštalovaný binding `better-sqlite3` vyžaduje Node-API 10. Predchádzajúca
podmienka engine `>=22` pripúšťala Node 22.9 s Node-API 9. Pohyblivý selektor
CI `22` zvyčajne vyberá najnovší patch v tejto vetve, takže neotestoval
deklarované minimum; nie je dôkazom, že CI skutočne vybralo Node 22.9.
Natívny pád pozorovaný v tomto runtime je v súlade s nesúladom API;
jeho presná príčina na úrovni natívnych inštrukcií nebola izolovaná. Tento
natívny pád neopakujte ako regresný test.

Balík a koreň lock súboru teraz určujú stabilný Node
`^22.14.0 || >=23.6.0`. CI pripína presne 22.14.0 ako východiskové minimum
kompatibility. Toto pripnutie nie je bezpečnostné odporúčanie; pri bežnom
používaní uprednostnite aktuálne opravené podporované LTS. Budúca verzia
spĺňajúca rozsah nie je automaticky certifikovaná týmto cieleným testom.

<a id="focused-checks"></a>

## Cielené kontroly

Prvé štyri nové kontroly pred opravou zlyhali: stará podmienka engine,
chýbajúca ochrana, staré minimum CI a pokus o natívny import pred odmietnutím.
Kontroly pokrývajú hranice stabilných verzií 22.13/22.14 a 23.5/23.6, novšie
hlavné verzie, Node-API 9/10, chýbajúce alebo neplatné API, nesprávne
formátované verzie a predbežné vydania. Úvodné kontroly tiež zmutovali kópiu
workflow, aby odmietli nesprávne minimum alebo nesprávnu hodnotu
`node-version` vrátane parsovania CRLF. Neskoršia cielená revízia zistila,
že globálne počty polí by stále mohli prijať pole presunuté do nesúvisiacej
akcie; oprava je opísaná nižšie. Jednorazový podradený proces simuluje
nepodporovaný runtime a zaznamenáva, že ho `src/db.js` odmietne pred načítaním
`better-sqlite3` alebo vytvorením dátového adresára.

Na presnom prenosnom spustiteľnom súbore Node 22.14.0 s Node-API 10 sa
úvodná cielená sada runtime/overovacích/E2E-runner testov skončila s
**30 úspešnými, 1 voliteľným preskočeným Windows symlink fixture,
0 neúspešnými** (spolu 31). Statická kontrola skončila s **8 úspešnými,
0 preskočenými, 0 neúspešnými**. Jedno kontrolované opakovanie existujúceho
HTTP kontraktu skončilo s **15 úspešnými, 0 neúspešnými**, s 340 overenými
skutočnými loopback odpoveďami naprieč 21/21 deklarovanými operáciami. Sú to
lokálne výsledky po zmene ochrany; skoršie zelené CI ani samotné simulované
hodnoty sa nepovažujú za aktuálny dôkaz celej sady.

<a id="follow-up-setup-node-input-binding-2026-10-12"></a>

## Následná oprava: väzba vstupu setup-node, 2026-10-12

Revízia našla jednu falošne pozitívnu kontrolu, nie chybu skutočného workflow:
starý pomocný nástroj počítal šesť krokov `setup-node` a šesť polí
`node-version` globálne. Presunutie poľa verzie kroku API do mapovania `with`
v `upload-artifact` zachovalo rovnaké počty, takže chybný workflow v pamäti
prešiel. Nová regresia najprv zlyhala s **“Missing expected exception”** presne
na tomto svedkovi presunutého vstupu. Skorší pokus obsahoval preklep v tvare
fixture pre krok nahrávania; táto chyba testovacieho rámca bola opravená pred
očakávaným zlyhaním a nebola chybou produktu.

Pomocný nástroj teraz kontroluje **vlastné** mapovanie `with` každého doslovného
kroku `setup-node@v4` na presne jeden vstup `${{ env.NODE_VERSION }}`. Odmieta
chýbajúce, duplicitné, nesprávne alebo presunuté hodnoty, duplicitné či
nejednoznačné `with`, zatienenie minima na úrovni jobu alebo kroku,
nepodporované vnorené tvary a neznáme verzie akcie `setup-node`. Nový fixture
`@v5` najprv zlyhal s **“Missing expected exception”**, pretože pomocný nástroj
hľadal iba výskyty `@v4`; skenovanie všetkých odkazov `setup-node@` teraz
nepodporovaný tvar odmieta namiesto jeho tichého vynechania. Súčasný workflow
prechádza s LF aj kanonickým CRLF; presunutý vstup a ostatné negatívne varianty
fixture sa odmietajú v oboch reprezentáciách. Ide o obmedzený parser pre
doslovný tvar krokov tohto workflow, nie o všeobecný parser YAML ani dôkaz
vykonania akcií GitHubu.

Následné presné spustenie runtime, overovacích a E2E-runner kontrol na
Node 22.14.0 / Node-API 10 skončilo s **32 úspešnými, 1 voliteľným preskočeným
Windows symlink fixture, 0 neúspešnými** (spolu 33). `scripts/check.js` opäť
skončil s **8 úspešnými, 0 preskočenými, 0 neúspešnými**. Pri tejto oprave
samotných testov sa neopakoval HTTP kontrakt, celá skupina CI ani vzdialený
workflow. BUG-034 zostáva IN PROGRESS a lokálny; čaká na publikovanie a
vzdialený dôkaz CI.

Koordinátor následne nahlásil nezávislé kombinované spustenie kontrol s
**31 úspešnými, 1 neúspešnou, 1 preskočenou**: kontrola pripravenosti skutočného
Wallet servera dosiahla päťsekundový timeout. Jedno cielené opakovanie prešlo
približne za 365 ms; príčina timeoutu zostáva nedokázaná a toto opakovanie nie
je najnovším zeleným kombinovaným behom. Po úzkych opravách CRLF fixture a
nepodporovanej verzie akcie sa tu opakovalo iba šesť runtime kontrol:
**6 úspešných, 0 neúspešných, 0 preskočených**. Skorší kombinovaný výsledok
s 32 úspechmi zostáva historický, nie je tvrdením o najnovšom strome.

<a id="limits"></a>

## Limity

Sondy hraníc verzií a poradia importov sú syntetické. Preukazujú správanie
ochrany, nie kompatibilitu natívnej binárky vo všetkých budúcich verziách.
Skutočný spustiteľný súbor Node 22.9 sa proti novej ochrane nespustil; jeho
skorší natívny pád sa úmyselne neopakoval.
Táto cielená práca netvrdí vykonanie celej skupiny CI, sady testov v
prehliadači, AI providera, opätovnej inštalácie závislostí ani vzdialeného
spustenia GitHub Actions.
