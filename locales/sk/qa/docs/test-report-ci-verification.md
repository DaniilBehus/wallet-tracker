[English](../../../../qa/docs/test-report-ci-verification.md) · **Slovenčina**

<a id="ci-equivalent-verification-and-retained-evidence--local-report"></a>

# Overenie ekvivalentné CI a uchované dôkazy — lokálna správa

[← Späť na README](../../README.md#qa-evidence) · [Príkazy spustenia](../../docs/testing.md) · [Spoločný plán](../../../../scripts/verification-plan.js) · [Ďalej: plán testov →](test-plan.md)

Zaznamenané 2026-10-10 na `b270355c8c850282b10cc0a7bdeb81c88b784765` plus lokálne, necommitnuté zmeny. **Nejde** o výsledok GitHub Actions, úplný lokálny CI PASS, UAT vlastníka ani meranie živého modelu.

<a id="f16-finding-and-local-change"></a>

## Nález F16 a lokálna zmena

Publikovaný základný workflow neobsahoval príkaz race, zatiaľ čo `npm test`
vynechával niekoľko sád CI. Skoršia necommitnutá zmena pridala race do úlohy
API, ale príkazy stále nemali jediný spoločný inventár lokálnych/CI úloh.
HTML/JUnit z Newmana a Python JUnit sa lokálne generovali bez zodpovedajúcich
krokov uchovania v CI. [BUG-032](../../log/BUGS.md) sleduje túto medzeru
v dôkazoch.

[Spoločný plán](../../../../scripts/verification-plan.js) teraz definuje šesť
vynucovaných skupín a 18 úloh. [Runner](../../../../scripts/verify-ci.js) používa
`verify:ci` aj jedno volanie v každej existujúcej úlohe CI. Zachováva
existujúci graf závislostí a offline sady; `npm test` zostáva staršou
podmnožinou. k6 a hodnotenie živého modelu sú výslovne mimo vynucovaného
plánu. `--plan` slúži len na čítanie: všetkých 18 úloh hlási `NOT_RUN`.
Neznáme, duplicitné alebo prázdne výbery skupín zlyhajú. Neexistuje prepínač
na preskočenie do zelenej. Neúspešný, signalizovaný alebo chýbajúci podradený
proces zastaví vykonanie a neskoršie úlohy zostanú `NOT_RUN`.

Runner spúšťa zavedené skripty priamo, takže lokálne overenie nevolá príkaz
Newman z balíka, ktorý načítava `.env`. Prostredia podradených procesov
zachovávajú runtime nevyhnutnosti vrátane `PYTHON`, ale odstraňujú zdedené
externé API URL, kľúče providerov a cesty skutočných databáz. Offline/loopback
testovacie runnery si zachovávajú vlastné jednorazové úložisko. Súhrn
spustenia sa zapisuje pod ignorované
`qa/reports/verification/<unique-run-id>/summary.json`; zaznamenáva ID/stavy/
návratové kódy úloh, HEAD, príznak špinavého stromu, fingerprint obsahu
zdroja a číselný CI run/pokus, ak sú prítomné. **Neukladá** výstup príkazov,
surový stderr, prihlasovacie údaje, hodnoty prostredia, osobné cesty ani
telá testov. Fingerprint hashuje obsah súborov sledovaných Gitom a
neignorovaných nesledovaných súborov **v čase volania**, nie ignorované
súbory, nainštalované závislosti, prostredie, celú históriu alebo neskoršie
úpravy. Lokálne súhrny skupín teda identifikujú snapshoty pri ich spustení,
nie text tejto neskoršej správy.

<a id="actual-local-outcomes"></a>

## Skutočné lokálne výsledky

| Vykonanie | Pozorovaný výsledok |
|---|---|
| `verify:ci -- --plan` | 18 úloh `NOT_RUN`; žiadne testy sa nevykonali. |
| Predvolené `verify:ci` | **FAIL**: lokálny spustiteľný súbor `gitleaks` nie je dostupný; sken tajomstiev v histórii sa nespustil, zostávajúcich 17 úloh `NOT_RUN`. Nič sa neinštalovalo ani neudelila výnimka. |
| Skupina API | **PASS 10/10 úloh**: pri tomto spustení overovacie kontroly 7/7, kontroly brán 31/31, dátumy 4/4, vlastná kontrola 8/8 bez preskočení, OpenAPI 21/21 operácií a 298 lokálnych referencií, kontrakt 15/15 s 340 validovanými skutočnými HTTP odpoveďami, DB 6/6, import 11/11, Newman 274 požiadaviek/945 asercí/nula zlyhaných skriptov a race 120 párov na scenár bez porušení vynucovaných invariantov. Race D nameral 120/120 duplicitných opakovaní bez kľúča; nie je to idempotency PASS. |
| Skupina Python | **PASS 1/1 úlohy**, 27/27 položiek pytest. |
| Konečné cielené kontroly | **9/9 PASS** po pridaní dvoch ďalších kontrol zlyhania artefaktov/dôkazov. Tieto dve kontroly **neboli** v skoršom spustení skupiny API. |
| Skupiny tajomstiev, Playwright/prístupnosti, Selenium, offline-AI/prehliadača | V tomto výseku sa ako skupiny nespustili. Predvolený beh sa zastavil na chýbajúcom predpoklade skenu tajomstiev; netvrdí sa PASS celého plánu. |

Beh API uchoval povolené `api-report.html`, `api-junit.xml` a
`race-summary.json`; beh Pythonu uchoval `python-junit.xml`. Kontroly
ukazujú, že chýbajúca alebo nebezpečná správa producenta nemôže premeniť
úspešnú úlohu na zelenú; odlišné behy dostávajú odlišné adresáre súhrnov;
zlyhávajúce/chýbajúce/signalizované podradené procesy a nezapisovateľné
umiestnenia dôkazov neprejdú. Runner zaznamená chýbajúcu diagnostiku ako
`ABSENT` alebo `NOT_RUN` a upozorní, ak sa k jej producentovi nedostal.
Staršie správy nečistí. Ukážky aktuálnych lokálnych správ boli preverované
na reťazce podobné JWT, dlhé bearer hodnoty, uvedené priradenia
prihlasovacích údajov, používateľské cesty Windows a neukážkové e-maily;
pripravené kópie touto cielenou kontrolou prešli. Takéto vzorové kontroly
nedokážu zaručiť neškodnosť ľubovoľného obsahu správy a do krátkeho súhrnu
sa nedávajú surové správy.

<a id="ci-preparation-not-remote-proof"></a>

## Príprava CI, nie vzdialený dôkaz

Upravený workflow stále má závislosti secret scan → API → Python →
browser/Selenium a API → AI. Každá úloha volá svoju presnú spoločnú
skupinu. `actions/upload-artifact@v4` zostáva, s
[vstupmi podporovanými danou verziou](https://github.com/actions/upload-artifact/tree/v4#inputs).
Kroky nahrávania používajú `if: ${{ !cancelled() }}`, sedemdňové uchovanie
a názvy obsahujúce úlohu, ID behu a pokus. Nahratia API/Python zahŕňajú
iba povolené správy pripravené runnerom a krátky súhrn; race JSON je
zahrnutý. Stopy zlyhaní browser/Selenium/AI zostávajú na predchádzajúcej
politike iba pri zlyhaní, teraz s jedinečnými názvami. Nenastavuje sa
nahrávanie celého workspace, `.env`, databázy ani skrytých súborov.
Chýbajúca voliteľná diagnostika sa neinterpretuje ako úspešný producent.

Tento workflow **nebol** pushnutý ani spustený na GitHube. `gitleaks` a
`actionlint` nie sú lokálne nainštalované a nesťahovali sa. Prehliadačové,
AI a secret úlohy potrebujú vlastné budúce autorizované vykonanie;
správanie nahrávania a stav CI celého stromu vyžadujú neskorší skutočný
beh na GitHube. Úspešná podmnožina API alebo Python sa nerovná tejto bráne
vydania.

<a id="exact-local-file-scope"></a>

## Presný rozsah lokálnych súborov

Nové: `scripts/verification-plan.js`, `scripts/verify-ci.js`,
`qa/verify/verify-ci.test.js` a táto správa. Rozšírené existujúce súbory:
`.github/workflows/ci.yml`, `package.json`, `docs/testing.md`,
`qa/docs/test-plan.md`, `log/BUGS.md`. Ostatných 22 súborov zo skoršieho
prijatého snapshotu 27 súborov si zachovalo očakávané hashe; týchto päť
existujúcich ciest sú povolené prekrytia. V tomto výseku sa nemenila
aplikácia, dátumy, AI, race ani implementácia skorších brán. Nič sa
nepridalo do stage, necommitlo ani nepushlo.

<a id="review-addendum--workflow-control"></a>

## Dodatok revízie — kontrola workflow

Skoršie cielené kontroly **9/9** prešli na skutočnom LF workflow, ale ich
predikát závislostí mohol čítať `needs: python` z *neskoršej* úlohy, keď
sa len E2E zmenilo na `needs: api`. Odmietal tiež ekvivalentný CRLF checkout.
Ide o chyby statickej regresnej kontroly, **nie** o pozorované chyby
aktuálneho workflow. Dva nové testy používajúce ten istý pomocný nástroj
kontroly ako skutočný workflow najprv vytvorili **9 úspešných / 2 neúspešné**
na starom predikáte. Pomocný nástroj teraz ohraničuje kontrolu na pomenovanú
úlohu, toleruje LF/CRLF a odmieta nepodporovanú alebo nejednoznačnú syntax
závislostí. Konečná cielená sada má **12/12 PASS**, vrátane samostatnej
kontroly nejednoznačného tvaru. Skoršia skupina API spustila sedem kontrol;
jej historický PASS ani neskorší deväťkontrolový výsledok sa nepreznačujú
na dvanásťkontrolový beh API. Kvôli tejto oprave samotných testov/dokumentácie
sa znovu nespustila žiadna skutočná skupina API, Python, browser, AI ani secret.

Zostávajúce neblokujúce limity sú explicitné. Odstránenie sledovaného
súboru môže spôsobiť zlyhanie tvorby identity zdroja **pred** zapísaním
súhrnu; nemôže sa zmeniť na PASS. Wrapper nemá timeout jednotlivých
podradených procesov, takže zaseknutý proces môže oddialiť verdikt.
Fingerprint opisuje iba uvedený zdroj v čase volania a bežné lokálne
nastavenia prehliadača sa môžu líšiť od nastavení iba pre CI.
Kontrola súkromia artefaktov je heuristická, nie dôkaz proti každej možnej
citlivej hodnote. Tieto limity sa tu neopravujú ani neprezentujú ako
otestované pokrytie. Úplné lokálne overenie, vzdialené nahratia a GitHub
CI zostávajú neoverené; BUG-032 je v procese až do publikovania a skutočného
behu.

**Následná oprava fixture koncov riadkov:** čisto čítací virtuálny pohľad
CRLF na ten istý workflow najprv vytvoril **10 úspešných / 2 neúspešné**:
mutačné testy nesprávneho E2E a nejednoznačného tvaru hľadali surové
oddeľovače LF pred volaním pomocného nástroja závislostí. Samotný pomocný
nástroj prijímal CRLF. Fixture teraz normalizuje pred nájdením/nahradením
riadku E2E `needs` a následne testuje kódovanie LF aj CRLF bez zdvojenia
carriage return. Konečné vybrané kontroly: **12/12 PASS** na skutočnom
workflow a **12/12 PASS** na virtuálnom pohľade CRLF. Obe negatívne mutácie
si v každom kódovaní zachovávajú pôvodné asercie. Súbor workflow sa
neprepísal, žiadne skutočné skupiny sa znovu nespustili a vzdialené overenie
CI/nahrávania zostáva otvorené.
