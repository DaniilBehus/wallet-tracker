[English](../../../../docs/support/log-exercise.md) · **Slovenčina**

<!-- locale-links-v1: source-relative links rebased for locales/sk -->

<!-- Original English heading anchors retained for stable cross-language references. -->
<a id="log-reading-exercise"></a>
# Cvičenie čítania logu

[← Podporný balík](README.md) · [Prevádzková príručka](runbook.md) · [SQL diagnostika](sql-diagnostics.md)

[`exercise.log`](../../../../docs/support/exercise.log) je výstup Wallet počas približne trinástich sekúnd používania: registrácia dvoch účtov, nastavenie mesačného limitu jedným z nich, uloženie výdavkov a zaplatenie predplatného — a tri chyby rôzneho druhu. Čítaj ho ako log servera, s ktorým niekto potrebuje pomôcť, odpovedz na tri otázky a potom otvor vypracované riešenie.

<a id="how-the-log-was-made"></a>
## Ako vznikol log

`node scripts/support-exercise.js` spustí aplikáciu na vlastnom porte s jednorazovou databázou, odošle krátku reláciu API požiadaviek a zachová všetko, čo server vypísal, v poradí. Požiadavky poslal skript; aplikáciu nepoužíval človek. Skript zvolil všetky požiadavky vrátane zlyhaní a jedno zlyhanie vyvolal zvonka aplikácie. Riešenie uvádza ktoré.

Od skutočného výstupu servera sa líšia dve veci: vlastný priečinok aplikácie v stack trace nahrádza `<app>` a riadky kontrol skriptu „server už beží?“ sú vynechané. Beh, ktorý zapísal commitnutý súbor, vypísal:

```text
wrote docs\support\exercise.log
planted failure: reference 53ab67f7 (53ab67f7-eeb1-4c9e-945f-03967cd6e392); the retry: e9bc4378-dbfa-4a19-8481-d9ed801fe685
```

Každý beh má nové ID a časy, preto regenerácia súboru vyžaduje prepísanie riešenia. Skript používa port 3007; iný sa nastaví cez `EXERCISE_PORT`.

<a id="the-questions"></a>
## Otázky

1. **Referencia `53ab67f7`.** Predstav si, že človek pošle túto referenciu z chyby. Čo robil, čo zlyhalo a prečo? Stratil niečo a čo má urobiť podpora?
2. **Prihlásenia.** Niečo sa viackrát za sebou neprihlásilo. Čo sa stalo, ako aplikácia reagovala — a čo z logu *nemožno* zistiť?
3. **AI zadanie.** Jedna požiadavka na AI zadanie zlyhala. Je AI funkcia pokazená?

