[English](../../../../docs/support/runbook.md) · **Slovenčina**

<!-- locale-links-v1: source-relative links rebased for locales/sk -->

<!-- Original English heading anchors retained for stable cross-language references. -->
<a id="runbook"></a>
# Prevádzková príručka

[← Podporný balík](README.md) · [SQL diagnostika](sql-diagnostics.md) · [Incidenty](../../../../docs/support/incidents)

Ako spustiť Wallet, kde sú logy, ako nájsť konkrétnu požiadavku používateľa a čo kontrolovať pri bežných hláseniach. Wallet je osobný projekt: jeden proces Node.js a jeden súbor SQLite. Za touto stránkou nie je pohotovostný rozpis, prísľub dostupnosti ani produkčná prevádzka.

Každý príkaz bol raz spustený 2026-09-27 proti lokálnym serverom s jednorazovými databázami a každý výstup pochádza z týchto behov. Logy smerovali do dočasného priečinka namiesto `data/`; inak príkazy zodpovedali uvedenému zneniu. Linuxové príkazy bežali v Git Bash na Windows. Ctrl+C sa v interaktívnom termináli nestlačilo; server sa zastavil ukončením procesu s rovnakým účinkom.

<a id="1-start-and-stop"></a>
## 1. Spustenie a zastavenie

Vyžaduje Node.js 22+, jednorazové `npm ci` a `.env` skopírovaný z `.env.example` s nastaveným `JWT_SECRET`. Nastavenia dôležité pre podporu:

