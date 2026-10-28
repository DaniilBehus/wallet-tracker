[English](../../../../qa/docs/accessibility-baseline.md) · **Slovenčina**

<!-- locale-links-v1: source-relative links rebased for locales/sk -->

<a id="accessibility-baseline--local-evidence-not-a-wcag-certification"></a>
# Základná úroveň prístupnosti — lokálne dôkazy, nie certifikácia WCAG

> **Ukazovateľ na aktuálny stav (2026-10-13):** zmeny toku práce a správania
> Escape/obnovenia fokusu opísané nižšie sú prítomné v lokálnom commitnutom
> HEAD `b270355`. Datovaný text základnej úrovne nižšie zostáva zachovaný
> tak, ako bol zaznamenaný; jeho skoršie tvrdenie „not committed“ je
> historické, nie opis dnešného stavu zdroja. Nevyriešené obmedzenia fokusu,
> kontrastu, CI a vydania uvádza [aktuálny stav QA](../../docs/qa-status.md).

[← Späť na README](../../README.md) · [Kontroly stavov a testy klávesnice](../../../../qa/a11y/baseline.spec.js) · [Dôkazy o vykreslenom kontraste](../../../../qa/a11y/contrast-evidence.spec.js) · [Ďalej: plán testov rozhrania →](test-plan.md)

Prvý záznam je z 2026-10-07; prísne regresné opakovanie z 2026-10-08
sa týkalo necommitnutých zmien nad
`47636553ba622e336aebcabbd00d2ba7e8950d89`. Spustenie
`npm run test:a11y` vytvorí nový ignorovaný HTML report Playwright v
`qa/reports/playwright-a11y/`; ku každému dosiahnutému stavu je pripojený
úplný strojovo čitateľný JSON axe vrátane všetkých porušení a nejednoznačných
výsledkov. Sada používa jednorazovú lokálnu demo databázu AI a ochranu
proti sieti. Nevolá skutočného poskytovateľa AI, nepoužíva skutočný účet
ani nemeria prístupnosť živej služby. Tok práce teraz plánuje tento príkaz
po bežnej sade E2E, ale táto zmena toku práce **nebola** commitnutá,
pushnutá ani overená v GitHub Actions.

<a id="scope-and-result"></a>
## Rozsah a výsledok

Aktuálny prísny lokálny beh úspešne dokončil 12 testov Playwright: šesť
pri 320×568 a šesť pri 1280×800. Pri každej veľkosti dosiahol a skontroloval
pomocou axe 11 stavov rozhrania s pravidlami `wcag2a`, `wcag2aa`,
`wcag21a` a `wcag21aa` bez vylúčených oblastí či vypnutých pravidiel.
Úplné nefiltrované výsledky sa prikladajú **predtým**, ako každý sken
overí `violations == []`. Obe negatívne kontroly zachytili chýbajúci
alternatívny text obrázka (`image-alt`), takže nejde o falošne zelený
sken prázdnej stránky. Ďalšie testy pokrývajú ohraničenú navigáciu
klávesnicou a dôkazy o vykreslenom kontraste; sú to kontroly, nie ďalšie
ID pravidiel axe.

Automatizovaný výsledok axe: **0 potvrdených porušení, 140 nejednoznačných
uzlov color-contrast v 22 skenoch** (70 na každú veľkosť, 28 rôznych
cieľových prvkov). `incomplete` nie je ani úspech, ani potvrdená chyba:
tieto ciele vyžadujú ďalšie posúdenie kontrastu. Presný počet uzlov sa
môže meniť podľa vykresleného stavu; porovnávajte dôkazy podľa pravidla
a cieľa, nie číslo 140 ako trvalú hraničnú hodnotu. Automatické kontroly
nedokážu potvrdiť úplný súlad s WCAG ani nahradiť posúdenie pomocou
asistenčných technológií.

