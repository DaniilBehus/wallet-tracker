[English](../../../../docs/support/README.md) · **Slovenčina**

<!-- locale-links-v1: source-relative links rebased for locales/sk -->

<!-- Original English heading anchors retained for stable cross-language references. -->
<a id="support-pack"></a>
# Podporný balík

[← README](../../README.md) · [Prevádzková príručka](runbook.md) · [SQL diagnostika](sql-diagnostics.md) · [Cvičenie s logom](log-exercise.md)

Ako podporovať spustený Wallet: spustiť ho, čítať log, skontrolovať údaje a prejsť od hláseného príznaku incidentu k jeho príčine. Text je určený pre aplikačnú podporu — človeka, ktorý počuje „nefunguje to“ a má logy, databázu a kód, ale nevidí obrazovku používateľa.

<a id="what-it-is-and-what-it-is-not"></a>
## Čo tento balík je a čo nie je

**Je** to pracovný súbor pre túto aplikáciu. Každý uvedený príkaz bol spustený na Wallet, každý riadok logu a výsledok dotazu pochádza zo skutočného lokálneho behu, SQL spúšťa testovacia sada priamo z jeho stránky a citácie v cvičení sa porovnávajú s logom.

**Nie je** to záznam produkčnej podpory. Wallet je osobný projekt: okrem vlastníka nemá používateľov, produkčné nasadenie, pohotovostný rozpis ani úrovne služieb. Incidenty sú rekonštruované zo skutočných defektov nájdených testami a lokálne zopakované so správaním pred opravou; nikto ich nenahlásil. Nie je tu ani monitoring: log je súbor na počítači, ktorý aplikáciu spúšťa.

<a id="what-is-in-it"></a>
## Obsah

1. **ID požiadavky a log požiadaviek.** Každá odpoveď má `X-Request-Id`; pri chybe aplikácia zobrazí prvých osem znakov ID pod názvom **Reference**. Server zapíše jeden riadok JSON na požiadavku a pri neočakávanej chybe riadok `UNHANDLED` s rovnakým ID a zásobníkom volaní. Čo riadky obsahujú a čo nikdy neobsahujú: [príručka §2](runbook.md#2-where-the-logs-go). Kód: [`src/requestlog.js`](../../../../src/requestlog.js). Testy: [`qa/python/test_request_log.py`](../../../../qa/python/test_request_log.py).
2. **[Prevádzková príručka](runbook.md).** Spustenie a zastavenie, umiestnenie logov, vyhľadanie požiadavky podľa referencie, kontrola zdravia a triedenie piatich druhov hlásení — nemožno sa prihlásiť, odmietnuté uloženie, nedostupné AI, zdanlivo nesprávny limit a chýbajúca plánovaná platba — so šablónou eskalácie.
3. **[SQL diagnostika](sql-diagnostics.md).** Dotazy len na čítanie pre ID používateľa, mesačný súčet, stav limitu, plánované platby, uloženia s kľúčom a kvótu AI; každý má parametre a stĺpce výsledku.
4. **Incidenty.** Tickety v štýle ITSM pre tri skutočné defekty s riadkami z ich reprodukcií:

   | Ticket | S čím by sa človek stretol | Priorita | Problém |
   |---|---|---|---|
   | [INC-001](incidents/INC-001.md) | Úprava úveru zlyhá počas platenia v inej relácii | P3 | BUG-012 |
   | [INC-002](incidents/INC-002.md) | Celá aplikácia sa zasekne pri opakovanom posielaní nesprávnych hesiel | P1 | BUG-004 |
   | [INC-003](incidents/INC-003.md) | Vytvorenie účtu hlási chybu, hoci účet existuje | P3 | BUG-016 |

5. **[Cvičenie čítania logu](log-exercise.md).** Tri otázky k [logu skutočného behu](../../../../docs/support/exercise.log) s jedným zámerne vyvolaným zlyhaním a skrytou vypracovanou odpoveďou.

<a id="incident-problem-change"></a>
## Incident, problém, zmena

- **Incident:** niečo práve niekomu nefunguje. Cieľom je obnoviť službu; počíta sa aj náhradný postup.
- **Problém:** príčina jedného alebo viacerých incidentov. Cieľom je nájsť ju a odstrániť; vo Wallet je problémom defekt v [registri](../../log/BUGS.md).
- **Zmena:** kontrolovaná oprava, ktorá príčinu odstráni. Vo Wallet je to commit s opravou a testom, ktorý ju dokazuje.

<a id="priority"></a>
## Priorita

Priorita je dopad × naliehavosť:

| Dopad ↓ · Naliehavosť → | Vysoká | Stredná | Nízka |
|---|---|---|---|
| **Vysoký** | P1 | P2 | P3 |
| **Stredný** | P2 | P3 | P4 |
| **Nízky** | P3 | P4 | P4 |

- **Dopad** znamená, čo sa stratilo a koľkých ľudí to zasahuje. *Vysoký:* všetci alebo nesprávne/stratené peniaze či údaje. *Stredný:* prestane fungovať jedna funkcia alebo práca jedného človeka bez straty údajov. *Nízky:* nič neprestane fungovať, napríklad nesprávny popis.
- **Naliehavosť** znamená, ako skoro sa následky zhoršia. *Vysoká:* náhradný postup neexistuje a problém trvá. *Stredná:* aktuálne pomôže napríklad opakovanie. *Nízka:* môže počkať na ďalšiu bežnú opravu.

INC-002 je P1: čakali požiadavky všetkých a nemohli to ovplyvniť. INC-001 a INC-003 sú P3: niektorým ľuďom zlyhala jedna funkcia, pomohlo opakovanie alebo prihlásenie a nič sa nestratilo.

Táto stupnica meria, čo človek stráca. Priorita registra defektov meria porušený záväzok, preto môže mať jeden defekt obe hodnoty: BUG-012 je v registri P1, jeho incident INC-001 je tu P3.
