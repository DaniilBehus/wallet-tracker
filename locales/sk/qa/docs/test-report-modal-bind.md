[English](../../../../qa/docs/test-report-modal-bind.md) · **Slovenčina**

<a id="expense-modal-and-default-listener--local-verification"></a>

# Modál výdavkov a predvolený listener — lokálne overenie

[← Späť na README](../../README.md#qa-evidence) · [Základňa prístupnosti](accessibility-baseline.md) · [Stav QA](../../docs/qa-status.md)

<a id="technical-contract--recorded-before-implementation-2026-10-16"></a>

## Technický kontrakt — zaznamenaný pred implementáciou, 2026-10-16

Existujúci editor výdavkov sa musí zmeniť na pomenovaný modál. Pri otvorení
sa fokus presunie na Amount; kým je otvorený, ovládacie prvky na pozadí
nesmú prijímať fokus ani aktiváciu ukazovateľom a Tab/Shift+Tab zostávajú
v editore. Escape, Cancel a kliknutie na pozadie zatvárajú bez zápisu;
fokus sa vráti na otvárací prvok, ak ešte existuje. Save, Save bez zmeny,
validácia/chyba a správanie pri vymazanom riadku/404 zostávajú použiteľné.
Odhlásenie zatvorí editor. Pri 320×568 zostávajú všetky polia a akcie
vertikálne dostupné bez horizontálneho pretečenia.

Bežný produkčný listener sa predvolene viaže explicitne na IPv4 loopback
`127.0.0.1`. `WALLET_HOST` je vedomé zapnutie iného hosta; všeobecný `HOST`
a prázdny/nenastavený `WALLET_HOST` nesmú väzbu rozšíriť. Úvodná správa musí
uviesť zvoleného hosta a URL. Lokálna väzba nedokazuje bezpečnosť firewallu,
autentifikácie ani nasadenia.

<a id="evidence"></a>

## Dôkazy

<a id="before-and-diagnosis"></a>

### Pred opravou a diagnostika

Pred opravou zdroja zlyhal čistý záznam bootstrapu **2/2**: existujúce
`app.listen(PORT, callback)` odovzdávalo callback tam, kde sa vyžadoval
argument hosta. Cielený prehliadačový svedok pri 320×568 tiež zlyhal:
`Shift+Tab` z Amount opustil vizuálny overlay.

Prvá revízia natívneho dialógu zostala nedostatočná. Dve spustenia tej istej
hraničnej asercie po oprave zlyhali, preto sa práca zastavila na meranú
diagnostiku namiesto toho, aby sa značka `<dialog>` brala za dôkaz. V jednom
izolovanom diagnostickom behu bol bezprostredne pred `Shift+Tab` aktívny prvok
`INPUT#tx-edit-amount`, `document.hasFocus()` bolo true a dialóg mal `open`
aj `:modal`. Bezprostredne potom bol aktívny prvok `BODY`,
`document.hasFocus()` bolo false a `open`/`:modal` zostali true. Programový
pokus fokusovať navigáciu Add na pozadí ju neaktivoval. To odlíšilo únik
fokusu do rámu prehliadača od preukázanej aktivácie navigácie na pozadí.

<a id="local-correction-and-observed-behavior"></a>

### Lokálna oprava a pozorované správanie

Editor výdavkov teraz používa pomenovaný natívny modál s malým lokálnym
handlerom hranice Tab medzi prvým a posledným zapnutým viditeľným ovládacím
prvkom. V cielenom dôkaze po oprave pri **320×568 a 1280×800** presunul
Shift+Tab z Amount fokus na Cancel; Tab z Cancel ho vrátil na Amount. Fokus
prehliadača zostal true a pokus fokusovať navigáciu na pozadí ponechal
fokus na Cancel. Skutočný pokus ukazovateľa o aktiváciu ovládania príjmov na
pozadí bol odmietnutý a obrazovka Month sa nezmenila. Escape, Cancel a
kliknutie na pozadie zatvorili editor a obnovili fokus na jeho stále
pripojený otvárací prvok. Save bez zmeny zatvoril bez PATCH; existujúca
sada editovania tiež kontroluje no-op a nechcený zápis kategórie.

Pri oboch viewportoch bol riadok akcií dosiahnuteľný posúvaním a šírka
posúvaného obsahu dialógu nepresiahla šírku viewportu. Vykreslený editor
aj stav validačnej chyby v dialógu boli skenované axe bez potvrdených
porušení označených WCAG; úplný JSON a stopy sú v ignorovaných lokálnych
testovacích artefaktoch. Starý toast na úrovni stránky zostáva pre
existujúce správanie, zatiaľ čo viditeľný `role=alert` v dialógu najvyššej
vrstvy teraz nesie validačné a serverové chyby (vrátane ohraničeného odkazu
na požiadavku, ak existuje). Pozdržaný PATCH udržal editor otvorený a
zabránil jeho zatvoreniu cez Escape; syntetická 503 potom ponechala editor
a lokálnu chybu viditeľné, pričom pôvodný riadok zostal nezmenený.
Syntetická 401 zatvorila dialóg a zobrazila prihlásenie. Existujúce správanie
404, odmietnutej sumy, uloženia a žiadnej zmeny zostalo pokryté spravovanou
sadou editovania. Tieto syntetické odmietnutia sú kontroly, nie pozorované
produkčné výpadky.

Pri listeneri chýbajúci/prázdny `WALLET_HOST` a všeobecný `HOST` teraz volia
`127.0.0.1`; explicitný `WALLET_HOST` vyberá zaznamenaného hosta, s hranatými
zátvorkami URL pre IPv6 tam, kde treba. Kontraktový testovací rámec asertuje
skutočnú trojargumentovú produkčnú signatúru a ponecháva loopback.
Spravovaný E2E runner túto signatúru tiež asertuje a zahadzuje zdedené
`WALLET_HOST`/`HOST`; zachováva ochrany vlastnej databázy, ukončenia a
siete. Explicitná široká väzba je vedomá voľba, **nie** certifikácia
firewallu ani bezpečnosti nasadenia.

<a id="commands-counts-and-limits"></a>

### Príkazy, počty a limity

Všetky nižšie uvedené príkazy použili nainštalovaný runtime Node 22.14.0,
offline fixtures, podradené servery iba na loopbacku a jednorazové/ignorované
úložisko QA. Nepoužili sa `.env`, skutočný účet, skutočný AI provider ani
externý cieľ.

| Kontrola | Pozorovaný lokálny výsledok |
|---|---|
| `node --test qa/gates/server-bind.test.js` | 2/2 PASS po úvodných 2/2 očakávaných negatívnych zlyhaniach. |
| `node --test qa/e2e-controls/run.test.js` | 14 PASS, jedna od prostredia závislá kontrola symlinku SKIP, nula FAIL. |
| `node qa/e2e-runner/run.js qa/e2e/editing.spec.js` | 18/18 PASS na mobile a desktope; vlastná predvolená databáza bola odstránená po ukončení podradeného procesu. |
| `playwright test -c playwright.a11y.config.js qa/a11y/baseline.spec.js -g 'Add, Month\|keyboard reaches'` | Štyri cielené prípady PASS: skeny vykresleného editora/chyby a klávesnicový tok pri oboch nastavených viewportoch. |
| `node --test qa/contract/contract.test.js` | 15/15 PASS; 340 validovaných loopback odpovedí v 21 zdrojových operáciách s vypnutým/demo seamom providera. |
| Čisté kontroly inventára/sledovateľnosti/Login plus nové kontroly bindu | 73/73 PASS; pôvodných prijatých 71 zostáva zahrnutých. |
| Čisté kontroly orchestrácie CI | 13/13 PASS. |
| Oba inventáre s `--check`, F13, `scripts/check.js`, spoločný `--plan` | PASS; F13 280 ID/78 definícií, statické brány 8/8, všetkých 22 plánovaných úloh `NOT_RUN`. |

Zdrojový artefakt teraz eviduje **280 hlavných ID katalógu**, **138
revidovaných zdrojových súborov QA/script**, **šesť pripnutých konfigurácií
vykonania** a **20 identít parametrov**. Nový dvojtestový súbor bootstrapu
je pomocná kontrola, nie nový prípad katalógu. Tieto počty sú evidenciou
zdroja, nie 280 úspešnými behaviorálnymi testami. Znovu sa spúšťali iba
cielené stavy prehliadača; nejde o úplnú kombinovanú sadu, vzdialené CI
pre presné SHA, UAT vlastníka, audit asistenčnými technológiami, posúdenie
firewallu ani schválenie vydania. Otvorené chyby a ostatné brány vydania
zostávajú v [stave QA](../../docs/qa-status.md). V čase tejto pracovnej
správy čakala lokálna oprava na nezávislú cielenú revíziu.

<a id="independent-agent-review--2026-10-16"></a>

### Nezávislá revízia agenta — 2026-10-16

Nezávislá agentova čítacia revízia kódu/dôkazov a následná lokálna
koordinačná revízia prijali ohraničené opravy modálu F07 a predvoleného
bindu F11 na tomto necommitnutom strome. Vyššie uvedené cielené prehliadačové,
HTTP a testovacie behy vykonal Wallet worker; recenzenti skúmali ich dôkazy
a vykonali kontroly iba na čítanie/čisté kontroly, nie ďalšiu úplnú runtime
sadu. Nie je to ľudský audit prístupnosti, UAT vlastníka, vzdialené CI pre
presné SHA, publikovanie ani schválenie vydania. Ostatné chyby a limity
kontrastu zostávajú v [stave QA](../../docs/qa-status.md).
