[English](../../../../qa/docs/uat-current-build.md) · **Slovenčina**

<!-- locale-links-v1: source-relative links rebased for locales/sk -->

<a id="current-build-owner-uat--accepted-test-build-2026-10-19"></a>
# UAT aktuálneho zostavenia podľa vlastníka — prijaté testovacie zostavenie, 2026-10-19

[← Späť na README](../../README.md#qa-evidence) · [Aktuálny stav QA](../../docs/qa-status.md) · [Ďalej: kroky limitov kategórií →](uat-category-limits.md)

**Akceptácia podľa vyjadrenia vlastníka, 2026-10-19.** Referenčný zdroj aplikácie
je publikovaná vetva `main` na [`7b1cb328`](https://github.com/DaniilBehus/wallet-tracker/commit/7b1cb328e1d90a52527b792fb3ef4d95cdd92948)
so [šiestimi úspešnými úlohami CI](https://github.com/DaniilBehus/wallet-tracker/actions/runs/39248991256).
Vlastník použil spustený hosťovský zdroj
`15dfc45c9e34bb7f0da5632c73fa37c07563c7cf` na
`http://127.0.0.1:3035/`; jeho aplikačný strom
`e76f710ba5de3937314d54f0d81e9f5bac7471ea` sa zhoduje s publikovanou
aplikáciou. Neskoršie commity týkajúce sa iba dokumentácie nemenia aplikáciu
a nepočítajú sa ako nové vykonanie UAT. Ide o potvrdenie vlastníka pre
pomenované postupy, nie o opakovanie agentom, výsledok živej AI, odpustenie
rizík ani všeobecný súhlas s vydaním.

<a id="use-only-a-disposable-account-and-database"></a>
## Používajte iba jednorazový účet a databázu

Ak už server beží, použite koordinátorom poskytnutú lokálnu adresu
`http://127.0.0.1:3035`. **Na tom istom porte nespúšťajte druhý server.**
Inak v repozitári Wallet s už nainštalovaným podporovaným prostredím
a závislosťami najprv overte, že port 3035 je voľný a cesta k databáze
nižšie ešte neexistuje. Potom v samostatnom termináli PowerShell spustite
jeden server:

```powershell
New-Item -ItemType Directory -Force qa/reports/uat-current | Out-Null
$env:DB_PATH = Join-Path (Get-Location) 'qa/reports/uat-current/wallet.db'
$env:JWT_SECRET = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$env:WALLET_AI_MODE = 'off'
$env:WALLET_HOST = '127.0.0.1'
$env:PORT = '3035'
node src/server.js
```

Ak `wallet.db` už existuje, použite nový názov súboru; na prípravu UAT
**nikdy neprepisujte ani nemažte existujúcu databázu**. Nepoužívajte tu
`npm start`, pretože môže čítať lokálny `.env`. Zaregistrujte syntetický
účet, napríklad `category-uat@example.test`; nevkladajte skutočné výdavky
ani kľúče. Potom ukončite iba tento server pomocou Ctrl+C a zatvorte jeho
terminál. Ignorovanú testovaciu databázu ponechajte, kým vlastník nerozhodne,
či je potrebná pre správu o chybe.

<a id="owner-checklist"></a>
## Kontrolný zoznam vlastníka

| Kontrola | Čo urobiť a pozorovať |
|---|---|
| Limity kategórií | Na syntetickom účte vykonajte existujúci [13-krokový scenár](uat-category-limits.md#steps). Nesúlad zaznamenajte podľa čísla kroku. Limit `0` je skutočný; vyprázdnenie poľa limit zruší. |
| Úprava pravidelnej platby | Vytvorte syntetickú pravidelnú platbu, pomocou Edit zmeňte názov, sumu a deň splatnosti, uložte a znovu načítajte Schedules a Upcoming. Zostať má jedna platba s upravenými hodnotami; Cancel/Escape nesmie uložiť. Zaznamenajte odmietnutie alebo duplikát. Ide o zostávajúcu podmienku vlastníka pri [BUG-021](../../log/BUGS.md). |
| Klávesnica v editore výdavku | Vytvorte syntetický výdavok, otvorte editor, prejdite ovládanie pomocou Tab/Shift+Tab a potom Escape. Fokus má zostať vo vnútri počas otvorenia a po zatvorení sa vrátiť na riadok, ktorý editor otvoril. Je to ľudská opätovná kontrola [automatizovanej regresie modálneho okna](test-report-modal-bind.md), nie úplný audit prístupnosti. |
| Obnovenie Month | Otvorte Month na dvoch kartách toho istého syntetického účtu. Na druhej karte pridajte výdavok; prvú kartu znovu načítajte alebo z Month odíďte a vráťte sa. Potom má nový súčet aj riadok zobraziť jedenkrát. Automatické priebežné načítavanie ani nemenný snímok stránkovania sa **neočakávajú**. |
| Neistá odpoveď Save/Pay | Ak možno stratenú odpoveď bezpečne zopakovať pomocou sieťových nástrojov prehliadača na tomto jednorazovom účte, zaznamenajte presné kroky a viditeľnú správu. Nestláčajte nové Save/Pay s čerstvým kľúčom požiadavky len na „opätovný pokus“; po obnovení overte, či existuje jeden záznam/platba. Ak reprodukcia nie je možná, označte **NOT RUN**, nie PASS. [Automatizované dôkazy zotavenia](test-report-write-lifecycle.md) sú oddelené. |

[UAT mesačného limitu](uat-monthly-limit.md#second-run--the-owner-2026-09-24)
vlastník prijal na jeho zaznamenanom staršom zostavení. Zachovajte toto
historické rozhodnutie; jeho výsledok 11/11 nekopírujte do záznamu
aktuálneho zostavenia. Živý poskytovateľ AI, osobná databáza ani externá
služba nie sú súčasťou tohto UAT.

<a id="owner-record--reported-2026-10-19"></a>
## Záznam vlastníka — oznámený 2026-10-19

| Pole | Záznam vlastníka |
|---|---|
| Skutočný SHA zostavenia a URL | Hosťovský zdroj `15dfc45c9e34bb7f0da5632c73fa37c07563c7cf` na `http://127.0.0.1:3035/`; rovnaký aplikačný strom ako publikované `7b1cb328` |
| Dátum a hodnotiteľ | 2026-10-19 · vlastník produktu |
| Kroky limitov kategórií (1–13) | **PASS 13/13**, podľa vyjadrenia vlastníka |
| Úprava platby / fokus / obnovenie Month | **PASS** pre všetky tri pomenované postupy, podľa vyjadrenia vlastníka |
| Neistá odpoveď (PASS / FAIL / NOT RUN) | **NOT RUN**; voliteľná strata odpovede Save/Pay bola vylúčená z otázky akceptácie |
| Pozorovania a odkazy na chyby | K výsledku vlastníka neboli dodané pozorovania ani snímky po krokoch; pozri [stav BUG-021](../../log/BUGS.md#current-dispositions--2026-10-19) |
| Rozhodnutie (prijať / odmietnuť / doplniť) | **Toto testovacie zostavenie prijaté** pre pomenovaný rozsah UAT, oznámené priamo vlastníkom produktu |

Pri neskoršom opakovaní zaznamenajte každý neúspešný krok, očakávané
a skutočné správanie, SHA zostavenia a bezpečnú snímku alebo stopu bez
súkromných údajov. Tento záznam prepisuje rozhodnutie vlastníka; agent
manuálne kroky nevykonal ani nepotvrdil.