Začni [§3 príručky](runbook.md#3-find-one-request-by-its-reference): každý riadok požiadavky obsahuje celé ID. Príkazy spúšťaj z koreňa repozitára.

<details>
<summary><strong>Vypracované riešenie</strong></summary>

<a id="1-reference-53ab67f7"></a>
### 1. Referencia 53ab67f7

**Nájdi jej riadky.**

```powershell
Select-String -Path docs\support\exercise.log -Pattern 53ab67f7 | ForEach-Object { $_.Line | ConvertFrom-Json } |
  Select-Object event, route, status, duration_ms, user_id, code, message
```

```text
event       : UNHANDLED
route       : /api/transactions
status      :
duration_ms :
user_id     :
code        : SQLITE_BUSY
message     : database is locked

event       : request
route       : /api/transactions
status      : 500
duration_ms : 5551,4
user_id     : 1
code        :
message     :
```

PowerShell vypisuje čísla podľa jazykového nastavenia počítača, tu s desatinnou čiarkou. `grep 53ab67f7 docs/support/exercise.log` vypíše tie isté dva riadky v pôvodnom tvare. Riadok požiadavky:

```text
{"time":"2026-09-27T11:45:16.439Z","level":"info","event":"request","request_id":"53ab67f7-eeb1-4c9e-945f-03967cd6e392","method":"POST","route":"/api/transactions","status":500,"duration_ms":5551.4,"user_id":1}
```

Riadok `UNHANDLED` je dlhší, pretože obsahuje zásobník volaní.

**Čo hovoria.** `POST /api/transactions` ukladá výdavok; poslal ho používateľ 1. Aplikácia po piatich a pol sekundách odpovedala 500 a `UNHANDLED` s rovnakým ID uvádza dôvod: `SQLITE_BUSY`, *database is locked*.

**Kde zlyhala.** Prvý rámec v aplikácii:

```powershell
Select-String -Path docs\support\exercise.log -Pattern 53ab67f7 | ForEach-Object { ($_.Line | ConvertFrom-Json).stack }
```

```text
SqliteError: database is locked
    at <app>\src\routes\transactions.js:113:6
    at Layer.handleRequest (<app>\node_modules\router\lib\layer.js:152:17)
    at next (<app>\node_modules\router\lib\route.js:157:13)
    at Route.dispatch (<app>\node_modules\router\lib\route.js:117:3)
    at handle (<app>\node_modules\router\index.js:435:11)
    at Layer.handleRequest (<app>\node_modules\router\lib\layer.js:152:17)
    at <app>\node_modules\router\index.js:295:15
    at processParams (<app>\node_modules\router\index.js:582:12)
    at next (<app>\node_modules\router\index.js:291:5)
    at router.handle (<app>\node_modules\router\index.js:186:3)
```

```bash
grep 53ab67f7 docs/support/exercise.log | grep -o 'src[a-z/\\]*\.js:[0-9:]*'
```

```text
src\\routes\\transactions.js:113:6
```

Spätné lomky sú zdvojené, pretože zásobník je uložený ako JSON text. Riadok 113 v `src/routes/transactions.js` vykonáva `INSERT` zapisujúci výdavok.

**Prečo.** Pozri trvanie. Aplikácia čaká na ukončenie druhého zapisovača najviac 5 sekúnd a požiadavka trvala o niečo viac: čakala na rad, ktorý neprišiel. Niečo iné celý čas zapisovalo do databázy. Porovnaj [INC-001](incidents/INC-001.md#diagnosis), kde rovnaké `SQLITE_BUSY` prišlo po 1.4 ms: tam nič nečakalo a práve to odhalilo defekt.

**Čo ešte človek urobil?** Hľadaj podľa ID používateľa namiesto referencie:

```powershell
Select-String -Path docs\support\exercise.log -Pattern '"user_id":1}' -SimpleMatch | ForEach-Object { $_.Line | ConvertFrom-Json } |
  Format-Table time, method, route, status, duration_ms
```

```text
time                     method route             status duration_ms
----                     ------ -----             ------ -----------
2026-09-27T11:45:06.340Z GET    /api/categories      200         2,2
2026-09-27T11:45:16.439Z POST   /api/transactions    500      5551,4
2026-09-27T11:45:17.956Z POST   /api/transactions    201         1,7
```

`grep '"user_id":1}' docs/support/exercise.log` vypíše tie isté tri pôvodné riadky. Jeden a pol sekundy po zlyhaní ten istý človek znovu uložil výdavok, úspešne: `201` za 1.7 ms, referencia `e9bc4378`. Zámok už bol uvoľnený.

**Stratil niečo?** Zlyhaná požiadavka nič neuložila: databáza odmietla práve zápis výdavku. Log nehovorí, či `201` patrilo rovnakému výdavku, pretože neobsahuje sumy ani poznámky. Vie to človek alebo mesačné údaje ([Q1](sql-diagnostics.md#q1--a-months-total-to-compare-with-the-summary)): výdavok má byť raz. V tomto behu bol rovnaký; skript ho poslal znovu nezmenený.

**Čo urobí podpora.** Povie človeku, že prvý pokus nič neuložil a druhý výdavok uložil. Potom nájde druhého zapisovača: `SQLITE_BUSY` po celom čakaní znamená zápis do `wallet.db` od iného zdroja — databázový prehliadač s nedokončenou zmenou, zálohovací nástroj alebo druhá kópia aplikácie na tom istom súbore ([príručka 5.2](runbook.md#52-a-save-returns-400-409-or-500)). Tu išlo o zámerne vyvolané zlyhanie: počas ukladania skript držal zápisový zámok z druhého spojenia. Pri opakovaní bez iného otvoreného zdroja eskalovať s kódom, správou, cestou a prvým rámcom `UNHANDLED` ([šablóna](runbook.md#6-escalation-template)).

<a id="2-the-sign-ins"></a>
### 2. Prihlásenia

```powershell
Select-String -Path docs\support\exercise.log -Pattern '"route":"/api/auth/login"' -SimpleMatch | ForEach-Object { $_.Line | ConvertFrom-Json } |
  Format-Table time, status, duration_ms, user_id
```

```text
time                     status duration_ms user_id
----                     ------ ----------- -------
2026-09-27T11:45:07.970Z    401        63,6
2026-09-27T11:45:08.392Z    401        63,3
2026-09-27T11:45:08.814Z    401        63,1
2026-09-27T11:45:09.235Z    401        62,1
2026-09-27T11:45:09.659Z    401        62,2
2026-09-27T11:45:10.019Z    429         0,6
```

```bash
grep '"route":"/api/auth/login"' docs/support/exercise.log
```

```text
{"time":"2026-09-27T11:45:07.970Z","level":"info","event":"request","request_id":"e6f107af-ff7d-403c-bc1d-c2446eabd2b1","method":"POST","route":"/api/auth/login","status":401,"duration_ms":63.6,"user_id":null}
{"time":"2026-09-27T11:45:08.392Z","level":"info","event":"request","request_id":"d7f34680-4f37-40fc-882c-978c179f81ed","method":"POST","route":"/api/auth/login","status":401,"duration_ms":63.3,"user_id":null}
{"time":"2026-09-27T11:45:08.814Z","level":"info","event":"request","request_id":"c6c95f61-bb90-4041-affc-616bf3767db6","method":"POST","route":"/api/auth/login","status":401,"duration_ms":63.1,"user_id":null}
{"time":"2026-09-27T11:45:09.235Z","level":"info","event":"request","request_id":"cff257bc-878f-431e-b0e0-ae22f79ef030","method":"POST","route":"/api/auth/login","status":401,"duration_ms":62.1,"user_id":null}
{"time":"2026-09-27T11:45:09.659Z","level":"info","event":"request","request_id":"98e515e7-d1b1-426b-a7f5-298bb57b88eb","method":"POST","route":"/api/auth/login","status":401,"duration_ms":62.2,"user_id":null}
{"time":"2026-09-27T11:45:10.019Z","level":"info","event":"request","request_id":"fe2d89d7-b196-4511-a3f3-45fb94428ca4","method":"POST","route":"/api/auth/login","status":429,"duration_ms":0.6,"user_id":null}
```

**Čo sa stalo.** Päť odmietnutých prihlásení `401` s odstupom približne 0.4 s, každé za približne 63 ms, teda čas jednej kontroly hesla. Šiesty pokus bol odmietnutý cez `429` za 0.6 ms, takže heslo sa nekontrolovalo vôbec. To je obmedzovač prihlásenia: po piatich zlyhaniach počas 15 minút odmieta ďalšie pokusy pred kontrolou hesla; `Retry-After` v odpovedi uvádza počet sekúnd čakania ([príručka 5.1](runbook.md#51-cannot-sign-in-or-too-many-attempts)). Dovtedy odmieta aj správne heslo.

**Čo log nepovie.** Ktorá adresa sa skúšala: riadky zámerne nemajú e-mail a `user_id` je pri každom prihlásení null, úspešnom aj neúspešnom, pretože dovtedy nikto nie je prihlásený. Ani pôvod pokusov: log neuchováva sieťové adresy. Preto nevie rozlíšiť preklepy vlastníka účtu, hádanie alebo viacerých ľudí za spoločnou adresou; ani či blokovanie patrí e-mailu alebo sieťovej adrese — počítajú sa obe. Výrok človeka „asi o trištvrte na dvanásť UTC mi prikázal skúsiť neskôr“ možno priradiť k riadkom; riadky samy k človeku priradiť nemožno.

**Súvisí to s referenciou 53ab67f7?** Blokovanie prišlo menej než sekundu pred začiatkom uloženia a patrilo rovnakej adrese: skript skúšal adresu používateľa 1. Log sám by to neukázal a udalosti sú napriek tomu nezávislé. Ukladal už prihlásený človek s prijatým tokenom; zlyhanie bolo v databáze, nie pri prihlásení. Blokovanie zastaví nové prihlásenia, nikoho neodhlasuje, preto opakovanie používateľa 1 o 11:45:17.956 fungovalo počas pätnásťminútového blokovania. Časová blízkosť neznamená rovnakú príčinu.

<a id="3-the-ai-entry"></a>
### 3. AI zadanie

Jediný riadok požiadavky na `/api/ai/expense-draft` má ID `6e32b881…`, ktoré nájde druhý riadok:

```powershell
Select-String -Path docs\support\exercise.log -Pattern 6e32b881 | ForEach-Object Line
```

```bash
grep 6e32b881 docs/support/exercise.log
```

Oba príkazy vypíšu:

```text
{"event":"ai_draft","request_id":"6e32b881-00ae-46c1-ba42-4af2ccba51dc","outcome":"AI_UNAVAILABLE","ms":1,"versions":{"schema":"1","prompt":"1","normalizer":"2"},"usage":null}
{"time":"2026-09-27T11:45:18.362Z","level":"info","event":"request","request_id":"6e32b881-00ae-46c1-ba42-4af2ccba51dc","method":"POST","route":"/api/ai/expense-draft","status":503,"duration_ms":2,"user_id":2}
```

**Čo hovoria.** Samotný riadok požiadavky: `503` z AI zadania, používateľ 2, za 2 ms. Riadok `ai_draft` bez vlastného času uvádza výsledok `AI_UNAVAILABLE`, rozhodnutý za 1 ms, s `usage` null. Žiadny AI poskytovateľ nebol volaný; nič neopustilo server. Napísaný text zámerne nie je v žiadnom riadku.

**Pokazené alebo vypnuté?** [Tabuľka príručky](runbook.md#53-ai-draft-unavailable) ich rozlišuje kódom. Vyčerpaná kvóta je `429 AI_RATE_LIMITED`; zlyhávajúci poskytovateľ je `502`, `503` alebo `504` s vlastným kódom a trvaním podľa poskytovateľa. `AI_UNAVAILABLE` znamená predvolene vypnuté AI alebo požadovaný live režim bez konfigurácie. Rozhodne začiatok logu: live režim bez nastavení pri štarte vypíše `[ai] live mode requested but not enabled; missing: …`, a taký riadok tu nie je.

```powershell
(Select-String -Path docs\support\exercise.log -Pattern '[ai]' -SimpleMatch).Count
```

```bash
grep -c '\[ai\]' docs/support/exercise.log
```

Oba príkazy vypíšu `0`. AI zadanie je na tomto serveri vypnuté; skript ho spustil s `WALLET_AI_MODE=off`. Nie je čo opravovať. Človek môže výdavok zadať ručne a zapnutie AI je rozhodnutie prevádzkovateľa, nie defekt.

</details>
