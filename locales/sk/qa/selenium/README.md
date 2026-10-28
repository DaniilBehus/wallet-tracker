[English](../../../../qa/selenium/README.md) · **Slovenčina**

<a id="selenium-browser-checks"></a>
# Prehliadačové kontroly Selenium

[← Spúšťanie testov](../../docs/testing.md) · [Testovacie prípady](../docs/test-cases.md#selenium--browser-checks--qaselenium)

Malá prehliadačová sada v Pythone používa Selenium WebDriver, pytest a Page Objects. V Chrome kontroluje deväť kľúčových postupov Wallet — jedenásť vykonaní, pretože jeden prípad sa vykonáva pre každý stav limitu a jeden postup sa opakuje pri šírke telefónu.

<a id="why-selenium-next-to-playwright"></a>
## Prečo Selenium popri Playwright

Playwright ([`qa/e2e/`](../../../../qa/e2e), 93 testov v dvoch rozmeroch zobrazenia) je a zostáva vrstvou end-to-end testov projektu. Táto sada existuje preto, že mnohé tímy testujú prehliadač pomocou Selenium a Pythonu, a projekt ukazuje tento spôsob práce na rovnakej aplikácii s rovnakou dôslednosťou. Nevypĺňa medzeru ponechanú Playwright. Prekrytie je zámerné a malé: deväť postupov, o ktoré aplikácia nesmie prísť, sa overuje znova iným ovládačom. Sada tak zostáva krátka a nevzniká druhá rozsiahla sada na údržbu.

<a id="what-is-where"></a>
## Čo sa nachádza kde

```text
qa/selenium/
  conftest.py      the server, reused from qa/python/conftest.py; Chrome; --headed; the evidence hook
  suite_rules.py   refuses a run whose code sleeps, waits implicitly or locates by position
  wallet_api.py    test data through the API: a fresh account for every test
  browser_logs.py  a response header, read from Chrome's network log
  evidence.py      the screenshot, page source and console of a failed test
  pages/           Page Objects: base, auth, add, month, upcoming — every locator lives here
  test_*.py        the checks, TC-SEL-001 to 009
  run.js           what npm run test:selenium starts
```

Každý beh spúšťa aplikáciu na voľnom porte s dočasnou databázou a tajným kľúčom a každému testu poskytuje nový Chrome. Nič preto netreba spúšťať vopred a žiadny test nezávisí od iného. Správa sa zapisuje do `qa/reports/selenium-junit.xml`.

<a id="running-it"></a>
## Spustenie

Potrebné sú Node.js 22+, Python 3.12+ so závislosťami `qa/python/requirements.txt` (ktoré fixujú verziu `selenium`) a Google Chrome. Selenium Manager, ktorý je súčasťou Selenium, nájde nainštalovaný Chrome a pri prvom behu stiahne zodpovedajúci ChromeDriver do vlastnej vyrovnávacej pamäte; ovládač sa neuchováva v repozitári.

Windows, v PowerShell:

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r qa/python/requirements.txt
npm run test:selenium
npm run test:selenium -- --headed      # show the browser
npm run test:selenium -- -k limit      # only the tests with "limit" in their name
```

Linux, kde úloha CI používa `ubuntu-latest` a Chrome dostupný na runneri:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r qa/python/requirements.txt
npm run test:selenium
```

<a id="locators-and-waits"></a>
## Lokátory a čakania

- **Lokátory vychádzajú z atribútov `data-testid`, potom z označení a rolí.** Aplikácia uchováva tieto ID pre testy (spec §5), takže zmena štýlu alebo presunutie prvku nerozbije test nezmeneného správania.
- **Žiadny XPath počítajúci pozície ani reťazce CSS kopírujúce rozloženie.** Rozbíjajú sa pri úpravách, ktoré nesúvisia s testovaným správaním.
- **Každé čakanie používa `WebDriverWait` na podmienku.** Pevný sleep je na rýchlom počítači zbytočne dlhý alebo na pomalom príliš krátky.
- **Implicitné čakanie je pevne nastavené na 0.** Inak každé vyhľadávanie potichu čaká a pri chýbajúcom prvku sa pri každom pokuse spotrebuje celý timeout namiesto zlyhania na riadku, ktorý prvok potreboval.
- **Údaje sa pripravujú cez API, s novým účtom pre každý test.** Prehliadač vykonáva iba správanie, na ktoré sa test zameriava, takže testy sú rýchle, fungujú samostatne a v ľubovoľnom poradí.

`suite_rules.py` pred spustením ktoréhokoľvek testu číta kód sady a zastaví beh s uvedením súboru a riadka pri sleep, nenulovom implicitnom čakaní, pozičnom XPath alebo CSS selektore naviazanom na rozloženie. Dve nezvyčajné veci sú zámerné: kliknutie najprv posunie prvok do stredu jeho oblasti posúvania, pretože spodná navigácia aplikácie je pevne prekrytá nad každou obrazovkou a WebDriver posúva prvok iba na okraj zobrazenia, kde ho navigácia môže prekryť; TC-SEL-008 zužuje stránku pomocou Chrome DevTools, pretože zobrazené desktopové okno sa nedá zúžiť pod približne 500 px.

<a id="reading-a-failure"></a>
## Čítanie zlyhania

Test, ktorý zlyhá, keď má k dispozícii prehliadač, zanechá priečinok `qa/reports/selenium/<test>/`; správa o zlyhaní ho uvedie:

| Súbor | Obsah |
|---|---|
| `screenshot.png` | Zobrazenie stránky pri zlyhaní testu |
| `page.html` | Zdroj stránky v danom okamihu: text, atribúty, testovacie ID |
| `console.txt` | Adresa stránky a všetko, čo zapísala do konzoly |
| `not-saved.txt` | Iba keď sa časť nepodarilo uložiť, napríklad po páde prehliadača |

Začnite porovnaním hlásenia assertion a snímky obrazovky: väčšina zlyhaní znamená, že stránka zobrazuje niečo iné, než test očakával. Potom skontrolujte chyby v konzole — neúspešná požiadavka sa tam objaví so svojím stavom — a text alebo atribúty prvku v zdroji stránky. Chybové hlásenie na obrazovke obsahuje *Reference*; [runbook](../../docs/support/runbook.md#3-find-one-request-by-its-reference) ukazuje, ako podľa neho nájsť požiadavku v logu servera.

Priečinok sa pri začiatku behu vyprázdni, preto obsahuje iba posledný beh. V CI ho úloha pri zlyhaní nahrá ako artefakt `selenium-evidence` na jeden týždeň: otvorte neúspešný beh a potom *Artifacts* na jeho súhrnnej stránke.