| Stav (pri každej veľkosti) | Nejednoznačné uzly | Reprezentatívne ciele |
|---|---:|---|
| Prihlásenie / registrácia | 11 / 11 | `.auth__eyebrow`, `#auth-submit`, štítky a vstupné polia |
| Add / chyba validácie | 7 / 6 | `#amount-display`, `.note__label`, spodná navigácia |
| Month s limitom kategórie | 13 | `#income-value`, `#limit-value`, text prstencového grafu a navigácia |
| Dialóg limitu kategórie | 0 | V tomto dosiahnutom stave nebol nejednoznačný uzol |
| Editor výdavku | 13 | Hodnoty Month pod oknom a ovládanie mazania iba ikonou |
| Upcoming / Schedules | 3 / 4 | Štítky spodnej navigácie |
| Opis / kontrola v demo AI | 1 / 1 | Ikonový znak `#ai-close` |

Všetkých 140 uzlov patrí k pravidlu axe `color-contrast`. Nástroj nedokázal
určiť pozadie za niektorým textom pre gradient alebo pseudoelement; dva
textové ciele prstencového grafu označil za prekryté a ikonové znaky boli
nejednoznačné, pretože nejde o textové znaky. Ide o konkrétne obmedzenia
skenera, **nie o dôkaz, že aktuálny kontrast vyhovuje**. Úplné podrobnosti
pravidla, ciele a `failureSummary` zostávajú v ignorovaných prílohách JSON.

<a id="keyboard-regression-and-the-one-confirmed-fix"></a>
## Regresia klávesnice a jedna potvrdená oprava

Nová regresia klávesnice prejde a aktivuje všetky štyri pomenované tlačidlá
spodnej navigácie pomocou Tab/Enter, overí `:focus-visible` a skutočný
obrys a ohraničeným prechodom Tab dosiahne ovládacie prvky formulára
Schedules. Overí počiatočný fokus editora výdavku, jeho zatvorenie cez
Escape a návrat fokusu. Existujúce kontroly udržania fokusu a Escape pri
limite kategórie aj kontroly fokusu/Escape natívneho dialógu AI zostávajú.
**Nejde** o úplné posúdenie klávesnice ani čítačky obrazovky.

Pred opravou produktu mobilný test dosiahol editor výdavku, ale zlyhal:
po stlačení Escape zostal `tx-edit-amount` viditeľný. Minimálna zmena
`public/app.js` teraz cez Escape toto okno zatvorí a vráti fokus na
prvok, ktorý ho otvoril; rovnakú cestu návratu používajú Cancel
a zatvorenie kliknutím na pozadie. Správanie ukladania, opätovného
načítania, peňazí ani API sa nezmenilo. Cielené mobilné a počítačové
regresie potom prešli 2/2. Editor je stále vlastné okno, nie natívny
modálny dialóg; táto kontrola netvrdí úplné zachytenie fokusu ani správanie
asistenčných technológií.

<a id="bounded-rendered-contrast-inspection"></a>
## Ohraničené posúdenie vykresleného kontrastu

Agent prezrel ignorované celostránkové snímky prihlásenia, Add, Month
a kontroly AI pri oboch veľkostiach. Opakovateľný test tiež číta skutočné
farby popredia vypočítané prehliadačom a **nepriehľadné podklady bez obrázkov**,
používa [vzorec WCAG pre relatívnu svietivosť a pomer kontrastu](https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio)
a vyžaduje 4.5:1 pri štyroch známych vykreslených dvojiciach. Výsledky
boli pri oboch veľkostiach rovnaké: text/e-mailové pole pri prihlásení
14.95:1, text/pole hesla 14.95:1, znak AI Close/plná hlavička
13.79:1 a text AI demo/plný banner 9.23:1. Snímky a JSON vypočítaných
farieb sú v ignorovanom lokálnom reporte Playwright. Čísla potvrdzujú
**iba tieto dvojice**, nie celú stránku.