| Premenná | Predvolené | Význam |
|---|---|---|
| `PORT` | `3000` | Port aplikácie |
| `DB_PATH` | `./data/wallet.db` | Súbor SQLite |
| `WALLET_AI_MODE` | `off` | `off` alebo `live`; pozri [nedostupný AI návrh](#53-ai-draft-unavailable) |
| `WALLET_REQUEST_LOG` | zapnuté | `off` vypne riadky požiadaviek, nikdy nie chybové riadky |

Spustiť v popredí s výstupom do logového súboru. `data/` už obsahuje databázu a Git ho ignoruje.

Windows PowerShell:

```powershell
cmd /c "npm start > data\wallet.log 2>&1"
```

`cmd /c` je zámerný: Windows PowerShell 5.1 mení každý riadok programu na stderr na chybový záznam, čím poruší riadky JSON; `cmd` ich zapíše nezmenené.

Linuxový shell:

```bash
npm start >> data/wallet.log 2>&1
```

Log sledovať z druhého terminálu — PowerShell `Get-Content data\wallet.log -Wait -Tail 20`, Linux `tail -f data/wallet.log`. Prvé riadky sú od npm a samotnej aplikácie; potom jeden riadok JSON na požiadavku. Z lokálneho behu (riadok `.env` sa objaví, pretože premenné boli v tomto behu nastavené v shelli):

```text
> wallet@1.0.0 start
> node --env-file-if-exists=.env src/server.js

.env not found. Continuing without it.
wallet 1.0.0 listening on http://localhost:3041
{"time":"2026-09-27T11:29:02.574Z","level":"info","event":"request","request_id":"55a246a9-edc1-411d-91b0-d4b8461899e0","method":"GET","route":"/api/health","status":200,"duration_ms":5.9,"user_id":null}
```

**Zastavenie:** Ctrl+C v termináli, ktorý aplikáciu spustil. Ak k nemu nemáš prístup, zastaviť proces počúvajúci na porte — PowerShell:

```powershell
Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000 -State Listen).OwningProcess
```

Reštart vymaže všetky blokovania prihlásenia, pretože sú v pamäti. Výdavky, nastavenia a počítadlá kvót AI sú v databáze a prežijú ho.

<a id="2-where-the-logs-go"></a>
## 2. Umiestnenie logov

| Prúd | Riadky |
|---|---|
| stdout | Jeden riadok na požiadavku, `"event":"request"`. Jeden riadok `"event":"ai_draft"` na návrh AI. |
| stderr | `"event":"UNHANDLED"` pre neočakávanú chybu s kódom, správou a zásobníkom volaní. Varovania `[ai] …` pri štarte. |

Príkazy vyššie posielajú oba prúdy do toho istého súboru.

Riadok požiadavky nesie `time` (UTC), `level`, `event`, `request_id`, `method`, `route` — vzor ako `/api/transactions/:id`, nikdy adresu s ID alebo query — `status`, `duration_ms` a `user_id` (null bez prihlásenia). Riadok `ai_draft` nemá vlastný čas; vedľa neho je riadok požiadavky s rovnakým ID.

`duration_ms` meria čas v aplikácii. Požiadavka čakajúca pred vstupom na zaneprázdnený proces stále ukáže malé číslo — v [INC-002](incidents/INC-002.md) health kontrola trvala viac než sekundu a zalogovala 0.2 ms. Keď je „všetko pomalé“, merať požiadavku zvonka a porovnať ju s pokojovým meraním rovnakým spôsobom:

```bash
curl -s -o /dev/null -w '%{time_total}\n' http://localhost:3000/api/health
```

```text
0.002279
```

```powershell
(Measure-Command { Invoke-RestMethod http://localhost:3000/api/health }).TotalMilliseconds
```

```text
40,5507
```

curl vypisuje sekundy; PowerShell milisekundy, tu s desatinnou čiarkou. Približne 40 ms je jeho vlastná réžia, preto sa porovnáva s pokojovým meraním vykonaným rovnako.

**Nikdy v logu:** e-mailové adresy, heslá, tokeny alebo hlavička Authorization, poznámky, AI opisy či odpovede, telá požiadaviek. `qa/python/test_request_log.py` to overuje na výstupe skutočného servera.

<a id="3-find-one-request-by-its-reference"></a>
## 3. Vyhľadanie požiadavky podľa referencie

Keď aplikácia niečo odmietne, pod chybovou správou je **Reference: 7e67d71b**. Je to prvých osem znakov ID požiadavky a každý riadok tejto požiadavky obsahuje celé ID.

PowerShell:

```powershell
Select-String -Path data\wallet.log -Pattern 366d57b2
```

Linux:

```bash
grep 366d57b2 data/wallet.log
```

V lokálnom behu oba príkazy vypísali rovnaký riadok:

```text
{"time":"2026-09-27T11:26:58.780Z","level":"info","event":"request","request_id":"366d57b2-f90f-4ff1-b323-7310092a8197","method":"POST","route":"/api/auth/login","status":429,"duration_ms":1.1,"user_id":null}
```

Požiadavka môže mať viac riadkov — 500 aj `UNHANDLED`, AI návrh aj `ai_draft`. PowerShell môže na prečítanie polí riadok parsovať:

```powershell
Select-String -Path data\wallet.log -Pattern 7e67d71b | ForEach-Object { $_.Line | ConvertFrom-Json } |
  Where-Object event -eq 'UNHANDLED' | Select-Object request_id, route, code, message
```

```text
request_id : 7e67d71b-88a3-46ca-aa08-c0b560a07ac5
route      : /api/transactions
code       : SQLITE_BUSY
message    : database is locked
```

<a id="4-health-check"></a>
## 4. Kontrola zdravia

```bash
curl -s http://localhost:3000/api/health
```

```text
{"status":"ok","version":"1.0.0","db":"ok"}
```

```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

```text
status  : ok
version : 1.0.0
db      : ok
```

Čítať `db`, nielen status: endpoint odpovedá 200 aj pri zlyhaní databázového dotazu a uvedie `"db":"error"`. Žiadna odpoveď znamená, že proces nebeží alebo nie je na danom porte.

<a id="5-triage"></a>
## 5. Triedenie hlásení

Každá vetva obsahuje **príznak** slovami človeka, **kontrolu**, **pravdepodobnú príčinu**, **akciu** a **eskaláciu**, keď podpora nedokáže prípad uzavrieť. Eskalácie používajú [šablónu](#6-escalation-template).

<a id="51-cannot-sign-in-or-too-many-attempts"></a>
### 5.1 Nemožno sa prihlásiť alebo „priveľa pokusov“

- **Príznak:** „Heslo nefunguje.“ / „Mám to skúsiť neskôr.“
- **Kontrola:** referencia alebo posledné riadky `/api/auth/login`. `401` odmieta e-mail alebo heslo: správa je rovnaká pre obe možnosti, aby formulár neprezradil existenciu účtu. `429` je blokovanie s hlavičkou `Retry-After` v sekundách. V lokálnom behu päť nesprávnych hesiel dalo `401 401 401 401 401`; šiesty pokus a potom aj *správne* heslo dostali:

  ```text
  {"error":{"code":"RATE_LIMITED","message":"Too many failed login attempts. Try again later."}}
  Retry-After: 900
  ```

  Na rozlíšenie jedného alebo viacerých dotknutých ľudí spočítať blokovania:

  ```powershell
  (Select-String -Path data\wallet.log -Pattern '"route":"/api/auth/login","status":429' -SimpleMatch).Count
  ```

  ```bash
  grep -c '"route":"/api/auth/login","status":429' data/wallet.log
  ```

  Oba príkazy v lokálnom behu vypísali `2`: šiesty pokus a správne heslo počas blokovania.
- **Pravdepodobná príčina:** päť neúspešných pokusov za 15 minút. Počítajú sa podľa e-mailu *aj* sieťovej adresy, preto sa ľudia za spoločnou adresou môžu blokovať navzájom.
- **Akcia:** počkať na uplynutie `Retry-After`; počas blokovania sa odmieta aj správne heslo. Úspešné prihlásenie počítadlo vymaže. Reštart vymaže všetky blokovania naraz — len pri probléme zasahujúcom viacerých, keďže zároveň zruší ochranu. Wallet nemá obnovu hesla: zabudnuté heslo podpora nevyrieši.
- **Eskalácia:** veľa rôznych ľudí blokovaných naraz alebo blokovanie, ktoré nikto nevyvolal. Priložiť počty a niekoľko referencií.

<a id="52-a-save-returns-400-409-or-500"></a>
### 5.2 Uloženie vráti 400, 409 alebo 500

- **Príznak:** „Výdavok sa nedá uložiť.“
- **Kontrola:** referencia, potom status.

**400 — vstup porušil pravidlo.** Chyba ho pomenúva:

```text
{"error":{"code":"VALIDATION_FAILED","message":"amount_cents must be a positive integer"}}
```

Obrazovky bežné pravidlá overujú pred odoslaním. Preto 400 z vlastnej obrazovky, na rozdiel od API skriptu, naznačuje, že obrazovka niečo prepustila. **Akcia:** vysvetliť pravidlo. **Eskalovať** 400 z vlastnej obrazovky s referenciou.

**409 — konflikt s uloženým stavom.** Zámerné prípady: rovnaký `Idempotency-Key` s iným výdavkom ako v lokálnom behu —

```text
{"error":{"code":"IDEMPOTENCY_CONFLICT","message":"This Idempotency-Key was already used for a different expense"}}
```

— opakovanie uloženia s kľúčom po zmazaní výdavku (tombstone, pozri [Q4](sql-diagnostics.md#q4--keyed-saves-and-their-tombstones)), existujúci názov kategórie, platba uzavretého úveru alebo zníženie počtu splátok pod už zaplatený počet. **Akcia:** vysvetliť; obrazovka ponúka ďalší krok. **Eskalovať** len 409, ktorý nevysvetľuje žiadny z týchto prípadov.

**500 — vždy defekt alebo problém prostredia.** Telo chyby nehovorí viac než `Unexpected server error`; log áno. Nájsť `UNHANDLED` podľa referencie (§3). V lokálnom behu druhé spojenie držalo zápisový zámok databázy a uloženie zlyhalo po päťsekundovom busy timeoute:

```text
{"time":"2026-09-27T11:27:04.989Z","level":"info","event":"request","request_id":"7e67d71b-88a3-46ca-aa08-c0b560a07ac5","method":"POST","route":"/api/transactions","status":500,"duration_ms":5514.5,"user_id":1}
```

`SQLITE_BUSY` znamená, že do `wallet.db` zapisuje niečo iné: databázový prehliadač s nedokončenou zmenou, zálohovací nástroj alebo druhá kópia aplikácie na tom istom súbore. **Akcia:** nájsť a zavrieť druhého zapisovača; potom uloženie zopakovať. **Eskalovať** iný kód a `SQLITE_BUSY` bez iného otvoreného zapisovača. Priložiť kód, správu, cestu a prvý rámec zásobníka z `UNHANDLED`. Telo požiadavky nie je v logu a nemá sa kopírovať ani odinakiaľ.

<a id="53-ai-draft-unavailable"></a>
### 5.3 Nedostupný AI návrh

- **Príznak:** „AI tlačidlo nefunguje.“ / „Mám výdavok zadať ručne.“
- **Kontrola:** referencia: riadok požiadavky obsahuje status, `ai_draft` výsledok. `GET /api/ai/capabilities` uvádza, či je AI vôbec zapnuté.
- **Príčiny podľa výsledku:**

| Status · výsledok | Význam | Akcia |
|---|---|---|
| 503 `AI_UNAVAILABLE` | AI je vypnuté (predvolené) alebo požadovaný live režim nie je nastavený | Ručné zadanie. Ak má AI fungovať, štartovací log vypíše, čo chýba |
| 429 `AI_RATE_LIMITED` | Vyčerpaná kvóta: predvolene 3 návrhy za minútu a 5 za deň na osobu, 20 denne spolu | Počkať: minútový strop sa uvoľní ďalšiu minútu, denný o lokálnej polnoci. Pozri [Q5](sql-diagnostics.md#q5--todays-ai-quota-use) |
| 502 `AI_PROVIDER_FAILED`, `AI_INVALID_RESPONSE` · 503 `AI_PROVIDER_BUSY` · 504 `AI_TIMEOUT` | Poskytovateľ zlyhal, odpovedal nepoužiteľne, bol zaneprázdnený alebo pomalý | Ručné zadanie; skúsiť neskôr |
| 403 `AI_CONSENT_REQUIRED` · 422 `AI_CONTEXT_TOO_LARGE` · 400 `REFERENCE_DATE_MISMATCH` | Neudelený súhlas, priveľa kategórií alebo dátum zariadenia vzdialený od servera viac než deň | Vysvetliť; pri dátume skontrolovať hodiny telefónu |

Z lokálneho behu, AI vypnuté:

```text
{"event":"ai_draft","request_id":"c5bef1d4-5d6b-442a-87dd-a6c506c73b7b","outcome":"AI_UNAVAILABLE","ms":1,"versions":{"schema":"1","prompt":"1","normalizer":"2"},"usage":null}
{"time":"2026-09-27T11:27:06.088Z","level":"info","event":"request","request_id":"c5bef1d4-5d6b-442a-87dd-a6c506c73b7b","method":"POST","route":"/api/ai/expense-draft","status":503,"duration_ms":3.1,"user_id":1}
```

Požadovaný live režim bez nastavení, prvý štartovací riadok:

```text
[ai] live mode requested but not enabled; missing: OPENAI_API_KEY, WALLET_AI_MODEL, WALLET_AI_LIVE_ALLOWED=true
```

Chyba poskytovateľa a následne kvóta z behu proti lokálnej testovacej náhrade poskytovateľa (bez siete a kľúča):

```text
{"event":"ai_draft","request_id":"d62b4adb-61a5-4c5a-bf8a-af325a29cecc","outcome":"AI_PROVIDER_FAILED","ms":45,"versions":{"schema":"1","prompt":"1","normalizer":"2"},"usage":null}
{"time":"2026-09-27T11:28:26.429Z","level":"info","event":"request","request_id":"d62b4adb-61a5-4c5a-bf8a-af325a29cecc","method":"POST","route":"/api/ai/expense-draft","status":502,"duration_ms":48.4,"user_id":1}
{"event":"ai_draft","request_id":"7a8b2e16-ec53-46be-8ded-03ff557dc2b4","outcome":"AI_RATE_LIMITED","ms":0,"versions":{"schema":"1","prompt":"1","normalizer":"2"},"usage":null}
{"time":"2026-09-27T11:28:26.465Z","level":"info","event":"request","request_id":"7a8b2e16-ec53-46be-8ded-03ff557dc2b4","method":"POST","route":"/api/ai/expense-draft","status":429,"duration_ms":1.4,"user_id":1}
```

Štvrtý návrh v minúte bol odmietnutý ešte pred požiadavkou poskytovateľa. Q5 potom narátalo tri pre osobu aj celkovo vrátane zlyhaného a zaneprázdneného pokusu:

```text
┌─────────┬──────────────┬───────┐
│ (index) │ scope        │ count │
├─────────┼──────────────┼───────┤
│ 0       │ 'global-day' │ 3     │
│ 1       │ 'user-day'   │ 3     │
└─────────┴──────────────┴───────┘
```

- **Eskalácia:** viac chýb poskytovateľa za sebou (výpadok, nesprávny kľúč alebo model) alebo skoro vyčerpaný globálny denný strop. Priložiť výsledky a časy, nikdy opis napísaný používateľom.

<a id="54-the-limit-figure-looks-wrong"></a>
### 5.4 Údaj o limite vyzerá nesprávne

- **Príznak:** „Tvrdí, že som prekročil limit, ale neprekročil som ho.“
- **Kontrola:** spustiť [Q1 a Q2](sql-diagnostics.md#q2--the-limit-and-the-state-the-summary-derives-from-it) pre osobu a mesiac a porovnať s mesačnou obrazovkou. Z lokálneho behu:

  ```text
  ┌─────────┬──────────────┬─────────────┬─────────────┬──────────────┐
  │ (index) │ settings_row │ limit_cents │ total_cents │ limit_status │
  ├─────────┼──────────────┼─────────────┼─────────────┼──────────────┤
  │ 0       │ 1            │ 2500        │ 3500        │ 'exceeded'   │
  └─────────┴──────────────┴─────────────┴─────────────┴──────────────┘
  ```

  Mesiac bol presne na limite: €25.00 z €25.00. Potom sa zaplatili dve splátky a výdavok jednej sa zmazal; zostávajúca platba je výdavok €10.00 s dátumom zaplatenia a započítava sa.
- **Pravdepodobná príčina:** takmer vždy údaje, nie aritmetika. Plánovaná platba patrí do mesiaca stlačenia Pay. Výdavok dostal iný dátum. Limit je 0, čo je skutočný limit, nie nenastavenie. Presne minutý limit je *reached*, nie prekročenie, hoci rám sčervenie, pretože už nič nezostalo.
- **Akcia:** ukázať, ktoré výdavky tvoria súčet; opraviť nesprávny dátum.
- **Eskalácia:** nesúlad Q1 alebo Q2 so súhrnom. To je defekt.

<a id="55-a-scheduled-payment-is-missing"></a>
### 5.5 Chýba plánovaná platba

- **Príznak:** „Splátka úveru neprešla.“ / „Predplatné za minulý mesiac tam nie je.“
- **Kontrola:** Wallet nikdy neplatí sám. Platba existuje iba po stlačení **Pay** a výdavok má dátum stlačenia, nie deň rozvrhu. Spustiť [Q3](sql-diagnostics.md#q3--scheduled-payments-presses-of-pay-against-the-expenses-they-wrote):

  ```text
  ┌─────────┬─────────────┬──────────┬─────────────┬────────────┬────────┬─────────────────┬───────────────────┐
  │ (index) │ schedule_id │ name     │ total_count │ paid_count │ active │ linked_expenses │ unlinked_payments │
  ├─────────┼─────────────┼──────────┼─────────────┼────────────┼────────┼─────────────────┼───────────────────┤
  │ 0       │ 1           │ 'Laptop' │ 3           │ 2          │ 1      │ 1               │ 1                 │
  └─────────┴─────────────┴──────────┴─────────────┴────────────┴────────┴─────────────────┴───────────────────┘
  ```

  Dve stlačenia Pay, jeden výdavok: výdavok druhej platby používateľ neskôr zmazal. Samotné stlačenia sú v logu:

  ```powershell
  Select-String -Path data\wallet.log -Pattern '"route":"/api/schedules/:id/pay"' -SimpleMatch |
    ForEach-Object { $_.Line | ConvertFrom-Json } | Select-Object time, request_id, status, user_id
  ```

  ```text
  time                     request_id                           status user_id
  ----                     ----------                           ------ -------
  2026-09-27T11:27:06.495Z e07bb78e-0417-4b7c-b9e6-2b4b4008e426    200       1
  2026-09-27T11:27:06.497Z 2cd4c2c7-6e9b-49da-89a5-c19a42c1328f    200       1
  ```

  (`grep '"route":"/api/schedules/:id/pay"' data/wallet.log` poskytne tie isté dva riadky ako surový JSON.)
- **Pravdepodobná príčina:** nikto nestlačil Pay, stlačil ho v neskoršom mesiaci alebo bol výdavok platby neskôr zmazaný.
- **Akcia:** chýbajúcu platbu zaznamenať cez Pay (dnešný dátum) alebo ručne pridať výdavok so správnym dátumom.
- **Eskalácia:** `unlinked_payments` pod nulou alebo dvakrát zaznamenaná platba pri jedinom stlačení v logu.

<a id="6-escalation-template"></a>
## 6. Šablóna eskalácie

```text
Summary:      <one line: what the person cannot do>
Reported:     <date and time, and how>
Reference(s): <8-character references, or full request ids>
Account:      user_id <n>                      (never the e-mail or password)
Route/status: <e.g. POST /api/transactions · 500>
Checked:      <health result; log lines by reference; queries run and results>
Log lines:    <the request line; for a 500 the UNHANDLED code, message, route
               and first stack line>
Impact:       <one person or many; can they work around it?>
Workaround:   <what they are doing meanwhile, e.g. manual entry>
Suspected:    <cause, or "unknown">
```