Textu nad pseudoelementom prihlásenia, gradientmi Add alebo Month,
prekryvnou vrstvou prstencového grafu ani priesvitnou spodnou navigáciou
nebol priradený pomer: ich skutočný podklad sa mení alebo má vrstvy.
Na skúmaných snímkach boli príslušný text a štýl fokusu rozpoznateľné,
ale toto pozorovanie nie je matematickou hranicou najhoršieho prípadu.
Ciele zostávajú nevyriešené pre budúce cielené vizuálne/pixelové
posúdenie. Ak spoľahlivý najhorší prípad klesne pod štandard, stabilný
nepriehľadný podklad za textom je menšia oprava ako odstránenie
tmavého/mätového dizajnu. Nevypínajte pravidlá axe len preto,
aby bol report zelený.

<a id="ai-failure-artifacts"></a>
## Artefakty zlyhania AI

Úloha AI v CI teraz ponúka nahratie artefaktov pri zlyhaní na sedem dní,
obmedzené na `qa/reports/playwright-ai/` a `test-results/ai/`.
Jednorazové lokálne zlyhanie prehliadača po vykreslení prihlasovacej
obrazovky vytvorilo neprázdne HTML (518,211 bajtov), snímku
(189,702 bajtov) a stopu (250,046 bajtov) v týchto ignorovaných
umiestneniach; dočasná chybná špecifikácia bola odstránená.
Následný bežný prehliadačový beh AI prešiel 50/50. Pri zlyhaní ešte
pred štartom prehliadača nemusí existovať snímka ani stopa; taký prípad
spracuje `if-no-files-found: ignore`. **Lokálne vytvorenie artefaktov
nedokazuje ich nahratie v GitHub Actions**; vzdialené overenie čaká
na CI po samostatne autorizovanom commite a pushi.

`npm audit` spustený iba na čítanie hlási 26 upozornení v aktuálnom
úplnom strome závislostí (9 stredných, 15 vysokých, 2 kritické), vrátane
jedného kritického upozornenia aj pri vynechaní vývojových závislostí.
Ani jeden z dvoch novo pridaných balíkov s presne určenou verziou
(`@axe-core/playwright@4.13.0` a `axe-core@4.13.0`) nemá
v tomto reporte upozornenie. Porovnanie lockfile so základným commitom
našlo iba tieto dva pridané vývojové balíky, žiadny odstránený
ani verziou zmenený existujúci balík a nezmenené koreňové produkčné
závislosti. Širšia oprava závislostí je samostatná práca;
nespustila sa oprava auditu ani nesúvisiaca aktualizácia.

<a id="2026-10-16-local-expense-modal-follow-up"></a>
## Lokálne pokračovanie modálneho editora výdavku — 2026-10-16

Skoršie pozorovania okna a 140 neúplných výsledkov kontrastu uvedené
vyššie sú historické výsledky, nie nové prehodnotenie. Cielený offline
beh pri 320×568 a 1280×800 teraz používa pomenovaný natívny dialóg
výdavku. Nameraný Shift+Tab pred opravou presunul fokus z Amount
do ovládania prehliadača (`BODY`, `document.hasFocus() === false`),
hoci `open` aj `:modal` zostali true; pokus presunúť fokus na
navigáciu v pozadí ju neaktivoval. Malý obslužný kód na hranici prvého
a posledného prvku potom udržal fokus na Cancel a zachoval fokus
prehliadača pri oboch šírkach. Editor aj stav jeho validačnej chyby
v dialógu boli skontrolované pomocou axe bez potvrdených porušení
s označením WCAG; úplné dôkazy zostávajú v ignorovaných prílohách.
Cielené kontroly tiež vyskúšali odmietnutie kliknutia na pozadie,
tri spôsoby zatvorenia, čakajúci/odmietnutý PATCH, Save bez zmeny
a zatvorenie po skončení relácie. Samostatná [lokálna správa](test-report-modal-bind.md)
uvádza príkazy a hranice. Neodstraňuje skoršiu neistotu kontrastu,
nepotvrdzuje súlad s WCAG a nie je UAT vlastníka ani vzdialeným CI.
