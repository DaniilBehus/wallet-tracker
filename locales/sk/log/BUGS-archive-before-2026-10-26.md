[English](../../../log/BUGS-archive-before-2026-10-26.md) · **Slovenčina**

<a id="defect-register"></a>

# Register defektov

<!-- Current-status notice begin -->
> **Aktuálne posúdenie, 2026-10-19:** tabuľka registra a
> [datované zosúladenie nižšie](#current-dispositions--2026-10-19)
> odrážajú publikovanú aplikáciu `main` na `7b1cb328` a jej beh CI
> 6/6 pre presný SHA. Pôvodné pozorovania, výsledky pred opravou
> a starší text „lokálne/necommitované“ zostávajú históriou,
> nie dnešným stavom Gitu. Zelený beh CI uzatvára iba defekty
> s vlastnou opravou a relevantným regresným dôkazom; nepotvrdzuje
> UAT vlastníka. Neskoršie potvrdenie vlastníka uzatvára iba
> zostávajúcu pomenovanú bránu BUG-021 bez všeobecného vzdania
> sa rizík. Pozrite [stav QA](../docs/qa-status.md).
<!-- Current-status notice end -->

Sú to skutočné hlásenia defektov, nie poznámky. Kroky reprodukcie,
očakávanie a skutočnosť, príčina, oprava, regresná kontrola —
rovnaká disciplína ako pri tickete v trackeri. Opis „niečo
s dátumom bolo pokazené a opravilo sa“ bude pre človeka,
ktorý ho číta o tri mesiace, bezcenný; tým človekom bude autor.

**Chyba nie je uzatvorená len preto, že kód funguje. Je uzatvorená,
keď sú vyplnené všetky polia nižšie**, vrátane posledného.

Závažnosť: **Kritická** (strata údajov alebo nesprávne peniaze) ·
**Vysoká** (zdokumentovaná požiadavka nie je splnená) ·
**Stredná** (nesprávne správanie s obchádzkou) · **Nízka** (kozmetická).

Stav: `OPEN` · `IN PROGRESS` · `CLOSED` · `WONTFIX` (vyžaduje dôvod).

<a id="register"></a>

## Register

| ID | Názov | Závažnosť | Stav | Zistené | Oprava | Pravidlo |
|---|---|---|---|---|---|---|
| BUG-001 | Tlačidlo Save nebolo viditeľné — biely text na bielom pozadí | Vysoká | CLOSED | S03 | opravené | R2 |
| BUG-002 | Úplne splatená pôžička stále ukazovala jednu zostávajúcu splátku | Vysoká | CLOSED | S03 | opravené | R3 |
| BUG-003 | Tlačidlo Pay zostalo po odmietnutej platbe v stave zaneprázdnenia | Stredná | CLOSED | S04 | opravené | R5 |
| BUG-004 | 20 nesprávnych hesiel za sekundu znefunkční aplikáciu pre všetkých | Vysoká | CLOSED | S07 | opravené | R6 |
| BUG-005 | Jeden e2e test prekročí časový limit pri behoch ~3× pomalších než obvykle | Nízka | OPEN | S10 | — | — |
| BUG-006 | Záťažový runner vrátil 127 po behu so splnenými všetkými hranicami | Nízka | CLOSED | S12 | opravené | R8 |
| BUG-007 | Testovací skript sa vôbec nespustil a sada hlásila zelený výsledok | Stredná | CLOSED | S14 | opravené | R10 |
| BUG-008 | API runner vracia 127 pri zelenom behu, takže prvé zostavenie CI by bolo červené | Vysoká | CLOSED | S14 | opravené | R8 |
| BUG-009 | Server v CI na Node 20 zlyhá so segmentation fault, takže prvé zostavenie bolo červené | Vysoká | CLOSED | S15 | opravené | R11 |
| BUG-010 | API runner vráti 0, aj keď sa server nikdy nespustí, takže CI hlásilo úspech | Kritická | CLOSED | S15 | opravené | R8 |
| BUG-011 | Dva servery spustené naraz nad jednou databázou; jeden zlyhal pri štarte | Stredná | CLOSED | S16 | opravené | R12 |
| BUG-012 | Dva procesy zapisujúce do jednej databázy odpovedajú 500 | Vysoká | CLOSED | S16 | opravené | R12 |
| BUG-013 | Panel úpravy sa otvoril pod spodnou navigáciou | Stredná | CLOSED | S16 | opravené | R13 |
| BUG-014 | Kategórie sa na krátkom telefóne zrútili na pás vysoký 18 px | Vysoká | CLOSED | S21 | publikované v `2face59` | R14 |
| BUG-015 | Úprava nekategorizovaného výdavku odosielala kategóriu nula | Stredná | CLOSED | S21 | a399e79 | R14 |
| BUG-016 | Súbežné registrácie rovnakého e-mailu vracali 500 | Vysoká | CLOSED | S21 | e291ea9 | R14 |
| BUG-017 | Koncovky hesiel po 72 bajtoch sa potichu ignorovali | Vysoká | CLOSED | S21 | 53b310b | R14 |
| BUG-018 | Veľká pôžička strácala jeden celý cent zostávajúcej sumy | Kritická | CLOSED | S21 | bd516ac | R14 |
| BUG-019 | Príliš veľký JSON sa hlásil ako interné zlyhanie servera | Stredná | CLOSED | S21 | publikované v `2face59` | R14 |
| BUG-020 | Platné dátumy zo skorých rokov vytvárali chybné nasledujúce dátumy | Stredná | CLOSED | S21 + 2026-10-10 kontroly | publikované · overené v CI | R14 |
| BUG-021 | Plánované platby sa nedali upravovať cez rozhranie | Vysoká | CLOSED | S21 | publikované · CI · UAT vlastníka | R14 |
| BUG-022 | Vizuálny editor výdavkov neudržiaval fokus klávesnice | Stredná | CLOSED | S21 | publikované · overené v CI | R14 |
| BUG-023 | Porušenie pri súbežnej registrácii sa ignorovalo v konečnom verdikte | Vysoká | CLOSED | 2026-10-09 kontrola | publikované · overené v CI | — |
| BUG-024 | Povinné vstupy validátora mohli zmiznúť pri zelenom výsledku | Vysoká | CLOSED | 2026-10-09 kontrola | publikované · overené v CI | — |
| BUG-025 | Čistenie race mohlo odstrániť databázu iného behu | Stredná | CLOSED | 2026-10-09 kontrola | publikované · overené v CI | — |
| BUG-026 | Nebezpečné hodnoty stránkovania a ID obišli validáciu | Vysoká | CLOSED | 2026-10-09 HTTP kontrola | publikované · overené v CI | — |
| BUG-027 | Nekonvertovateľný JSON poznámky/ikony vracal interné chyby | Vysoká | CLOSED | 2026-10-09 HTTP kontrola | publikované · overené v CI | — |
| BUG-028 | Súbežné nastavenie evaluátora sa mohlo prerušiť pred kontrolou kvóty | Vysoká | CLOSED | 2026-10-10 kontrolovaný súbeh pri nastavení | publikované · overené v CI | — |
| BUG-029 | Súbežné správy evaluátora sa mohli navzájom prepísať | Vysoká | CLOSED | 2026-10-10 kontrola s pevným časom | publikované · overené v CI | — |
| BUG-030 | Zastarané alebo nadbytočné výnimky statickej brány prechádzali C9 | Stredná | CLOSED | 2026-10-10 negatívne kontroly | publikované · overené v CI | — |
| BUG-031 | Znenie brány statického inventára nadhodnocovalo runtime pokrytie | Stredná | CLOSED | 2026-10-10 kontrola dôkazov | publikované · statické znenie overené | — |
| BUG-032 | CI a lokálne overenie sa líšili; správy sa neuchovávali | Stredná | CLOSED | 2026-10-10 kontroly plánu | publikované · artefakty CI overené | — |
| BUG-033 | Hlavné E2E opakovane používalo jednu databázu a ignorovalo DB_PATH | Stredná | CLOSED | 2026-10-11 audit konfigurácie a kontrol | publikované · overené v CI | — |
| BUG-034 | Deklarované minimum Node 22 mohlo načítať SQLite binding vyžadujúci Node-API 10 | Vysoká | CLOSED | 2026-10-11 kontroly runtime | publikované · overené v CI | — |
| BUG-035 | Offset stránkovanie mohlo po zápise iného klienta výdavky zdvojiť alebo preskočiť | Stredná | CLOSED | 2026-10-16 kontroly HTTP/prehliadača | publikované · overené v CI | — |
| TRACE-AUDIT-001 | Sémantický nesúlad vo verejnej sledovateľnosti | — | CLOSED | 2026-10-12 F13 kontrola | publikované · statické odkazy overené | — |
| LIMIT-001 | Každá požiadavka čaká za databázovou prácou — pri záťaži zápismi je 23× pomalšia | — | ACCEPTED | S07 | — | R6 |
| LIMIT-002 | Rovnaký POST dvakrát vytvorí dva výdavky (požiadavky bez kľúča; ukladanie s kľúčom sa opakuje — D-035) | — | ACCEPTED | S16 | — | — |

`LIMIT-###` nie je defekt. Je to nameraná hranica návrhu,
zaznamenaná tu preto, že sa zapisuje všetko, čo záťažový smoke test
zistil — a nezapísané obmedzenie sa neskôr objaví ako kríza.

Stĺpec **Oprava** uvádza aktuálne posúdenie; datované časti nižšie
zachovávajú pôvodné lokálne pozorovania. Konkrétne dôkazy
a zostávajúce obmedzenia sú zosúladené ďalej. `CLOSED` sa vzťahuje
na uvedený defekt, nie na všeobecnú zhodu s WCAG, stránkovanie
ako nemennú snímku, kvalitu živého AI alebo UAT nad rámec
zaznamenaného rozsahu vlastníka.

<a id="current-dispositions--2026-10-19"></a>

## Aktuálne posúdenia — 2026-10-19

Nasledujúce opravy sú súčasťou publikovanej aplikácie `main`
na [`7b1cb328`](https://github.com/DaniilBehus/wallet-tracker/commit/7b1cb328e1d90a52527b792fb3ef4d95cdd92948).
[Beh CI pre presnú verziu](https://github.com/DaniilBehus/wallet-tracker/actions/runs/39248991256)
úspešne dokončil všetkých šesť povinných úloh. Každé rozhodnutie
`CLOSED` spája dôkaz o dodaní s **vlastnými** výsledkami pred opravou
a regresnými dôkazmi; samotné zelené CI nerozhodovalo o nesúvisiacich
defektoch. Pôvodné formulácie hlásení ako „lokálne a necommitované“
zostávajú nižšie ako datované pozorovania.

| ID | Konkrétny dôkaz a obmedzenie |
|---|---|
| BUG-005 · OPEN | [Pôvodné hlásenie časového limitu](../qa/docs/defects/BUG-005-e2e-timeout-on-slow-runs.md); príčina nebola preukázaná. Neskoršie zelené CI nemení klasifikáciu skoršieho časového limitu. |
| BUG-020 · CLOSED | [Správa o hraničných dátumoch](../qa/docs/test-report-date-boundaries.md) a úlohy dátumov/kontraktov v skupine API CI; tvrdenie sa vzťahuje iba na uvedenú oblasť štvorciferných rokov. |
| BUG-021 · CLOSED | [Zlyhanie pred opravou a lokálna regresia úprav plánovaných platieb](../qa/docs/test-report-schedule-editing.md), publikované s Playwright CI, spolu s [PASS úpravy plánovanej platby na aktuálnej verzii a prijatím testovacej verzie vlastníkom produktu z 2026-10-19](../qa/docs/uat-current-build.md#owner-record--reported-2026-10-19). Uzatvára to konkrétny chýbajúci Edit; agent nevykonal UAT ani nezískal všeobecné vzdanie sa rizík. |
| BUG-022 · CLOSED | [Správa o modálnom okne/fokuse](../qa/docs/test-report-modal-bind.md), publikovaný natívny dialóg a CI pre prehliadač/prístupnosť. Uzatvára sa konkrétny defekt udržania fokusu, nie ľudský audit prístupnosti ani certifikácia WCAG. |
| BUG-023 · CLOSED | [Negatívny verdikt scenára E a kontroly vynútenia scenára](../qa/docs/test-report-validator-controls.md); úloha súbehu prešla v aktuálnom API CI. Scenár D zostáva len meraním. |
| BUG-024 · CLOSED | [Kontroly chýbajúcich vstupov a prázdneho inventára](../qa/docs/test-report-validator-controls.md); povinné statické brány prešli v aktuálnom API CI. Statické deklarácie nie sú behaviorálne pokrytie. |
| BUG-025 · CLOSED | [Sentinel iného behu a kontroly čistenia vlastných súborov](../qa/docs/test-report-validator-controls.md); aktuálne CI súbehu prešlo. Čistenie databázy iného behu nie je povolené. |
| BUG-026 · CLOSED | [Zlyhania HTTP pri nebezpečných číslach a opravené regresie 400](../qa/docs/test-report-api-validation.md); kontraktné CI prešlo. |
| BUG-027 · CLOSED | [Zlyhania HTTP pri nekonvertovateľnom texte/ikone a opravené regresie 400](../qa/docs/test-report-api-validation.md); kontraktné CI prešlo. |
| BUG-028 · CLOSED | [Synchronizovaná kontrola nastavenia evaluátora](../qa/docs/test-report-evaluator-concurrency.md); offline AI CI prešlo. To nepreukazuje samostatnú historickú príčinu W9. |
| BUG-029 · CLOSED | [Kontroly odlišných správ pri pevnom čase a čiastočného zápisu](../qa/docs/test-report-evaluator-concurrency.md); offline AI CI prešlo. Publikovanie dvoch súborov stále nie je atómové. |
| BUG-030 · CLOSED | [Negatívne kontroly zastaraných/nadbytočných výnimiek](../qa/docs/test-report-static-gates.md); CI statickej brány prešlo. Zostávajúca výnimka `500` je výslovná a nevykonaná, nie výnimka pre runtime. |
| BUG-031 · CLOSED | [Statické znenie a hranica skutočnej odpovede](../qa/docs/test-report-static-gates.md); aktuálne CI brány/kontraktov prešlo. Z C6–C8 sa neodvodzuje vykonanie každej vetvy. |
| BUG-032 · CLOSED | [Kontroly spoločného plánu](../qa/docs/test-report-ci-verification.md) spolu so [skutočným behom po zlúčení a artefaktmi](https://github.com/DaniilBehus/wallet-tracker/actions/runs/39248991256): šesť nahraných artefaktov; archív API obsahuje HTML, JUnit, súhrn súbehu a súhrn behu, archív Python obsahuje JUnit a súhrn behu. Obmedzenia časového limitu a kontroly súkromia v datovanej správe zostávajú. |
| BUG-033 · CLOSED | [Izolovaná databáza a negatívne kontroly sprievodného súboru](../qa/docs/test-report-e2e-isolation.md); E2E runner a Playwright CI prešli. Nútené ukončenie ani TOCTOU sprievodného súboru sa netvrdia ako vyriešené. |
| BUG-034 · CLOSED | [Kontroly verzie/Node-API](../qa/docs/test-report-runtime.md); aktuálne CI používa deklarované minimum Node 22.14.0. Budúce verzie runtime ani historický mechanizmus natívneho pádu sa nepreukázali. |
| BUG-035 · CLOSED | [Dôkazy posunu pri vložení/odstránení a regresie kurzora](../qa/docs/test-report-pagination-consistency.md); kontraktné a Playwright CI prešli. Pokračovanie kurzorom nie je nemenná snímka. |
| TRACE-AUDIT-001 · CLOSED | [Oprava sémantických odkazov F13 a negatívne kontroly](../qa/docs/test-report-traceability.md), ohraničené nezávislé prijatie a aktuálna úloha CI `f13-traceability`. Kontrolný nástroj nedokáže preukázať význam všetkých prípadov; syntetický import zostáva predbežný. |

F23 (migrácia vývojových/testovacích závislostí) zostáva **otvorenou
medzerou prijatého zistenia**, nie 25. vykonaným testom ani percentom
postupu vydania. [Aktuálny stav QA](../docs/qa-status.md) oddeľuje
túto medzeru, ohraničené prijatie aktuálnej verzie vlastníkom,
voliteľnú nevykonanú kontrolu stratenej odpovede a historické
podpísané mesačné UAT.

<a id="report-template"></a>

## Šablóna hlásenia

```markdown
### BUG-### · <title> · <Severity> · <State>

| Found in | S##, how it surfaced |
| Component | path/to/file.js |

**Steps to reproduce:**
**Expected:**   (cite the spec section that says so)
**Actual:**
**Root cause:**  the mechanism, not the symptom
**Fix:**
**Regression:**  what was re-checked, and its output
**→ Rule R#**    or exactly: No rule — one-off.
```

Dve polia sú rozhodujúce:

- **Príčina** musí pomenovať *mechanizmus*. „Dátumy boli nesprávne“
  je príznak; „konštruktor `Date` normalizuje pretečenie dňa
  namiesto vyhodenia chyby“ je príčina. Iba druhé tvrdenie môže
  vytvoriť pravidlo.
- **→ Pravidlo** je výstupnou podmienkou. Buď defekt priniesol
  opakovane použiteľné poučenie — a stane sa projektovým pravidlom
  `R#` — alebo to výslovne nepriniesol. Bez tohto poľa
  sa register zmení na archív, ktorý nikto nečíta.

---

<a id="bug-001--save-button-invisible--white-text-on-white-background--high--closed"></a>

### BUG-001 · Tlačidlo Save nebolo viditeľné — biely text na bielom pozadí · Vysoká · CLOSED

| | |
|---|---|
| Nájdené v | S03, prvý pohľad na obrazovku Add vo viewporte 375×812 |
| Komponent | `public/style.css`, `public/index.html` |

**Kroky reprodukcie:**
1. Prihláste sa a prejdite na obrazovku Add.
2. Pozrite sa na pravý dolný kláves číselnej klávesnice.

**Očakávané:** primárnou akciou predvolenej obrazovky aplikácie je modré tlačidlo
s textom `Uložiť`. Spec §6.1 vyžaduje tlačidlo Save a patrí medzi tri
ťuknutia v definícii hotového stavu „two taps and a Save“ (§8, session 4).

**Skutočnosť:** prázdny biely kláves. Text bol po celý čas v DOM —
`textContent` bol `"Uložiť"` — a vykresľoval sa bielou na bielej:

```
{ bg: "rgb(255, 255, 255)", color: "rgb(255, 255, 255)", text: "Uložiť" }
```

**Príčina:** špecifickosť CSS rozhodnutá poradím v zdroji. Prvok mal
`.key` aj `.btn--primary`. Oba selektory majú špecifickosť (0,1,0), takže
vyhrá neskoršia deklarácia — a `.key` je v štýle napísané nižšie
než `.btn--primary`. `.key` nastavuje `background: var(--surface)`, ale nie `color`,
takže pozadie prišlo z `.key` (biele) a farba z `.btn--primary`
(biela). Samostatne nebolo nesprávne ani jedno pravidlo; ich dvojica
sa rozdelila poradím deklarácií a vyhrala polovica z každého.

**Oprava:** kláves uloženia prestal preberať `.btn--primary`. Má vlastné
pravidlo `.key--save.key` — špecifickosť (0,2,0), vyššiu než obe —
ktoré nastavuje pozadie, okraj a farbu spolu, takže ich poradie už
nemôže oddeliť.

**Regresia:** stránka sa znovu načítala a vypočítaný štýl sa znovu prečítal;
potvrdilo sa aj to, že ďalší dvaja používatelia `.btn--primary` (submit v `.auth`,
`.row__pay`) nikdy neboli dotknutí, pretože `.btn` je deklarované
*pred* `.btn--primary`, nie po ňom.

```
{ bg: "rgb(61, 90, 254)", color: "rgb(255, 255, 255)", text: "Uložiť" }
```

**→ Rule R2.**

---

<a id="bug-002--a-fully-paid-loan-still-shows-one-instalment-left--high--closed"></a>

### BUG-002 · Úplne splatená pôžička stále ukazovala jednu zostávajúcu splátku · Vysoká · CLOSED

| | |
|---|---|
| Nájdené v | S03, splácanie pôžičky s 3 splátkami až do konca na obrazovke Upcoming |
| Komponent | `public/app.js` — `paySchedule`, `markRowFinished` |

**Kroky reprodukcie:**
1. Vytvorte pôžičku s `total_count = 3`.
2. Otvorte Upcoming a trikrát stlačte `Zaplatiť`.
3. Prečítajte riadok odpočtu pri tejto položke.

**Očakávané:** `zostáva 0 z 3 · 0,00 €` popri dokončenom stave. Spec §4.2:
po poslednej platbe je `remaining_count` 0 a odpoveď nesie
`"finished": true` **„so the UI can celebrate“**.

**Skutočnosť:** dokončený stav sa objavil správne — zelený riadok,
`Splatené 🎉`, tlačidlo Pay zmizlo — ale odpočet stále ukazoval:

```
zostáva 1 z 3 · 100,00 €
```

Práve splatená pôžička používateľovi tvrdila, že zostáva ešte jedna splátka.

**Príčina:** riadok aktualizovali dve cesty kódu a iba jedna zapisovala
odpočet. Platba, ktorá pôžičku nedokončí, volá `loadUpcoming()`, čím
znovu vykreslí každý riadok zo servera a je preto vždy aktuálna. Posledná
platba úmyselne **nenačíta** zoznam — ten je filtrovaný na `active=1`,
takže obnovenie by riadok odstránilo a používateľ by nikdy nevidel
dokončenie — namiesto toho upraví riadok na mieste cez `markRowFinished`.
To zmenilo štýl a odstránilo tlačidlo, ale nedotklo sa textu. Zobrazený
počet zostal z predchádzajúceho vykreslenia.

Je to ten istý typ zlyhania, proti ktorému je navrhnutá spec v §5 odmietnutím
ukladať `next_due` a `remaining_count`: odvodená hodnota uložená inde
než tam, kde sa počíta, zostarne. Server toto pravidlo dodržiava;
DOM sa potichu stal druhým miestom uchovania hodnoty.

**Oprava:** reťazec odpočtu teraz tvorí jediná funkcia
`remainingText(total_count, remaining_count, amount_cents)`, ktorú
volá prvé vykreslenie aj posledná platba — tá odovzdáva `remaining_count`
priamo z odpovede `PATCH /pay`. Zostávajú dvaja zapisovači, ale text
už nemôžu vytvoriť odlišne.

**Regresia:** čerstvá pôžička s 2 splátkami zaplatená do konca, s čítaním
odpočtu po každom kroku:

```
start       zostáva 2 z 2 · 100,00 €
after 1st   zostáva 1 z 2 · 50,00 €
after 2nd   zostáva 0 z 2 · 0,00 €
finished    row--done: true, "Splatené 🎉", pay button removed
```

**→ Rule R3.**

---

<a id="bug-003--pay-button-stays-on-its-busy-label-after-a-refused-payment--medium--closed"></a>

### BUG-003 · Tlačidlo Pay zostalo po odmietnutej platbe v stave zaneprázdnenia · Stredná · CLOSED

| | |
|---|---|
| Zistené pri | S04, pomocou TC-E2E-030 (`qa/e2e/pay-conflict.spec.js`) — prípad napísaný na základe podozrenia, nie samovoľne pozorovaného zlyhania |
| Komponent | `public/app.js` — `paySchedule`, `withBusy` |

Úplné hlásenie: [`qa/docs/defects/BUG-003-pay-button-stuck.md`](../qa/docs/defects/BUG-003-pay-button-stuck.md).

**Kroky na reprodukciu:**
1. Vytvorte pôžičku s `total_count = 1` a otvorte obrazovku Upcoming.
2. Uzavrite pôžičku inde — v druhej karte, na inom zariadení,
   priamym `PATCH /api/schedules/:id/pay`. Obrazovku znovu nenačítajte.
3. Stlačte `Zaplatiť`.

**Očakávanie:** konflikt sa oznámi a tlačidlo začne znovu
ponúkať akciu — `Zaplatiť`, povolené, s nezmeneným prístupným názvom.
Spec §4.2 klasifikuje 409 ako zdokumentovaný prechod stavu,
takže rozhranie ho musí zvládnuť.

**Skutočnosť:** oznámenie bolo správne. Tlačidlo však natrvalo
zostalo s textom `Platím…`, kým jeho `aria-label` stále uvádzalo
`Zaplatiť Posledná splátka` — viditeľný text a oznámený názov
opisovali odlišné veci:

```
Expected: "Zaplatiť"
Received: "Platím…"
    14 × <button data-testid="schedule-pay-60" aria-label="Zaplatiť Posledná splátka">Platím…</button>
```

**Príčina:** chyba v poradí medzi volajúcim a pomocnou funkciou.
`withBusy` uloží pôvodný text tlačidla a v `finally` ho obnoví.
`paySchedule` nastavilo text zaneprázdnenia **samo, o riadok
pred volaním pomocnej funkcie**, takže sa uložilo `Platím…`
a obnovenie urobilo dočasný text trvalým. Ostatní volajúci
postupovali správne, lebo žiadny z nich text nemenil.

Na úspešnej ceste to nebolo vidieť: úspešná platba znovu
vykreslí zoznam a nové tlačidlo má správny text. Po ceste
bez opätovného vykreslenia poškodené tlačidlo zostane na obrazovke.

**Oprava:** text zaneprázdnenia sa presunul do `withBusy`
ako tretí argument a nastavuje sa *po* uložení pôvodného textu.
Pomocná funkcia teraz vlastní obe časti zmeny, takže
nemôže obnoviť text, ktorý sama nenastavila.

**Regresia:** TC-E2E-030 zostáva v sade ako regresný prípad.
Následný úplný beh:

```
60 passed (11.6s)
```

**→ Pravidlo R5.**

---
<a id="bug-004--20-wrong-passwords-a-second-make-the-app-unusable-for-everyone--high--closed"></a>

### BUG-004 · 20 nesprávnych hesiel za sekundu znefunkční aplikáciu pre všetkých · Vysoká · CLOSED

| | |
|---|---|
| Zistené pri | S07, záťažový smoke test k6 `qa/load/auth-burst.js` |
| Komponent | `src/auth.js` — `login`, `bcrypt.compareSync` |
| Dopad na | Každý endpoint vrátane `/api/health` |

Úplné hlásenie: [`qa/docs/defects/BUG-004-bcrypt-blocks-event-loop.md`](../qa/docs/defects/BUG-004-bcrypt-blocks-event-loop.md).

**Kroky na reprodukciu:**
1. `npm run test:load` (spustí vlastný server na porte 3100
   s dočasnou databázou, takže sa nič iné nemení).
2. Druhý scenár zaregistruje jeden účet a 15 sekúnd mu posiela
   nesprávne heslá z 20 súbežných spojení.
3. Po celý čas sa `GET /api/health` kontroluje a meria 10-krát
   za sekundu. Meria sa aj 5 sekúnd vopred, aby vznikla východisková hodnota.

**Očakávanie:** `/api/health` vykoná jedno `SELECT 1`,
nepristupuje k používateľským údajom a nesúvisí s prihlasovaním.
Má zostať rýchly. Prah záťažového smoke testu je
`p(95) < 250 ms`, čo je pre takú požiadavku už veľkorysé.

**Skutočnosť:** celý server prestáva zmysluplne odpovedať.

```
login attempts    305 in 15s  (20/s)
refused 401       305
rate limited 429  0        <- nothing stops a guesser yet
login latency     avg 1017.8 ms   p95 1099.1 ms

GET /api/health — the same trivial request, measured twice:
  idle            avg 0.8 ms      p95 1.2 ms
  under load      avg 1134.9 ms   p95 1819.1 ms
  cost of load    1494.8× slower at p95

ERRO thresholds on metrics 'health_latency_under_load' have been crossed
```

**Z 1.2 ms na 1819 ms.** Dvadsať nesprávnych hesiel za sekundu —
frekvencia, ktorú môže jeden telefón pri zlom spojení vyvolať
aj náhodou — a každý ďalší používateľ čaká takmer dve sekundy
na požiadavku, ktorá by mala trvať jednu.

**Príčina:** `src/auth.js` volá `bcrypt.compareSync`.
bcrypt je *zámerne* nákladný — v tom spočíva jeho účel,
a 10 kôl s cenou ~50 ms je správnych; znižovať ich netreba.
Defekt je **`Sync`**.

Node vykonáva JavaScript na jednom vlákne. Synchrónne volanie
nepočíta *popri* ostatných požiadavkách, ale *namiesto* nich:
počas tých ~50 ms proces nemôže prijať spojenie, spracovať
požiadavku ani odpovedať. Dvadsať súbežných pokusov si náklad
nerozdelí — čakajú jeden za druhým a ostatní za nimi.
Asynchrónne `bcrypt.compare` presunie prácu do fondu vlákien
libuv, kde zamestná pracovníka namiesto celého servera.

Situáciu zhoršujú dve veci:

- **Endpoint nevyžaduje autentifikáciu.** Server môže minúť
  50 ms CPU bez účtu, tokenu alebo predchádzajúceho vzťahu.
- **Počet pokusov nič neobmedzuje.** Uskutočnilo sa 305 pokusov
  a všetkých 305 sa spracovalo.

`register` má rovnakú podobu (`bcrypt.hashSync`) a smoke test
zápisov to zmeral z druhej strany: vytvorenie 50 účtov trvalo
2800 ms, približne 56 ms na každý, striktne jeden po druhom.

**Nie je to to isté ako LIMIT-001.** Tam sa čaká na ~0.5 ms
databázovej práce a náklad je 23×. Tu sa čaká na ~50 ms
zámerne náročného výpočtu CPU a náklad je 1495×.
Mechanizmus je rovnaký, no rozdiel je o dva rády —
preto je jedno prijaté obmedzenie a toto defekt.

**Oprava (S08):** obmedzenie pokusov podľa **D-016** —
5 zlyhaní počas 15-minútového okna, potom 429
s `Retry-After`, počítaných nezávisle podľa e-mailu
a IP klienta. `src/ratelimit.js` sa volá z prihlasovacej
trasy **pred** spustením `login()`. Toto poradie je opravou:
náklad defektu tvoril bcrypt, takže obmedzovač po ňom
by nechránil nič.

**Regresia:** `qa/load/auth-burst.js` už bol regresnou kontrolou
a zlyhával, takže nový test nebol potrebný — výsledok
sa zmenil. Ten istý skript, tých istých 20 spojení
a tých istých 15 sekúnd:

```
                     before            after
login attempts       305               113 062
reached bcrypt       305               5          (the allowance)
rate limited 429     0                 113 057
login latency avg    1017.8 ms         2.6 ms
health p95 idle      1.2 ms            1.2 ms
health p95 loaded    1819.1 ms         5.3 ms
                     1495× slower      4.5× slower
threshold            CROSSED           passes
```

Nárast priepustnosti z 20/s na 7 537/s sám ukazuje,
že obmedzovač je na správnom mieste: odmietanie
je lacné, lebo nastáva pred nákladnou časťou.

Hraničné správanie samostatne pokrýva kolekcia API,
priečinok **08 · Login rate limiting** — posledný
povolený pokus, prvý odmietnutý, `Retry-After`,
správne heslo neobchádzajúce blokovanie,
samovoľné uplynutie okna a úspešné prihlásenie
vynulujúce počítadlo.

**Zvyšný náklad, priznaný otvorene:** každý z 5 povolených
pokusov stále blokuje slučku udalostí na ~50 ms,
pretože `bcrypt.compareSync` je stále synchrónny.
Nahlásený defekt — bežná prevádzka znefunkčňujúca
aplikáciu — je odstránený a zmerané výsledky to potvrdzujú,
takže je uzavretý. Zostávajúci náklad obmedzuje limiter
a je zaznamenaný v D-016. Presun `auth.js`
na `bcrypt.compare` je hlbšia samostatná oprava,
nie poznámka pod čiarou.

---

<a id="the-residual-closed-s12"></a>

### Zvyšný náklad, uzavretý (S12)

Predchádzajúci odsek platil dve relácie. Teraz je vyriešený.

**Nikdy sa nezmeral**, iba sa o ňom uvažovalo —
skript návalu ho nevidí, pretože po piatich pokusoch
sú všetky odpovede lacné 429 a náklad sa skryje
za obmedzovač. Preto vznikol tretí skript,
`qa/load/allowed-logins.js`, ktorý beží proti serveru
s vypnutým obmedzovačom (`LOGIN_MAX_FAILURES`
nastavené veľmi vysoko). Nie je to realistické
nasadenie; iba tak sa dá zistiť cena *povolených* pokusov.

Výsledok bol horší, než naznačoval text:

```
five concurrent logins, all reaching bcrypt        before          after
  attempts completed in 15s                        285             1103
  login latency, avg                               265.5 ms        67.9 ms
  GET /api/health  idle p95                        1.5 ms          1.5 ms
  GET /api/health  under load p95                  422.4 ms        1.0 ms
                                                   285.8× slower   0.7×
```

**Päť nesprávnych hesiel — v povolenom rozsahu,
od jedného človeka, ktorý sa pomýlil — predĺžilo
každú inú požiadavku na štyri desatiny sekundy.**

**Oprava:** `src/auth.js` prešiel na `bcrypt.hash`
a `bcrypt.compare`. `register()` a `login()` sa stali
`async`, rovnako ako obe trasy v `server.js`.
bcrypt zostal na 10 kolách — cena je bezpečnostná
vlastnosť a nesmie sa znížiť. Zmenilo sa miesto
výpočtu: pracovník fondu vlákien libuv namiesto
slučky udalostí, takže jedno prihlásenie zamestná
pracovníka, nie celý proces. Express 5 odovzdáva
odmietnutý promise obsluhe chýb sám, preto jediný
renderer chýb v §5 naďalej vidí všetko
a v trasách nepribudlo try/catch.

**Poradie sa muselo zachovať — a zachovalo sa.**
`rateLimit.check()` je stále prvá operácia
prihlasovacej trasy pred `await login(...)`.
Obrátenie by vrátilo celý náklad BUG-004 —
hodnota obmedzovača spočíva v odmietnutí
*pred* nákladnou časťou. Overené štrukturálne,
nie podľa času: TC-API-071 pošle **správne**
heslo počas blokovania a stále dostane 429;
to je možné iba pri kontrole pred autentifikáciou.

**Regresia:** `qa/load/allowed-logins.js` zachováva prah
`health_latency_under_load: p(95) < 100`.
Synchrónny bcrypt ho nedokáže splniť —
nameraných bolo 422 ms. Teraz prechádza pri 1.0 ms.

Treba zaznamenať aj to, že latencia prihlásenia
**klesla** z 265 ms na 68 ms. Pokusy sa teraz
vykonávajú paralelne vo fonde namiesto radenia
za sebou a priepustnosť za rovnakých 15 sekúnd
vzrástla z 285 na 1103, približne štvornásobne,
čo zodpovedá predvolenej veľkosti fondu.

**LIMIT-001 sa nemení.** Opisuje `better-sqlite3`,
ktorý je zámerne synchrónny a nemá asynchrónnu formu;
cesta zápisu naďalej čaká, približne s nákladom 20×,
a zostáva prijatým obmedzením.

**→ Pravidlo R6.**

---
<a id="limit-001--every-request-queues-behind-database-work--accepted"></a>

### LIMIT-001 · Každá požiadavka čaká za databázovou prácou · ACCEPTED

| | |
|---|---|
| Zistené pri | S07, záťažový smoke test k6 `qa/load/expense-write.js` |
| Komponent | `src/db.js` — `better-sqlite3`, zámerne synchrónny |

Úplné hlásenie: [`qa/docs/defects/LIMIT-001-serialised-database-work.md`](../qa/docs/defects/LIMIT-001-serialised-database-work.md).

**Nie je to defekt.** Zaznamenáva sa všetko, čo smoke test
zistil. Namerané a zapísané obmedzenie je rozhodnutie;
rovnaké obmedzenie objavené v produkcii je incident.

**Čo sa meralo:** 50 používateľov zapisovalo výdavky
čo najrýchlejšie počas 30 sekúnd; po celý čas sa meral
`GET /api/health` a 5 sekúnd predtým aj nezaťažený server.

```
writes            79322 requests, 2097/s
failed            0.000 %
server errors     0
write latency     avg 19.0 ms   p95 26.4 ms   max 55.7 ms

GET /api/health — the same trivial request, measured twice:
  idle            avg 1.0 ms    p95 1.4 ms
  under load      avg 19.5 ms   p95 32.4 ms
  cost of load    23.4× slower at p95
```

**Čo sa očakávalo a nestalo:** `SQLITE_BUSY`,
zamknutá databáza, 5xx, poškodený riadok,
stratený zápis. Nič z toho sa neobjavilo.
79 322 zápisov, nula chýb. Treba to uviesť
rovnako jasne ako zlyhanie — smoke test
nenašiel to, čo hľadal.

**Prečo sa to nestalo:** `better-sqlite3` je synchrónny
a Node jednovláknový, takže v jednom procese
sa zápisy skutočne neprekrývajú. Slučka udalostí
ich zoradí ešte predtým, než SQLite uvidí súbeh,
a o zvyšok sa postará režim WAL. Ten istý návrh
spôsobuje spomalenie aj bráni poškodeniu.

**Vyjadrené obmedzenie:** priepustnosť je približne
**2 100 zápisov/sekundu** a počas vyťaženia databázy
je každá požiadavka — aj bez prístupu k nej —
približne **20× pomalšia**. Pri osobnej aplikácii
s jedným používateľom sa toto obmedzenie prakticky
neprejaví; domácnosť so štyrmi ľuďmi ho neuvidí.
Ak by sa aplikácia stala viacnájomnou, riešením
by nebol rýchlejší dotaz, ale presun práce mimo
vlákna spracúvajúceho požiadavky.

**Prijaté** na uvedenom základe. Ak aplikácia
získa druhého skutočne súbežného používateľa,
tento záznam bude východiskom, nie prekvapením.

**→ Pravidlo R6.**


---
<a id="bug-005--one-e2e-test-times-out-on-runs-that-are-3-slower-than-normal--low--open"></a>

### BUG-005 · Jeden e2e test prekročí časový limit pri behoch ~3× pomalších než obvykle · Nízka · OPEN

| | |
|---|---|
| Zistené pri | S08 a znova pri S10 |
| Komponent | neznámy — práve to je podstatou záznamu |
| Dopad na | `qa/e2e/schedules.spec.js › the 31st is accepted and explains itself` |

Úplné hlásenie: [`qa/docs/defects/BUG-005-e2e-timeout-on-slow-runs.md`](../qa/docs/defects/BUG-005-e2e-timeout-on-slow-runs.md).

**Príčina nie je charakterizovaná. Záznam je zámerne otvorený,
nie uzavretý ako „flaky“.**

**Čo sa deje:** sada zvyčajne končí približne za 11 sekúnd.
Dvakrát trvala 36–39 sekúnd a v oboch behoch zlyhal ten istý test:

```
Error: locator.fill: Test timeout of 30000ms exceeded.
qa/e2e/schedules.spec.js › Schedules › the 31st is accepted and explains itself
```

Tých 30 000 ms je rozpočet **testu**, nie vlastný limit akcie —
test vyčerpal celý čas skôr, než mohol `fill` niečo urobiť.

**Oba výskyty majú spoločný vzor:** ten istý test a trvanie
celej sady približne trojnásobné oproti norme. Pri dvoch
dátových bodoch to už nie je náhoda, preto sa to zaznamenalo.

**Prečo tento test:** má najdlhší reťazec postupných
akcií UI v sade — navigácia, vyplnenie, tvrdenie,
vyplnenie, tvrdenie, vyplnenie, vyplnenie, vyplnenie,
kliknutie, tvrdenie. Ak sa spomalí všetko, ako prvý
vyčerpá pevný limit.

**Čo sa skúšalo bez reprodukcie:**

| Pokus | Výsledok |
|---|---|
| Samostatný test, opakovane | prechádza, ~0.5 s |
| Celá sada, štyri po sebe idúce behy | 64/64, 10.6–11.4 s |
| Celá sada dvakrát s novou databázou | 64/64, ~11 s |
| Celá sada **počas záťažového smoke testu k6, ktorý nasýtil jadro** | 64/64, 11.4 s |

**Hlavné podozrenie, nepotvrdené:** každý e2e test
registruje vlastného používateľa a registrácia používa
`bcrypt.hashSync` — približne 55 ms blokovania slučky udalostí
na pokus, nameraných v S07. Štyria súbežní pracovníci
na zaťaženom počítači by mohli zaradiť serverové požiadavky
do frontu natoľko, že sa stránka zastaví počas vykresľovania.
To je zvyšný problém **BUG-004**, stále otvorený:
obmedzovač znížil *frekvenciu* spúšťania bcrypt,
nie jeho cenu pri spustení. Ide o podozrenie,
nie príčinu — vyššie uvedený záťažový pokus
ho mal vyvolať, no nevyvolal.

**Čo sa neurobilo:** limity `expect` ani testu
sa nezvýšili. Príznak by zmizol bez poznania
a výstupné kritérium 6 projektu (`qa/docs/test-plan.md`)
to presne zakazuje — test môže začať prechádzať
po zmene aplikácie, nie po uvoľnení tvrdenia.

**Ďalší krok pri opakovaní:** zlyhávajúci beh
zachytiť s `--trace on` a časovaním `PWDEBUG`
spolu s časmi požiadaviek servera, aby sa front
dal vidieť namiesto hádania. Tretí výskyt
umožní vyššie uvedené podozrenie otestovať.

**→ Zatiaľ bez pravidla.** Pravidlo z necharakterizovaného
zlyhania by bolo iba odhadom s pripojeným číslom.


---
<a id="bug-006--the-load-runner-returned-127-after-a-run-where-every-threshold-passed--low--closed"></a>

### BUG-006 · Záťažový runner vrátil 127 po behu so splnenými všetkými hranicami · Nízka · CLOSED

| | |
|---|---|
| Zistené pri | S12, pri pridávaní tretieho záťažového skriptu |
| Komponent | `qa/load/run.js` |

Úplné hlásenie: [`qa/docs/defects/BUG-006-load-runner-exit-127.md`](../qa/docs/defects/BUG-006-load-runner-exit-127.md).

**Kroky na reprodukciu:** spustite `npm run test:load`.
Každý proces k6 končí s 0, každý prah prechádza,
súhrn sa vypíše — a runner vráti **127**.

**Očakávanie:** návratový kód je výsledok. Zelený beh
musí hlásiť úspech, inak príkaz nemôže slúžiť ako brána.

**Skutočnosť:** opakovane 127. Skôr v tom istom vyšetrovaní
runner tiež *potichu* skončil medzi skriptmi, takže druhé
a tretie meranie vôbec neprebehli a nevypísal sa dôvod.

**Príčiny: dve, v niekoľkých rovnakých riadkoch.**

1. `startServer` pripojil `server.on('error', …)`,
   ktorý volal `process.exit(1)`. Handler bol určený
   pre prípad, že server nenaštartuje, ale spúšťal
   sa aj pri úmyselnom ukončení podprocesu.
   Čistenie po prvom skripte preto ukončilo celý beh —
   správa bola zahrabaná vo výstupe k6, takže to
   vyzeralo, akoby sa beh len zastavil.
2. Po oprave zostal návratový kód nesprávny. Postupným
   odstraňovaním jednotlivých krokov sa zistilo,
   že **samotné volanie `child.kill()`** stačilo
   na tomto počítači na poškodenie návratového
   stavu runnera. Ne pomohol neškodný `error` listener,
   try/catch ani presun do handlera `process.on('exit')`.
   Odstránenie ukončenia pomohlo okamžite a opakovane.

Mechanizmus druhého bodu sa neurčil; priznať to
je užitočnejšie než číselne podložený odhad.

> ### ⚠ Oprava, S14 — príčina 2 vyššie je nesprávna
>
> Rovnaký kód 127 sa objavil v `qa/api/run.js` (BUG-008)
> a tam sa správne izoloval. **`child.kill()` nie je
> spúšťač.** Ukončenie spusteného servera a bežný návrat
> vždy skončia s 0.
>
> Spúšťač je **`fs.rmSync` nad databázou `better-sqlite3`,
> ktorú iný proces stále drží otvorenú**; volajúci proces
> sa ukončí vnútri volania bez výnimky a návratovej hodnoty.
> Vyššie uvedené delenie odstránilo ukončenie podprocesu
> *aj* mazanie naraz, lebo `cleanUp` robil oboje,
> a zásluha sa mylne pripísala nesprávnej polovici.
>
> Oprava bola správna z nesprávneho dôvodu, čo zanechalo
> pravidlo „neukončujte podprocesy“, hoci skutočné pravidlo
> znie „nemažte databázu, ktorú ešte niekto drží otvorenú“.
> Prvé je povera, ktorá by sa časom odmietla;
> druhé pomenúva mechanizmus.
>
> Namerané v BUG-008. R8 sa podľa toho prepísalo.
> Kód záťažového runnera netreba meniť — dôležité bolo
> odstránenie mazania — a po úplnom behu v S14 sa znovu
> potvrdilo, že porty 3100–3102 sú voľné.

**Oprava:** runner už nič neukončuje. Servery sú jeho
podprocesy a končia s ním — potvrdila to kontrola
voľných portov 3100–3102. Jediným zostávajúcim čistením
je mazanie starých `data/load-*.db` súborov; presunulo
sa na **začiatok** behu, keď nemôže ovplyvniť výsledok,
ktorý ešte nenastal. k6 sa spúšťa priamo namiesto
`shell: true`, čím zmizne upozornenie Node
o neescapovaných argumentoch.

**Regresia:**

```
runner -> 0
scripts run: 3
summaries: qa/reports/load-*.json
ports 3100, 3101, 3102 free afterwards
```

**→ Pravidlo R8.**

---
<a id="bug-007--a-test-script-never-ran-and-the-suite-reported-it-as-green--medium--closed"></a>

### BUG-007 · Testovací skript sa vôbec nespustil a sada hlásila zelený výsledok · Stredná · CLOSED

| | |
|---|---|
| Zistené pri | S14, bežné spustenie sady po nesúvisiacej zmene |
| Komponent | `qa/api/wallet.postman_collection.json` — `08 · Settings and the month balance / Another user's income does not leak` |

Úplné hlásenie: [`qa/docs/defects/BUG-007-test-script-never-ran.md`](../qa/docs/defects/BUG-007-test-script-never-ran.md).

**Kroky na reprodukciu:** `npm run test:api` a prečítajte súhrnný riadok.

**Očakávanie:** 93 požiadaviek a všetky vykonajú svoje tvrdenia.

**Skutočnosť:**

```
requests   93  (0 failed)
assertions 337  (0 failed)
```

Zelený výsledok. Vlastná tabuľka newman pritom uvádzala
`test-scripts  93  1` — jeden skript sa nevykonal:

```
1.  SyntaxError
      missing ) after argument list
      at test-script
      inside "08 · Settings and the month balance / Another user's income does not leak"
```

Táto požiadavka netestovala **nič**. Jej tri kontroly —
200, schéma a vlastnosť, že príjem používateľa B
nie je príjmom používateľa A — sa nikdy nespustili.
Číslo `337` bolo o tri nižšie bez náznaku, že niečo chýba.

Je to kontrola izolácie medzi používateľmi;
dôvod jej existencie je spec §4.3.

**Príčina:** apostrof.

```js
pm.test('user B has their own income, not user A's', function () {
```

Reťazec je v jednoduchých úvodzovkách a názov obsahuje
`user A's`, ktoré ho predčasne ukončí. Zvyšok riadku
je syntaktická chyba, takže sa skript nespracuje
ani nespustí. Susedný test na riadku 875 to zapísal
správne — `pm.test("user B's categories are not user A's rows", …)` —
kolekcia teda obsahuje chybu aj jej vlastný protiklad.

**Prečo sa to nezachytilo.** Tri nezávislé mechanizmy
sa k tomu priblížili:

1. **Súhrnný riadok** uvádzal `assertions 337 (0 failed)`.
   Skript, ktorý zlyhá pred prvým `pm.test`,
   pridá nula tvrdení a nula zlyhaní. Neprítomnosť
   vyzerá rovnako ako úspech.
2. **Návratový kód** bol 127 — ale to bol BUG-008,
   ktorý sa objavoval aj pri zelených behoch,
   takže neniesol signál.
3. **Brána C8** počíta stavy testované v kolekcii
   vyhľadaním `expectStatus(…)` v texte skriptu.
   Regex nájde aj skript, ktorý sa nikdy nevykoná.
   C8 číta zdroj, nie beh.

Všetky tri podávajú správu o behu, ale nedokážu
odlíšiť „skontrolované a úspešné“ od „neskontrolované“.

**Oprava:** má dve časti a druhá je rozhodujúca.

- Názov testu prešiel na dvojité úvodzovky podľa suseda.
- `qa/api/run.js` teraz **vždy** vypisuje riadok `scripts`
  a pri nenulovom počte výslovné upozornenie:

  ```
  requests   93  (0 failed)
  assertions 340  (0 failed)
  scripts    93  (0 failed to run)
  ```

  Číslo zobrazované iba pri chybe sa nikto nenaučí čítať.
  Zobrazenie pri každom behu dáva číslam `340` a `93/93`
  význam až spolu.

**Regresia:** tri chýbajúce tvrdenia sa vrátili —
337 → **340** — a kontrola príjmu medzi používateľmi
sa teraz skutočne vykonáva.

**→ Pravidlo R10.**

---
<a id="bug-008--the-api-runner-exits-127-on-a-green-run-so-the-first-ci-build-would-be-red--high--closed"></a>

### BUG-008 · API runner vracia 127 pri zelenom behu, takže prvé zostavenie CI by bolo červené · Vysoká · CLOSED

| | |
|---|---|
| Zistené pri | S14, ručná kontrola návratového kódu `npm run test:api` |
| Komponent | `qa/api/run.js` — `cleanUp` |
| Dopad na | `.github/workflows/ci.yml`, úloha **api** — krok, ktorý kontroluje celú pipeline |

Úplné hlásenie: [`qa/docs/defects/BUG-008-api-runner-exit-127.md`](../qa/docs/defects/BUG-008-api-runner-exit-127.md).

**Kroky na reprodukciu:**

```
npm run test:api ; echo $?
```

**Očakávanie:** 0. Všetky tvrdenia prešli.

**Skutočnosť:** 127 pri behu 93 požiadaviek a 340 tvrdení
bez zlyhania. Reprodukované aj priamo cez
`node qa/api/run.js`, takže výsledok neskresľuje npm.

**Prečo je tento prípad High a BUG-006 Low.**
Rovnaký príznak, odlišný rozsah dopadu.
BUG-006 bol v záťažovom runneri, od ktorého nič nezávisí.
Tento je krok CI `- run: npm run test:api`,
ktorý kontroluje úlohu e2e, a tým celú pipeline.
**Prvé zostavenie po prvom pushi by bolo červené**
na kroku, ktorý v skutočnosti prešiel. Červené
prvé zostavenie repozitára čítaného ako ukážka práce
má väčšiu cenu než bežne nesprávny návratový kód.

**Príčina — izolovaná, nie odvodená.**
BUG-006 pripisoval vinu `child.kill()`.
To bolo nesprávne a tu sa to preukázalo.
Päť samostatných zjednodušených skriptov:

| # | Čo sa vykonalo | Návratový kód |
|---|---|---|
| 1 | spustiť server, ukončiť ho, bežne sa vrátiť | **0** |
| 2 | spustiť, ukončiť a potom vykonať `rmSync` databázy | **127** |
| 3 | ako 2, so synchrónnym logovaním | **127** — končí *vnútri* `rmSync`, bez výnimky a návratu |
| 4 | spustiť, **neukončiť**, `rmSync` živej databázy servera | **127** |
| 5 | spustiť, ukončiť, **počkať na udalosť `exit`**, potom `rmSync` | **0** |

Test 1 vylučuje samotné ukončenie. Test 4 usvedčuje
mazanie aj bez neho. Test 3 ukazuje, že proces
sa *ukončí vnútri volania* — `fs.rmSync` sa nevráti
ani nevyhodí výnimku a riadok po ňom sa nevypíše
ani pri synchrónnom zápise.

Test 6 to zúžil: obyčajný súbor otvorený iným
procesom sa zmaže bez problémov a volajúci prežije.
Ide teda konkrétne o databázu, ktorú `better-sqlite3`
stále drží otvorenú, nie o otvorené súbory všeobecne.

**Čo zostáva neznáme:** *prečo* sa proces ukončí
namiesto prijatia `EBUSY`. Windows 11, Node v24.13.1.
Uvádza sa to bez hádania — spúšťač je priradený
jednému riadku, čo oprave stačí.

**Oprava:**

- Vlastná databáza behu sa nikdy nemaže.
  Staré súbory `data/api-*.db` sa odstraňujú
  na **začiatku** behu, keď nemôžu ovplyvniť
  výsledok, ktorý ešte nenastal (R8).
- Server sa ukončí a **počká sa naň** —
  `server.once('exit', …)` pred návratom.
  Súčasne musia platiť tri veci: podproces musí
  skončiť (inak po behu drží port 3001),
  proces sa musí ukončiť sám (živý podproces
  drží slučku udalostí — verzia bez ukončenia
  visela päť minút) a kód musí prežiť
  (`process.exit()` skráti bufferovaný stdout,
  čím pri pokuse zmizol celý súhrn aj HTML správa).

**Regresia:**

```
npm run test:api           requests 93 (0 failed), assertions 340 (0 failed)
exit code                  0
qa/reports/api-report.html 963 KB, written
port 3001 afterwards       no LISTENING socket
data/api-*.db              swept at the start of the next run
```

Opravu BUG-006 potvrdil aj následný úplný záťažový
beh: porty 3100–3102 voľné, runner vracia 0.

**→ Pravidlo R8** (prepísané).

---
<a id="bug-009--the-server-segfaults-on-node-20-in-ci-so-the-first-build-was-red--high--closed"></a>

### BUG-009 · Server v CI na Node 20 zlyhá so segmentation fault, takže prvé zostavenie bolo červené · Vysoká · CLOSED

| | |
|---|---|
| Zistené pri | S15, prvý beh CI po prvom pushi |
| Komponent | `.github/workflows/ci.yml` — `NODE_VERSION` a `package.json` `engines` |
| Dopad na | obe úlohy spúšťajúce server: **api** a **e2e** |

Úplné hlásenie: [`qa/docs/defects/BUG-009-segfault-on-node-20.md`](../qa/docs/defects/BUG-009-segfault-on-node-20.md).

**Kroky na reprodukciu:** spustite workflow na `ubuntu-latest`
s `node-version: 20`.

**Očakávanie:** rovnaká zelená sada ako lokálne —
340 tvrdení, 92 e2e testov. Spec §2 uvádza Node 20+
a `package.json` uvádzal `engines: >=20`.

**Skutočnosť:** server zlyhá hneď pri štarte.

```
[WebServer] Segmentation fault (core dumped)
Error: Process from config.webServer was not able to start. Exit code: 139
```

139 je 128 + 11 — SIGSEGV. Úloha api narazila
na ten istý problém o úlohu skôr, no menej viditeľne,
lebo jej server sa spúšťa na pozadí:

```
the server at http://localhost:3001 never became healthy (fetch failed)
```

**Príčina:** `better-sqlite3@13.0.3` deklaruje
`engines: { "node": ">=22" }`. CI bolo pripnuté
na Node **20**. npm považuje `engines` iba
za odporúčanie, pokiaľ nie je nastavené
`engine-strict`; inštalácia preto prešla
a natívna binárka sa načítala do nepodporovaného
runtime, kde skončila so SIGSEGV namiesto
čitateľnej chyby.

Rovnaké nesprávne tvrdenie obsahovali dva
vlastné súbory:

| | Uvádzalo | Skutočnosť |
|---|---|---|
| `package.json` `engines` | `>=20` | `>=22`, vyžaduje better-sqlite3 |
| `.github/workflows/ci.yml` | `NODE_VERSION: '20'` | runtime nepodporovaný závislosťou |

Nikto zámerne neklamal. Minimálna verzia vznikla,
keď bol zoznam závislostí krátky; neskôr závislosť
nenápadne zvýšila vlastné minimum pri menšej
aktualizácii, ktorú nikto znova neprečítal.

**Treba tiež uviesť:** podpora Node 20 skončila
v apríli 2026. CI bolo pripnuté na nepodporovaný
runtime a segfault tento problém iba zviditeľnil.

**Oprava:** `NODE_VERSION: '22'` a `engines: ">=22"`.
Zaznamenané ako **D-028** vrátane konfliktu
so spec §2 „Node.js 20+“ — špecifikácia sa nemení,
odchýlka je datované rozhodnutie.

**Prečo 22 a nie 24 používaná pri vývoji:** 22 je
minimum, ktoré projekt teraz deklaruje, a práve
to sa najpravdepodobnejšie pokazí. Hornú časť
rozsahu pokrýva vývojový počítač. CI testujúce
iba najnovší runtime neukáže, či je deklarované
minimum skutočné.

**Regresia:** samotný workflow. Predchádzajúci
neúspešný beh je zachovaný v histórii behov.

**→ Pravidlo R11.**

---
<a id="bug-010--the-api-runner-exits-0-when-the-server-never-starts-so-ci-called-it-green--critical--closed"></a>

### BUG-010 · API runner vráti 0, aj keď sa server nikdy nespustí, takže CI hlásilo úspech · Kritická · CLOSED

| | |
|---|---|
| Zistené pri | S15, čítanie logov CI behu, ktorý BUG-009 zmenil na červený |
| Komponent | `qa/api/run.js` — `main` |
| Dopad na | brána CI celej vrstvy API |

Úplné hlásenie: [`qa/docs/defects/BUG-010-runner-green-on-no-server.md`](../qa/docs/defects/BUG-010-runner-green-on-no-server.md).

**Toto je najhorší defekt v registri** z jednoduchého
dôvodu: všetky ostatné záznamy opisujú niečo,
čo sa pokazilo. Tento opisuje niečo, čo
**prešlo, hoci malo zlyhať**.

**Kroky na reprodukciu:** spôsobte zlyhanie
štartu servera, potom spustite `npm run test:api`
a prečítajte návratový kód.

```
node -e "require('http').createServer((q,s)=>{s.writeHead(500);s.end()}).listen(3060)" &
QA_PORT=3060 node qa/api/run.js ; echo $?
```

**Očakávanie:** nenulový kód. Neodoslala sa
žiadna požiadavka a nič sa neoverilo.

**Skutočnosť (pred opravou):** úloha CI vypísala
zlyhanie a prešla:

```
the server at http://localhost:3001 never became healthy (fetch failed)
✓ API checks (newman) in 55s
```

O krok neskôr nasledovala jediná ďalšia stopa:

```
##[warning]No files were found with the provided path: qa/reports/.
```

**Príčina:** návratový kód sa nastavoval *po*
`await`, ktorý sa už nemohol dokončiť.

```js
if (server && !server.killed) {          // the child is dead; killed is false
  await new Promise((resolve) => {
    server.once('exit', resolve);        // 'exit' already fired — never again
    server.kill();                       // returns false, emits nothing
  });
}
process.exitCode = code;                 // never reached
```

`server.killed` odpovedá na otázku „bol odoslaný
signál?“, nie „skončil podproces?“. Ak podproces
skončil sám, hodnota je `false`, takže sa vetva
vykonala; udalosť `exit` už nastala, preto
sa promise nikdy nedokončil; `main()` sa nevrátil;
a keď nezostali aktívne handly, Node skončil s **0**.

Museli sa stretnúť tri okolnosti, práve preto
chyba prežila: server musel skončiť *sám*
(ukončovací signál by fungoval), zlyhanie
muselo byť v bloku try (takže `code` bol už 1
a vyzeral ošetrený) a proces nesmelo nič
ďalšie držať aktívny (takže potichu skončil,
namiesto toho, aby visel a niekto si to všimol).

**Toto je BUG-008 v opačnom smere.** Tam
čistenie zmenilo úspech na 127; tu zmenilo
zlyhanie na 0. To isté pravidlo bolo porušené
z oboch strán: **výsledok sa musí zaznamenať
pred čistením a nič po ňom ho nesmie zmeniť.**
R8 to už hovorilo, ale predchádzajúca oprava
nechala priradenie ako posledné.

**Oprava:**

- `process.exitCode = code` sa presunulo **pred**
  všetko čistenie.
- Skončenie podprocesu sa sleduje od spustenia
  cez `server.once('exit', …)` nastavujúce príznak,
  namiesto kontroly `server.killed`.
- Čakanie má 5-sekundový limit s `unref`,
  takže podproces ignorujúci SIGTERM zanechá
  zatúlaný proces namiesto zničenia celého behu.

**Regresia:** reprodukované blokovaním portu,
preto server zlyhá s `EADDRINUSE` a kontrola
zdravia nikdy neprejde — presná podoba CI:

```
the server at http://localhost:3060 never became healthy (HTTP 500)
EXIT: 1
```

Bežná zelená cesta sa naďalej hlási správne:
93 požiadaviek, 340 tvrdení, návratový kód 0.

**→ Pravidlo R8** — znenie zostáva rovnaké,
no implementácia ho porušila dvakrát,
čo je užitočnejšie zistenie.

---
<a id="bug-011--two-servers-started-at-once-on-one-database-and-one-dies-at-boot--medium--closed"></a>

### BUG-011 · Dva servery spustené naraz nad jednou databázou; jeden zlyhal pri štarte · Stredná · CLOSED

| | |
|---|---|
| Nájdené v | S16, prvý pokus `qa/race/` spustiť dva servery nad jedným súborom |
| Komponent | `src/db.js` — štartovacie pragmy |

**Kroky reprodukcie:** vymažte databázový súbor a potom v rovnakom
okamihu spustite dva servery s rovnakou cestou `DB_PATH`. Pri zaťažení
CPU jeden z nich zlyhá skôr, než začne počúvať.

**Očakávané:** oba sa spustia. Aplikácia nikde netvrdí, že databázu
môže používať iba jeden proces, a SQLite je na takéto používanie vytvorené.

**Actual:**

```
SqliteError: database is locked
    at Database.pragma (better-sqlite3/lib/methods/pragma.js:11:44)
    at Object.<anonymous> (src/db.js:16:4)
  code: 'SQLITE_BUSY'
```

**Príčina:** `db.pragma('journal_mode = WAL')` potrebuje zámok, ktorý
nedrží iné spojenie. Na **čerstvom** súbore sa o prepnutie pokúšajú oba
procesy a porazený dostane SQLITE_BUSY. Neskoršie štarty nie sú dotknuté —
súbor už je vo WAL a príkaz nič nemení — preto je to chyba prvého štartu
a preto zostala tak dlho skrytá.

Samotný `busy_timeout` ju neopraví, a práve toto zistenie je užitočné:
po jeho pridaní jeden beh stále zlyhal — tentoraz pri **čítaní**
`journal_mode`. Niektoré vetvy pragmy odmietajú namiesto zaradenia
do radu a na čítanie pragmy, ktoré zlyhá, nemožno čakať.

**Meranie, pretože prvý pokus o reprodukciu nevyšiel a chybu, ktorú
nemožno vyvolať na požiadanie, by bol len príbeh:**

| | zlyhania |
|---|---|
| pôvodný kód, nezaťažený počítač, 42 pokusov | 0 |
| pôvodný kód, **6 procesov zaťažujúcich CPU**, 20 pokusov | **2** (SQLITE_BUSY) |
| opravený kód, rovnaké zaťaženie, 20 pokusov | 0 |

Zaťaženie je spúšťač: rozširuje okno medzi zápisom schémy prvého procesu
a pragmou druhého. Dve skoršie pozorovania nastali pri zaťaženom počítači,
čo vtedy vyzeralo ako náhoda.

**Oprava:** najprv `busy_timeout`, potom pomocná funkcia `whileLocked(label, step)`,
ktorá opakuje štartovací krok najviac päť sekúnd, kým SQLite hlási zámok —
aplikuje sa na pragmy a opakovanie schémy. Režim žurnálu sa teraz
**číta pred nastavením**, takže sporný zápis nastane iba pri tom jedinom
štarte, ktorý ho musí vykonať.

**Regresia:** rámec 20 pokusov pri zaťažení a samotné `qa/race/`,
ktoré pri každom behu spúšťa dva servery nad jedným súborom.

**→ Rule R12.**

---

<a id="bug-012--two-processes-writing-one-database-answer-500--high--closed"></a>

### BUG-012 · Dva procesy zapisujúce do jednej databázy odpovedajú 500 · Vysoká · CLOSED

| | |
|---|---|
| Zistené pri | S16, scenár C v `qa/race/` |
| Komponent | `src/routes/schedules.js` — obe transakcie |
| Dopad na | každé nasadenie s viac než jedným serverovým procesom nad jedným databázovým súborom |

Úplné hlásenie: [`qa/docs/defects/BUG-012-deferred-transaction-500.md`](../qa/docs/defects/BUG-012-deferred-transaction-500.md).

**Kroky na reprodukciu:** `npm run test:race`.
Scenár C spláca pôžičku na jednom serveri
a súčasne ju upravuje na druhom, pričom oba
zdieľajú jeden databázový súbor.

**Očakávanie:** obe požiadavky uspejú alebo jedna
prehrá súbeh so zrozumiteľnou odpoveďou.
Spec §5: **500 nesmie byť nikdy dostupná.**

**Skutočnosť:** 4 zo 40 dvojíc odpovedali 500.

```
C · pay vs edit — TWO processes, one database file
      36 × pay 200 · edit 200
       4 × pay 200 · edit 500
    violations: 4

SqliteError: database is locked   ... at src/routes/schedules.js:199
  code: 'SQLITE_BUSY'
```

**Príčina:** typ transakcie. `db.transaction()`
vydá obyčajné `BEGIN`, ktoré je **odložené** —
získa zámok na čítanie a pri prvom zápise
sa ho pokúsi povýšiť na zápisový. Ak medzitým
zapisovalo iné spojenie, SQLite ho **okamžite**
odmietne s SQLITE_BUSY a `busy_timeout` sa
neuplatní: snímka, z ktorej transakcia vychádzala,
je zastaraná a čakanie ju neobnoví.

Globálne `busy_timeout = 5000` pridané pre BUG-011
tu preto vôbec nepomáha. Dva defekty sa hlásia
ako „database is locked“, no majú odlišné
mechanizmy aj opravy.

**Oprava:** `pay.immediate()` a `edit.immediate()`.
`BEGIN IMMEDIATE` získa zámok na zápis vopred;
na tento krok sa `busy_timeout` **vzťahuje**,
takže druhý zapisujúci čaká namiesto odmietnutia.

**Regresia:**

```
before   4 of 40 cross-process pairs answered 500
after    40 of 40 answered 200, zero invariant violations
```

**→ Pravidlo R12.**

---
<a id="bug-013--the-edit-panel-opened-underneath-the-bottom-navigation--medium--closed"></a>

### BUG-013 · Panel úpravy sa otvoril pod spodnou navigáciou · Stredná · CLOSED

| | |
|---|---|
| Nájdené v | S16, zistené end-to-end sadou na viewporte telefónu |
| Komponent | `public/index.html`, `public/style.css` — panel úpravy |
| Dotýka sa | úpravy výdavku na telefóne, teda každého používateľa aplikácie navrhnutej pre telefón |

**Kroky na reprodukciu:** pri 375×812 otvorte výdavok na úpravu a stlačte Save.

**Očakávanie:** panel je nad všetkým ostatným a jeho tlačidlá sa dajú stlačiť.

**Skutočnosť:** na tlačidlo Save sa nedalo kliknúť. Playwright našiel
prvok, posunul sa k nemu, označil ho za „visible, enabled and stable“ —
kliknutie však nedopadlo, pretože nad ním bola pevná spodná navigácia.

**Päť zo šiestich testov zlyhalo na `mobile-chromium` a všetkých šesť
prešlo na `desktop-chromium`.** Tento rozdiel je charakteristický:
problém vrstvenia sa prejaví tam, kde je viewport dosť nízky na prekrytie prvkov.

**Príčina:** panel bol vo vnútri `#screen-month` a `.screen` je flex potomok
s vlastným miestom v poradí vrstvenia. `z-index` nastavený na potomkovi
je obmedzený kontextom vrstvenia svojho predka, takže `z-index: 40`
súťažil s ďalšími deťmi tejto sekcie — nie s navigačným panelom, ktorý
je súrodencom sekcie, vykresľuje sa neskôr, a preto je navrchu.

Prvok bol skutočne viditeľný. Nebol skrytý, zakázaný ani zle umiestnený.
Ležal pod niečím iným, čo je iný typ zlyhania, ktorý `toBeVisible()`
nezachytí — asercia, ktorá by tu „prešla“, je presne tá intuitívna.

**Oprava:** panel sa presunul mimo sekcie medzi súrodencov navigácie,
kde s ňou jeho `z-index` súťaží priamo, a zvýšil sa na 50.
Zatvorenie pri zmene obrazovky sa presunulo do `showScreen`, pretože
skrytie sekcie už panel neskryje.

**Regresia:** šesť testov úpravy v oboch viewportoch. Boli napísané
pred opravou a zlyhali zo správneho dôvodu; iba tak možno vedieť,
že regresný test by zachytil chybu, podľa ktorej je pomenovaný.

**→ Rule R13.**

---

<a id="limit-002--the-same-post-twice-creates-two-expenses--accepted"></a>

### LIMIT-002 · Rovnaký POST dvakrát vytvorí dva výdavky · ACCEPTED

> **Aktualizácia S23 (D-035).** Rozsah sa zúžil, neuzavrel. POST s
> `Idempotency-Key` je teraz bezpečný pri opakovaní: rovnaký kľúč a payload
> zopakujú prvú 201 (`Idempotency-Replayed: true`), iný payload má 409,
> vymazaný výdavok sa neobnoví. Obrazovka revízie AI vždy posiela kľúč.
> POST bez kľúča — cesta klávesnice, Newman, pytest — sa správa presne
> podľa merania nižšie a stále ide o správne HTTP. Dôkaz:
> `qa/ai/tests/idempotency.test.js` (20 súbežných uložení s rovnakým
> kľúčom → 1 riadok), priečinok Newman 11, pytest
> `test_parallel_retries_with_one_key_create_one_expense`.

| | |
|---|---|
| Nájdené v | S16, scenár D v `qa/race/` — výslovne vyžiadaná kontrola |
| Komponent | `src/routes/transactions.js` — `POST /` a neprítomnosť idempotency key |

**Čo sa meralo:** dve bajtovo identické požiadavky `POST /api/transactions`
odoslané pomocou `Promise.all` štyridsaťkrát.

```
D · the same POST twice, as a network retry would send it
      40 × 201 · 201
      40 × 2 row(s) stored
    pairs that produced a duplicate row: 40 of 40
```

**Každá dvojica vytvorila duplicitu. Žiadna deduplikácia neexistuje.**

**Vopred sa to klasifikovalo — „ak to duplikuje, ide o skutočnú chybu,
úplná správa“. Meranie tomu odporuje a tento nesúlad je obsahom správy.**

Dva POST vytvárajúce dva riadky znamenajú, že HTTP funguje podľa špecifikácie:
POST nie je idempotentné a server, ktorý by ich potichu zlúčil, by sa mýlil
spôsobom oveľa ťažším na zistenie než duplicita. Dve kávy po €2.00 v jeden
deň sú bežný nákup. Obrazovka, ktorá by ich deduplikovala, by skryla
skutočný výdavok a chýbajúci riadok sa hľadá ťažšie než nadbytočný.

Otázka teda nie je „duplikuje API“ — robí to správne — ale
**môže človek používajúci aplikáciu vytvoriť duplicitu?** Testovalo sa to
z jedinej dostupnej strany (`qa/e2e/double-submit.spec.js`):

| Pokus | Výsledok |
|---|---|
| Dve rýchle ťuknutia na Save | jeden výdavok |
| Enter dvakrát vo formulári plánovanej platby | jedna plánovaná platba |
| Druhé Save po dokončení prvého | dva výdavky — správne |

`withBusy` zakáže ovládanie synchronne pred čakaním na prvú požiadavku,
takže druhá udalosť dopadne na zakázané tlačidlo. **Žiadna dostupná cesta
v tejto aplikácii nevytvára duplicitu.**

**Čo zostáva, otvorene pomenované:** opakovanie na transportnej vrstve by
duplicitu vytvorilo a nič tu by mu nezabránilo. Prehliadače neopakujú
POST samy od seba a aplikácia nemá service worker, takže taká cesta dnes
neexistuje. Ak sa objaví — offline front alebo proxy s opakovaním —
riešením je hlavička `Idempotency-Key`, čo je zmena kontraktu API v spec §5,
teda `D-###`, nie drobná oprava.

**Prijaté** na tomto základe: správne správanie protokolu, žiadna dostupná
chyba a pomenovaný mechanizmus ochrany — lebo ochrana, na ktorú nikto nevie
ukázať, je náhoda čakajúca na refaktor.

**→ Bez pravidla.** Ochrana (`withBusy`) už existuje a predchádza tejto kontrole.

---

<a id="s21-audit-findings--no-fixes-applied"></a>

## Zistenia auditu S21 — bez aplikovaných opráv

Tieto pozorovania pochádzajú z úplného auditu skoršej verzie.
Všetky aktívne reprodukcie používali dočasnú kópiu, syntetické
účty a samostatné súbory SQLite. Existujúca zelená sada
tieto hranice nevykonávala.

<a id="bug-014--categories-collapse-to-an-18-px-strip-on-a-short-phone--high--closed"></a>

### BUG-014 · Kategórie sa na krátkom telefóne zrútili na pás vysoký 18 px · Vysoká · CLOSED

| | |
|---|---|
| Nájdené v | S21, skutočné Chromium pri 320×568 |
| Komponent | `public/style.css` — flex rozloženie Add a ovládacie prvky s pevnou výškou |

**Kroky reprodukcie:** prihláste sa s predvyplnenými predvolenými kategóriami;
zmeňte veľkosť na 320×568; otvorte Add. Skontrolujte viditeľnú výšku skupiny
Categories a snímku obrazovky.
**Očakávané:** čitateľné/voliteľné kategórie vedľa číselnej klávesnice (spec §6.1).
**Skutočnosť:** clientHeight 18, scrollHeight 670. Štítky sú orezané na úzky
pás. Save zostáva viditeľné; horizontálna šírka dokumentu je správne 320.
**Príčina:** suma, poznámka, klávesnica a navigácia spotrebujú dostupnú
výšku; flexibilný posúvateľný zoznam kategórií absorbuje nedostatok.
**Oprava:** S23, necommitnuté. `public/style.css`, blok `(max-width: 699px) and
(max-height: 760px)`: zoznam kategórií zachová minimum 150 px a stále sa
posúva vo vnútri, hlavička a klávesnica sú kompaktnejšie a obrazovka Add
sa posúva ako celok, ak sa ani tak nezmestí. Save zostáva na jedno potiahnutie;
nič nie je skryté.
**Regresia:** `qa/e2e/ai/add-layout.spec.js`, napísaný a spustený najprv v červenom stave:
clientHeight 18 pri 320×568 a 108 pri 375×667 proti starému CSS (hranica
120). Po oprave: 4/4 na mobilnom a desktopovom projekte — zoznam ≥ 120 px,
dva riadky úplne viditeľné, bez horizontálneho pretečenia,
zadanie sumy → kategórie → Save sa dokončí.
Patrí do sady AI, pretože chyba chráni obrazovku Add, na ktorej leží vstupný
bod AI.
**→ Pravidlo R14.**

<a id="bug-015--editing-an-uncategorised-expense-sends-category-zero--medium--closed"></a>

### BUG-015 · Úprava nekategorizovaného výdavku odosielala kategóriu nula · Stredná · CLOSED

| | |
|---|---|
| Nájdené v | S21, úprava v prehliadači a zachytený stav PATCH |
| Komponent | `public/app.js` — openTransactionEditor / submitTransactionEdit |

**Kroky reprodukcie:** vytvorte platný výdavok s vynechaným/null category_id;
otvorte jeho riadok Month; zmeňte iba Note; uložte.
**Očakávané:** zmení sa iba poznámka a kategória zostane null (D-029).
**Skutočnosť:** PATCH obsahuje category_id 0 a vracia 400. Výber pomenovanej
kategórie je obchádzka, ale nesprávne si vynucuje zmenu klasifikácie.
**Príčina:** select neobsahuje prázdnu možnosť; null sa vykreslí ako prázdna
hodnota a potom sa Number('') zmení na 0, na rozdiel od pôvodného null.
**Oprava:** aplikovaná v commite `a399e79`. Zoznam kategórií editora sa teraz
otvára s explicitnou možnosťou *Uncategorised* (hodnota `""`), tou istou,
ktorú už mal formulár revízie AI, takže „bez kategórie“ sa dá zobraziť
a človek ju môže zvoliť. Pri uložení sa hodnota číta ako
`rawCategory === '' ? null : Number(...)`, takže null zostane null;
existujúce porovnanie „poslať iba zmenené“ potom nevidí zmenu a úplne
vynechá `category_id` z patchu. Server nepotreboval nič:
`ownedCategoryId` už null prijímal.
**Regresia:** TC-E2E-070 (úprava iba poznámky), TC-E2E-071 (uloženie bez zmeny
neodosiela žiadnu požiadavku) a TC-E2E-072 (výdavok vytvorený zaplatením
plánovanej platby bez kategórie) v `qa/e2e/editing.spec.js`. Čítajú PATCH
zo siete namiesto obrazovky, pretože chyba bola v obsahu požiadavky:
asercia na obrazovke by prešla hneď, ako by toast povedal „saved“.
Kontrola: po vrátení dvoch riadkov opravy všetky tri zlyhajú v oboch
viewportoch (6 z 6); s opravou prechádza 18 z 18 v tomto súbore.
**→ Pravidlo R14.**

<a id="bug-016--concurrent-registrations-of-the-same-email-return-500--high--closed"></a>

### BUG-016 · Súbežné registrácie rovnakého e-mailu vracali 500 · Vysoká · CLOSED

| | |
|---|---|
| Nájdené v | S21, päť párov súbežných registračných požiadaviek |
| Komponent | registrácia v `src/auth.js`, `src/schema.sql` users.email UNIQUE |

**Kroky reprodukcie:** odošlite dve súbežné požiadavky POST /api/auth/register
s rovnakým novým syntetickým e-mailom a platným heslom; zopakujte s čerstvými e-mailmi.
**Očakávané:** jedna 201, jeden riadený konflikt duplicitného e-mailu, nie INTERNAL.
**Skutočnosť:** všetkých 5 párov vracia 201 + 500; server vidí SQLITE_CONSTRAINT_UNIQUE.
**Príčina:** obe kontroly SELECT skončia pred asynchrónnym bcrypt.hash; prehrávajúci
INSERT poruší UNIQUE, čo sa nemapuje na konfliktovú chybu aplikácie.
**Oprava:** aplikovaná v commite `e291ea9`. Vloženie a štartovacie kategórie
sú teraz v jednej `db.transaction`, takže účet už nemôže existovať bez potrebných
riadkov; `SQLITE_CONSTRAINT_UNIQUE` z tohto zápisu sa prekladá na rovnaký
`conflict` ako predbežné čítanie — 409, nie 500. Predbežné čítanie zostáva
rýchlou cestou, ktorá sa vyhne hashovaniu zjavného duplikátu; už sa nepovažuje
za ochranu, pretože ňou nemôže byť: `bcrypt.hash` uvoľní vykonávanie a obe
požiadavky cez neho prejdú skôr, než ktorákoľvek zapíše.
**Regresia:** scenár E v `qa/race/run.js` — dve registrácie jednej čerstvej
adresy, odoslané naraz dvom serverovým procesom zdieľajúcim jednu databázu, 120 párov
na beh. Invariant: jedna 201 a jedna 409, v ľubovoľnom poradí; akékoľvek 5xx
alebo druhá 201 sú porušením. Kontrola: po odstránení mapovania scenár hlási
`201 · 500` a porušenie v každom páre (3 z 3 v kontrolnom behu), so
`SQLITE_CONSTRAINT_UNIQUE` v serverovom logu; s opravou 0 porušení.
**→ Pravidlo R14.**

<a id="bug-017--password-suffixes-after-72-bytes-are-silently-ignored--high--closed"></a>

### BUG-017 · Koncovky hesiel po 72 bajtoch sa potichu ignorovali · Vysoká · CLOSED

| | |
|---|---|
| Nájdené v | S21, izolovaná sonda hranice registrácie/prihlásenia |
| Komponent | `src/auth.js` — validácia hesla a bcrypt |

**Kroky reprodukcie:** použite syntetické heslo zo 72 ASCII bajtov `a` nasledovaných
`A`; zaregistrujte sa a potom sa prihláste s rovnakými 72 bajtmi nasledovanými `B`.
**Očakávané:** odmietnuť nepodporovanú dĺžku alebo rozlišovať prijaté heslá.
**Skutočnosť:** registrácia 201, prihlásenie so zmenenou koncovkou 200.
Nejde o ľubovoľné obídenie hesla: prvých 72 bajtov musí byť rovnakých.
**Príčina:** kontrolovala sa len minimálna dĺžka v znakoch; bcrypt spracuje
najviac 72 bajtov, čo sa pri Unicode líši od dĺžky reťazca v JavaScripte.
**Rozhodnutie D-045:** registrácia odmieta heslo nad 72 bajtov UTF-8
stavom 400 a správou, ktorá to vysvetľuje. Prihlásenie a uložené hashe
zostávajú presne také, aké boli. Alternatíva — opätovné hashovanie schémou
čítajúcou celé heslo — by musela bežať na účtoch, ktorých otvorené heslo
nikto nemá, teda až pri ďalšom prihlásení, a dovtedy kolízia zostáva.
Odmietnutie pri vstupe ju odstráni pre každý nový účet a žiadny existujúci
účet nemôže mať dlhšie heslo, než teraz dovoľuje kontrola. Rozhodujú bajty,
nie znaky: bcrypt počíta bajty, takže „é“ stojí dva a emoji štyri.
**Oprava:** aplikovaná v commite `53b310b`. `src/auth.js` odmieta
`Buffer.byteLength(password,
'utf8') > 72` v `register` bežným `badRequest` vedľa existujúcej
kontroly minimálnej dĺžky; `login` a `bcrypt.compare` sú nezmenené.
`public/app.js` odmieta to isté pred požiadavkou, počíta pomocou
`TextEncoder`, pretože `password.length` počíta znaky, a pomenúva limit
v toast správe.
**Regresia:** TC-API-106 (72 ASCII bajtov stále prijatých, 201), TC-API-107
(73 bajtov → 400 `VALIDATION_FAILED`) a TC-API-108 (37 × `é` — 37 znakov,
74 bajtov → 400) v `qa/api/wallet.postman_collection.json`; TC-E2E-073 a
TC-E2E-074 v `qa/e2e/auth.spec.js` pre prehliadač. Oba prehliadačové
prípady tiež kontrolujú, že sa neodoslala **žiadna** požiadavka: odmietnutie
servera obsahuje rovnaké slová ako klientské, preto by samotná textová
asercia prešla aj bez pravidla v prehliadači. Kontroly: pri vypnutej
serverovej kontrole zlyhá 6 zo 631 asercí Newmana a prípad 72 bajtov
stále prejde; pri vypnutej klientskej kontrole zlyhajú oba prehliadačové
prípady. Pri zapnutých oboch má Newman 631 zo 631 a súbor auth 14 zo 14
v dvoch viewportoch.
**→ Pravidlo R14.**

<a id="bug-018--a-large-loan-loses-an-integer-cent-in-remaining-money--critical--closed"></a>

### BUG-018 · Veľká pôžička strácala jeden celý cent zostávajúcej sumy · Kritická · CLOSED

| | |
|---|---|
| Nájdené v | S21, sonda plánovanej platby s veľkým počtom a presné porovnanie BigInt |
| Komponent | totalCount v `src/validate.js`; tvar v `src/routes/schedules.js` |

**Kroky reprodukcie:** vytvorte platnú pôžičku s amount_cents=99999999 a
total_count=99999999; porovnajte remaining_cents s presným celočíselným súčinom.
**Očakávané:** 9999999800000001 centov alebo riadené odmietnutie nepodporovaných
súčtov; invariant peňazí v spec zakazuje potichu nesprávne centy.
**Skutočnosť:** 201 s 9999999800000000 centmi, nebezpečným celým číslom JavaScriptu.
Prijíma sa aj total_count=1e30. Sú to extrémne syntetické vstupy.
**Príčina:** Number.isInteger nezaručuje bezpečnú presnosť; počet a odvodený
súčin nemajú obmedzenie bezpečného celého čísla/súčinu.
**Rozhodnutie D-046:** `total_count` je obmedzený na 1200 — sto rokov
mesačných splátok — a `amount_cents × total_count` musí byť bezpečné
celé číslo; ostatné vstupy dostanú 400. Presná aritmetika (BigInt alebo
centy ako reťazce) by zmenila JSON kontrakt peňazí, od ktorého závisia
všetci klienti a testy, pre pôžičky, ktoré nikto neberie; hranica zachová
kontrakt a odstráni nesprávne číslo.
**Oprava:** aplikovaná v commite `bd516ac`. `src/validate.js` dostal
`MAX_TOTAL_COUNT = 1200` do `totalCount` a `loanTotalCents(amount, count)`,
ktorý odmieta dvojicu s nebezpečným súčinom. `src/routes/schedules.js`
ho volá pri vytvorení a v rámci transakcie úpravy na dvojici, ktorá by
po úprave zostala — zvýšenie sumy dlhej pôžičky mení súčin rovnako
ako zvýšenie počtu. `public/app.js` odmieta vo formulári viac než 1200
splátok a vysvetľuje to. S oboma stropmi je najväčší možný súčin 1.2e11,
takže kontrola súčinu sa dnes nemôže spustiť: je to invariant, na ktorom
stojí peňažný kontrakt, zachovaný pri prípadnom zvýšení ktoréhokoľvek
stropu; kým platia oba, žiadny test ho nevie dosiahnuť.
**Agregáty súhrnu:** merané, nie predpokladané. SQLite sčíta v
64-bitových celých číslach, ale `better-sqlite3` predvolene vracia
číslo JavaScriptu: pri súčte 2^53 + 1 odpovie 9007199254740992 —
zaokrúhlene, bez chyby (rovnaký dopyt s `safeIntegers` vráti presný BigInt).
`GET /summary` sčíta výdavky jedného účtu za jeden mesiac, každý najviac
100 000 000 centov, takže celkový súčet opustí presný rozsah až po viac
než 90 071 993 výdavkoch s maximálnou hodnotou za jeden mesiac
jedného účtu. Schéma ani API neobmedzujú počet riadkov za mesiac,
takže je to v praxi nedosiahnuteľné, ale nie nemožné zo samotného návrhu.
Mesačný zostatok a aritmetika limitu sčítajú čísla rovnakej veľkosti,
preto sú presné, kedykoľvek je presný celkový súčet. Zostáva to tak —
vyžaduje rovnaké rozhodnutie o reprezentácii, ktorému sa táto oprava
zámerne vyhla.
**Regresia:** TC-API-109 (1200 splátok pri strope sumy: 201 a
`remaining_cents` presne 99999999 × 1200, s kontrolou bezpečného celého čísla),
TC-API-110 (1201 → 400), TC-API-111 (nahlásená pôžička, 99999999 × 99999999 →
400), TC-API-112 (1e30 → 400) a TC-API-113 (rovnaký strop pri `PATCH`) v
`qa/api/wallet.postman_collection.json`; TC-E2E-075 v `qa/e2e/schedules.spec.js`
pre formulár, ktorý tiež kontroluje, že sa nič neodošle. Kontroly:
po odstránení stropu počtu zlyhá 6 zo 650 asercií Newmana — a dve
extrémne pôžičky stále odmieta produktová kontrola; po odstránení
oboch kontrol zlyhá 12 a nahlásená pôžička sa znova prijme.
Po odstránení klientského stropu TC-E2E-075 zlyhá v oboch viewportoch.
Keď je všetko zapnuté: 650 zo 650 a 16 zo 16.
**→ Pravidlo R14.**

<a id="bug-019--oversized-json-is-reported-as-an-internal-server-failure--medium--closed"></a>

### BUG-019 · Príliš veľký JSON sa hlásil ako interné zlyhanie servera · Stredná · CLOSED

| | |
|---|---|
| Nájdené v | S21, izolovaná HTTP validačná sonda |
| Komponent | `src/server.js` — parsovanie JSON a globálny handler chýb |

**Kroky reprodukcie:** odošlite na lokálny testovací server syntakticky platný JSON výdavok
s poznámkou dlhou 110000 znakov ASCII cez POST.
**Očakávané:** riadená odpoveď o príliš veľkom tele požiadavky (413), nie INTERNAL.
**Skutočnosť:** 500 s error.code INTERNAL; body-parser hlási entity.too.large.
**Príčina:** entity.parse.failed sa spracúva, entity.too.large nie, takže predvolená cesta
500 nahrádza stav klientskej chyby z parsera.
**Oprava:** S23, necommitnuté. `src/server.js` mapuje `entity.too.large` na 413
`PAYLOAD_TOO_LARGE` v jedinom rendereri chýb, takže telo sa nikdy nedostane
do logu UNHANDLED. Globálny limit parsera je nezmenený; trasa návrhu AI
sama odmieta telá nad 8 KiB (400).
**Regresia:** Newman `POST /transactions with a body over the parser limit →
413, not 500 (BUG-019)`; pytest `test_ai_draft_with_the_feature_off_and_an_oversized_body`.
Oba kontrolujú stav a kód; pomocný nástroj Newman navyše kontroluje „never a 500“.
**→ Pravidlo R14.**

<a id="bug-020--valid-early-year-dates-produce-malformed-next-dates--medium--in-progress"></a>

### BUG-020 · Platné dátumy zo skorých rokov vytvárali chybné nasledujúce dátumy · Stredná · IN PROGRESS

| | |
|---|---|
| Zistené pri | S21, hraničné kontroly čistých dátumových pomocných funkcií |
| Komponent | `src/dates.js` — clampToMonth / dayAfter / nextDue |

**Kroky na reprodukciu:** zavolajte isValidDate('0001-01-31'), dayAfter
pre tento dátum a nextDue(15, '0001-01-31').
**Očakávanie:** prijaté dátumy zachovajú YYYY-MM-DD; nasledujúci termín
nie je pred vstupným dátumom.
**Skutočnosť pred opravou:** true, '1-02-01', '1-01-15' v tomto poradí.
Posledný dátum je skorší. Na opačnom okraji sa `9999-12-31`
mohol zmeniť na `10000-01-01`. Tá istá chyba umožnila
pri POST/PATCH plánovanej platby vrátiť úspech a uložiť riadok,
ktorého vypočítaný ďalší termín bol mimo deklarovanej štvorcifernej oblasti.
**Príčina:** parsovaný číselný rok sa vložil bez doplnenia na štyri
cifry; lexikografické porovnávanie tak stratilo záruku pevnej
šírky dátumu. Aritmetika pred zápisom plánovanej platby tiež
neodmietala prekročenie hornej hranice.
**Oprava:** lokálna a necommitovaná. Čisté pomocné funkcie zachovávajú
štvorciferné roky0000–9999 a pri neexistujúcom nástupcovi vyhodia
kódovanú chybu rozsahu. Vytvorenie/úprava plánovanej platby
overí vypočítaný ďalší termín pred zápisom; starší hraničný
riadok pri výpise spôsobí kontrolovanú 400. Žiadny uložený
riadok sa nemigruje ani nemaže.
**Regresia:** počiatočné kontroly čistých funkcií 1/3,
konečné 4/4; skutočná dočasná HTTP kontrola zlyhala pred
opravou pri POST/PATCH/GET a po nej prešla. Celý kontrakt
15/15, 340 validovaných odpovedí.
[Podrobnosti](../qa/docs/test-report-date-boundaries.md).
Samostatná historická matica 2020–2032: 147219 kontrol,
0 nesúladov. Táto matica nemôže potvrdiť roky mimo svojho rozsahu.
**→ Pravidlo R14.**

<a id="bug-021--schedules-cannot-be-edited-through-the-interface--high--in-progress"></a>

### BUG-021 · Plánované platby sa nedali upravovať cez rozhranie · Vysoká · IN PROGRESS

| | |
|---|---|
| Zistené pri | S21, porovnanie špecifikácie s UI a živá kontrola obrazovky plánovaných platieb |
| Komponent | `public/app.js` loadSchedules / submitSchedule; `public/index.html` |

Nižšie uvedené kroky, očakávanie/skutočnosť a „Oprava:
neaplikovaná“ zachovávajú pôvodné pozorovanie S21 pred opravou;
potom nasleduje datovaná aktualizácia.

**Kroky na reprodukciu:** vytvorte plánovanú platbu, otvorte
obrazovku plánovaných platieb a skúste cez UI zmeniť jej názov,
sumu alebo deň splatnosti.
**Očakávanie:** vytvorenie alebo úprava cez formulár,
ako vyžaduje spec §6.4.
**Skutočnosť:** riadky zoznamu nie sú interaktívne;
formulár iba vytvára. V kontrole obsahovali 2 riadky
plánovaných platieb 0 tlačidiel/odkazov/vstupov/prvkov
s role=button.
**Príčina:** API má PATCH, no riadky plánovaných platieb
nemajú prepojený stav úprav v UI ani handler aktualizácie.
Samotný endpoint požiadavku §6.4 nespĺňa.
**Oprava:** neaplikovaná. Doplňte chýbajúce UI alebo získajte
výslovné rozhodnutie o rozsahu; neprepisujte špecifikáciu,
aby aktuálny kód vyzeral úplný.
**Regresia:** potvrdené zo zdroja aj v prehliadači;
pridajte skutočný test úpravy plánovanej platby cez UI.
**→ Pravidlo R14.**

**Lokálny dodatok, 2026-10-17:** pôvodné pozorovanie a starší
odkaz na §6.4 vyššie zostávajú historické. Kontrolovaný
prehliadačový test najprv zlyhal na chýbajúcej akcii Edit.
Lokálna oprava UI teraz ponúka natívne modálne okno pre vlastný
riadok a používa existujúci PATCH endpoint. Jej prvý širší
beh odhalil novú implementačnú chybu chýbajúceho HTML-`id`;
diagnostikovala sa zo zachovaného trace chyby stránky a opravila.
Konečná [lokálna správa F09](../qa/docs/test-report-schedule-editing.md)
zaznamenáva kontroly pretrvania polí/životného cyklu
a klávesnice spolu s celým riadeným prehliadačovým behom.
Nezávislá lokálna kontrola agenta prijala F09 dňa
2026-10-17. Stav je **IN PROGRESS**, nie CLOSED: zostáva
overenie kombinovaného stromu, vzdialené CI na presnom SHA,
publikovanie a UAT vlastníka. Táto kontrola nezistila ďalší
známy defekt úprav plánovaných platieb.

<a id="bug-022--expense-overlay-does-not-contain-keyboard-focus--medium--in-progress"></a>

### BUG-022 · Vizuálny editor výdavkov neudržiaval fokus klávesnice · Stredná · IN PROGRESS

| | |
|---|---|
| Zistené pri | S21, kontrola klávesnice a sémantiky v Chromium |
| Komponent | `public/index.html` #tx-edit-sheet; `public/app.js` handlery editora |

**Kroky na reprodukciu:** otvorte editor výdavku, stlačte Escape,
potom zamerajte Cancel a stlačte Tab.
**Očakávanie:** prístupný modálny editor udržiava fokus
vo svojich ovládacích prvkoch, má jasnú akciu zatvorenia
a po zatvorení obnoví fokus.
**Skutočnosť:** Escape ho nechá otvorený; Tab prejde
na nav-add mimo panela. Panel nemá rolu dialógu
ani atribút aria-modal.
**Príčina:** vizuálna vrstva nemá sémantiku modálneho okna,
udržanie fokusu ani handler Escape.
**Oprava:** neaplikovaná. Doplňte vhodný vzor dialógu
a správanie klávesnice.
**Regresia:** reprodukované v prehliadači; doplňte sémantické
a klávesnicové regresie.
**→ Pravidlo R14.**

**Lokálna aktualizácia 2026-10-16 (pôvodné pozorovanie zachované):**
editor je teraz pomenované natívne modálne okno s výslovným
cyklom Tab medzi prvým a posledným prvkom, upozornením
na chybu vo vnútri dialógu a overeným obnovením fokusu
po Escape/Cancel/kliknutí mimo. Cielené lokálne prehliadačové
a axe dôkazy sú v [správe o modálnom okne/bind](../qa/docs/test-report-modal-bind.md).
Nezávislá lokálna kontrola kódu/dôkazov agentom prijala opravu
modálneho okna dňa 2026-10-16. BUG-022 je **IN PROGRESS**
do publikovania a overenia kombinovaného stromu, nie preto,
že by bolo známe ďalšie zlyhanie fokusu. Táto datovaná
aktualizácia nahrádza ukazovateľ stavu OPEN z 2026-10-13
nižšie; starší riadok „Oprava: neaplikovaná“ zaznamenáva
pôvodné pozorovanie, nie aktuálny stav zdroja.
Nevyvodzuje sa ľudský audit prístupnosti, UAT vlastníka,
vzdialené CI ani vydanie.

<a id="bug-023--registration-race-violation-was-ignored-by-final-verdict--high--in-progress"></a>

### BUG-023 · Porušenie pri súbežnej registrácii sa ignorovalo v konečnom verdikte · Vysoká · IN PROGRESS

| Zistené pri | 2026-10-09, negatívna kontrola race runnera v pamäti |
| Komponent | `qa/race/run.js` |

**Kroky na reprodukciu:** nastavte, aby iba scenár E dostal
201 a 500; spustite skutočnú orchestráciu runnera
so syntetickými klientmi v pamäti.
**Očakávanie:** zaznamenané porušenie E spôsobí nenulový
návratový kód príkazu.
**Skutočnosť pred opravou:** E zaznamenalo jedno porušenie,
ale konečný súčet E vynechal, vypísal úspech a skončil s 0.
**Príčina:** druhý ručne zapísaný súčet nezodpovedal správe scenárov.
**Oprava:** lokálna a necommitovaná; jediný register teraz
riadi správu aj vynucovaný verdikt, overuje dôkazy dvojíc
a výslovne označuje D len ako meranie.
**Regresia:** zlyhanie iba E končí s 1; každé iné vynucované
zlyhanie končí s 1; úspešné vynucované prípady
s duplicitami D končia s 0; prešlo 23/23 kontrol validátora.
**→ Bez pravidla — jednorazový prípad.**

<a id="bug-024--required-validator-inputs-could-disappear-with-a-green-result--high--in-progress"></a>

### BUG-024 · Povinné vstupy validátora mohli zmiznúť pri zelenom výsledku · Vysoká · IN PROGRESS

| Zistené pri | 2026-10-09, negatívna kontrola súborového systému v pamäti |
| Komponent | `scripts/check.js`, `scripts/coverage-gates.js` |

**Kroky na reprodukciu:** zneprístupnite `spec/architecture.md`
skutočným kontrolným funkciám bez zmeny reálneho súboru.
**Očakávanie:** chýbajúce povinné vstupy architektúry/hashu/
zdroja/UI/E2E/kolekcie/objektu stránky spôsobia zlyhanie
samokontroly.
**Skutočnosť pred opravou:** C1 SKIP, potom
`OK — 7 pass, 1 skip, 0 fail`, kód 0.
Prázdne inventáre zdroja/UI tiež prešli nulovým počtom iterácií.
**Príčina:** vetvy SKIP z obdobia vytvárania kostry projektu
a prázdne cykly kolekcií.
**Oprava:** lokálna a necommitovaná; všetky stanovené povinné
vstupy a neprázdne inventáre pri neprítomnosti zlyhávajú.
Pri kontrolách sa neodstránil žiadny produkčný súbor.
**Regresia:** cielené kontroly chýbajúcich/prázdnych vstupov
prešli; bežná kontrola má 8 pass, 0 skip, 0 fail;
inventár zdroja OpenAPI je 21/21.
**→ Bez pravidla — jednorazový prípad.**

<a id="bug-025--race-cleanup-could-remove-another-runs-database--medium--in-progress"></a>

### BUG-025 · Čistenie race mohlo odstrániť databázu iného behu · Stredná · IN PROGRESS

| Zistené pri | 2026-10-09, kontrola sentinelového súboru iného behu v pamäti |
| Komponent | `qa/race/run.js` |

**Kroky na reprodukciu:** vystavte súbor `race-*` iného behu
starému mechanizmu čistenia runnera. Nepoužívajte pri tejto
kontrole skutočnú používateľskú ani aplikačnú databázu.
**Očakávanie:** smie sa odstrániť iba vlastný dočasný
adresár aktuálneho behu.
**Skutočnosť pred opravou:** čistenie podľa prefixu
sa pokúsilo odstrániť sentinel.
**Príčina:** čistenie vyberalo všetky zodpovedajúce názvy
v `data/`, nie vlastnú cestu.
**Oprava:** lokálna a necommitovaná; vytvorte jedinečný
kanonický adresár, overte jeho rodiča a názov a odstráňte
iba tento adresár po skončení oboch podprocesov.
Ak zlyhá ukončenie alebo čistenie, adresár ponechajte
a vráťte zlyhanie.
**Regresia:** sentinel v pamäti zostal nedotknutý;
skutočný sentinel dočasnej fixture zostal nedotknutý;
jeden skutočný beh so 120 dvojicami na scenár prešiel
a odstránil vlastný adresár.
**→ Bez pravidla — jednorazový prípad.**
<a id="bug-026--unsafe-pagination-and-ids-bypassed-validation--high--in-progress"></a>

### BUG-026 · Nebezpečné hodnoty stránkovania a ID obišli validáciu · Vysoká · IN PROGRESS

| Zistené pri | 2026-10-09, skutočná dočasná kontrola HTTP kontraktu |
| Komponent | `src/validate.js`; trasy transakcií/kategórií |

**Kroky na reprodukciu:** autentifikované GET
`/api/transactions?offset=1e30`, potom skúste offset
a vlastné ID väčšie než `Number.MAX_SAFE_INTEGER`.
**Očakávanie:** nebezpečné celé čísla a zlyhania konverzie
vrátia 400 `VALIDATION_FAILED`; bezpečné, ale neexistujúce
vlastné ID zostanú 404.
**Skutočnosť pred opravou:** `offset=1e30` vrátilo 500;
`9007199254740992` vrátilo 200 ako offset a 404 ako vlastné ID.
Objekt kategórie s nevolateľným `toString` vrátil 500.
Neplatný zápis nezmenil účtovnú knihu.
**Príčina:** `Number.isInteger` prijíma nebezpečné veľkosti
a `Number(raw)` môže vyhodiť chybu na JSON objekte ovládanom klientom.
**Oprava:** lokálna a necommitovaná; spoločné parsery vyžadujú
bezpečné celé čísla a zlyhanú konverziu mapujú na 400
pre konkrétne pole, pričom zachovávajú strop limitu.
**Regresia:** cielené kontroly pred opravou 0/2, po nej 2/2;
celý kontrakt 14/14 a 335 validovaných odpovedí;
bezpečné maximum offsetu a kompatibilné konverzie kategórie
s kľúčom stále prechádzajú.
[Podrobnosti](../qa/docs/test-report-api-validation.md).
**→ Bez pravidla — jednorazový prípad.**

<a id="bug-027--non-convertible-noteicon-json-returned-internal-errors--high--in-progress"></a>

### BUG-027 · Nekonvertovateľný JSON poznámky/ikony vracal interné chyby · Vysoká · IN PROGRESS

| Zistené pri | 2026-10-09, skutočná dočasná kontrola HTTP kontraktu |
| Komponent | `src/validate.js`; trasy transakcií/kategórií |

**Kroky na reprodukciu:** pošlite `{ "toString": null }`
alebo pole, ktoré ho obsahuje, ako poznámku výdavku
(POST bez kľúča, POST s kľúčom, PATCH) alebo ikonu kategórie.
**Očakávanie:** 400 `VALIDATION_FAILED`, bez zápisu
či rezervácie kľúča.
**Skutočnosť pred opravou:** všetkých osem testovaných
požiadaviek vrátilo 500. Číselné, boolean, bežné objektové/
poľové, null a reťazcové hodnoty sa naďalej konvertovali správne.
**Príčina:** priame `String(value)` mohlo zlyhať pre hodnotu
JSON, ktorej metódu konverzie zatienil vstup klienta.
**Oprava:** lokálna a necommitovaná; jeden validátor
nullable textu zachytáva iba zlyhanú konverziu, používa
sa pri kanonizácii s kľúčom aj pri uložení bez zmeny
prijímaného tvaru payloadu/hasha.
**Regresia:** osem neplatných odpovedí je teraz 400;
prijímané skupiny typov, opakovanie s kľúčom a kanonická
ekvivalencia null/vynechanej hodnoty prechádzajú.
Celý kontrakt 14/14, 335 validovaných odpovedí.
[Podrobnosti](../qa/docs/test-report-api-validation.md).
**→ Bez pravidla — jednorazový prípad.**

<a id="bug-028--concurrent-evaluator-setup-can-abort-before-quota-exercise--high--in-progress"></a>

### BUG-028 · Súbežné nastavenie evaluátora sa mohlo prerušiť pred kontrolou kvóty · Vysoká · IN PROGRESS

| Zistené pri | 2026-10-10, synchronizovaná kontrola skopírovaného evaluátora |
| Komponent | `qa/ai/evaluate.js`, továreň na syntetického používateľa |

**Kroky na reprodukciu:** spustite tri chránené podprocesy
evaluátora nad jednou dočasnou databázou, synchronizované
pred prvým vyhľadaním alebo vytvorením toho istého syntetického e-mailu.
**Očakávanie:** jeden úplne inicializovaný používateľ
a sada kategórií; všetky podprocesy dosiahnu prácu
s poskytovateľom/kvótou bez chyby nastavenia.
**Skutočnosť pred opravou:** dva podprocesy hlásili
`UNIQUE constraint failed: users.email` pred odoslaním
poskytovateľovi. Samostatne vložené zlyhanie po vytvorení
základu zanechalo jedného používateľa a desať kategórií.
**Príčina:** vyhľadanie, vloženie a inicializácia kategórií
neboli uzavreté v jednej medziprocesovej transakcii.
**Oprava:** lokálna a necommitovaná; synchrónna okamžitá
transakcia pokrýva vyhľadanie až po čítanie kategórií
a cache dostane iba commitnutú identitu. Práca
s poskytovateľom zostáva mimo nej.
**Regresia:** prešli štyri nové kontroly súbehu/správ;
dotknuté testy 25/25 a celá offline AI sada 240,
jedno preskočenie pre oprávnenia vo Windows.
Tvrdenia o priebežnej kvóte W9 sa nemenia a prerušený
podproces má teraz samostatnú diagnostiku. Dokazuje to
mechanizmus súbehu, nie príčinu skoršieho zlyhania
W9 v celej sade.
**→ Bez pravidla — jednorazový prípad.** [Podrobnosti](../qa/docs/test-report-evaluator-concurrency.md).

<a id="bug-029--concurrent-evaluator-reports-can-overwrite-each-other--high--in-progress"></a>

### BUG-029 · Súbežné správy evaluátora sa mohli navzájom prepísať · Vysoká · IN PROGRESS

| Zistené pri | 2026-10-10, kontrola skopírovaného evaluátora s pevným časom |
| Komponent | `qa/ai/evaluate.js`, zapisovač správ |

**Kroky na reprodukciu:** spustite dvoch evaluátorov súbežne
s rovnakou časovou značkou štartu a skontrolujte ich vypísané
cesty k správam JSON/Markdown.
**Očakávanie:** každý beh zachová vlastný úplný pár správ;
pomocný pohľad latest označuje jednu dokončenú správu.
**Skutočnosť pred opravou:** oba behy vypísali rovnakú cestu,
takže neskorší zápis mohol nahradiť skorší dôkaz.
**Príčina:** základ názvu obsahoval iba režim a čas štartu
v milisekundách; zápisy nahrádzali existujúce súbory.
**Oprava:** lokálna a necommitovaná; pridajte náhodnú
identitu behu, publikujte dokončené dočasné súbory
do výlučných finálnych názvov a v pohľade latest
pomenujte dokončenú správu, ktorú zobrazuje.
Zlyhanie zápisu páru čistí iba vlastné súbory
a nehlási úspech.
**Regresia:** behy s pevným časom zachovali odlišné
páry JSON/Markdown; vložené zlyhanie druhého súboru
nezanechalo čiastočný pár ani riadok úspechu.
Publikovanie dvoch súborov nie je atómová transakcia
a latest znamená posledného dokončeného zapisujúceho,
nie najneskorší štart.
**→ Bez pravidla — jednorazový prípad.** [Podrobnosti](../qa/docs/test-report-evaluator-concurrency.md).

<a id="bug-030--stale-or-redundant-static-gate-exceptions-passed-c9--medium--in-progress"></a>

### BUG-030 · Zastarané alebo nadbytočné výnimky statickej brány prechádzali C9 · Stredná · IN PROGRESS

| Zistené pri | 2026-10-10, negatívne kontroly výnimiek v pamäti |
| Komponent | `scripts/coverage-gates.js`, `scripts/check-exceptions.json` |

**Kroky na reprodukciu:** pridajte vierohodne vyzerajúcu
výnimku trasy C6, testid C7 alebo stavu C8, ktorá
v aktuálnom inventári chýba; pridajte už vyriešenú
alebo duplicitnú položku; skúste neplatný tvar položky.
**Očakávanie:** C9 zlyhá s konkrétnou diagnostikou
zastaranej, nadbytočnej, duplicitnej alebo neplatnej
položky; nedostupné povinné inventáre zlyhajú
bez falošného tvrdenia o zastaraní.
**Skutočnosť pred opravou:** C9 kontrolovalo iba dĺžku
zdôvodnenia. Počiatočná kontrola mala 23 úspešných
a 6 neúspešných; chybný formát údajov mohol vyhodiť
výnimku mimo zamýšľaného verdiktu brány.
**Oprava:** lokálna a necommitovaná; C9 používa
rovnaké aktuálne inventáre ako C6–C8, validuje
tvar/zdôvodnenie/identitu a zabraňuje chybným
položkám zhodiť ostatné brány.
**Regresia:** konečné nezávislé lokálne `test:gates` 31/31
a `check` 8/8; pôvodné hashe vstupov sa kontrolami
v pamäti nezmenili. Jedna aktuálna výnimka `500`
zostáva výslovnou nevykonanou statickou medzerou,
nie výnimkou pre runtime.
**→ Bez pravidla — jednorazový prípad.** [Podrobnosti](../qa/docs/test-report-static-gates.md).
<a id="bug-031--static-inventory-gate-wording-overstated-runtime-coverage--medium--in-progress"></a>

### BUG-031 · Znenie brány statického inventára nadhodnocovalo runtime pokrytie · Stredná · IN PROGRESS

| Zistené pri | 2026-10-10, porovnanie znenia brány s maticou skutočných odpovedí |
| Komponent | `scripts/check.js`, `scripts/coverage-gates.js`, dokumentácia QA |

**Problém:** C6–C8 prehľadávajú zdrojový kód a text testov.
Ich pôvodné názvy a správy sa dali čítať ako dôkaz,
že požiadavka sa vykonala, selektor fungoval na vykreslenej
stránke alebo sa vyvolala každá vetva operácie/stavu.
Najmä C8 vyhľadáva tvrdenia o stavoch globálne.
**Očakávanie:** kontroly statických deklarácií a dôkazy
skutočného vykonania sú pomenované osobitne.
**Oprava:** lokálna a necommitovaná; názvy brán, diagnostika
a aktuálna dokumentácia teraz uvádzajú STATIC. Matica
pozorovaných kontraktných operácií/stavov zachováva bunky
NOT EXERCISED; z týchto brán sa nevyvodzuje behaviorálne pokrytie.
**Overenie:** nezávislá lokálna kontrola `check` 8/8
a kontraktné testy 15/15 s 340 validovanými skutočnými
odpoveďami HTTP. To neznamená, že sa vykonali všetky bunky matice.
**→ Bez pravidla — jednorazový prípad.** [Podrobnosti](../qa/docs/test-report-static-gates.md).

<a id="bug-032--ci-and-local-verification-diverged-apipython-reports-were-not-retained--medium--in-progress"></a>

### BUG-032 · CI a lokálne overenie sa líšili; správy API/Python sa neuchovávali · Stredná · IN PROGRESS

| Zistené pri | 2026-10-10, porovnanie zdroja workflow, skriptov balíka a tvorcov správ |
| Komponent | Workflow CI, overovacie príkazy a uchovávanie dôkazov QA |

**Problém:** publikované východiskové CI vynechalo vrstvu
testov súbehu, zatiaľ čo `npm test` vynechával niekoľko
CI sád. Skoršia lokálna úprava súbeh pridala, no žiadny
spoločný plán neudržiaval lokálne a CI skupiny zosúladené.
Newman HTML/JUnit a Python JUnit vznikali bez krokov
nahrania v CI.
**Očakávanie:** výslovný plán zodpovedajúci CI, s povinnými
predpokladmi zlyhávajúcimi pri absencii a uchovanými
povolenými správami pri úspechu aj zlyhaní.
**Oprava:** lokálna a necommitovaná; spoločný inventár
šiestich skupín/18 úloh, runner ukončujúci pri prvom
zlyhaní so stavmi `NOT_RUN` a ignorovaný stručný
identifikačný súhrn, plus kroky upload v4 pre pripravené
dôkazy API/Python/súbehu. Existujúce trace zlyhaní
prehliadača a sedemdňové uchovávanie zostávajú.
**Overenie:** deväť cielených kontrol prešlo.
Izolovaná skupina API prešla 10/10 úloh;
Python 27/27 položiek. Predvolený lokálny plán
zlyhal na chýbajúcom `gitleaks` a správne nechal
17 úloh v stave `NOT_RUN`. Celé lokálne/vzdialené
CI a skutočné nahrávanie sa **neoverili**.
**Dodatok kontroly:** skoršia sada deviatich kontrol
mohla nesprávne prijať chybnú závislosť E2E podľa
nasledujúcej úlohy a nesprávne odmietnuť ekvivalentné
workflow s CRLF. Prvé regresie používajúce rovnaký
helper ukázali 9 úspechov / 2 zlyhania; ohraničená
kontrola úloh teraz prechádza 12/12 vrátane nesprávnej
hrany, CRLF a nepodporovanej formy. Skutočný workflow
bol už správny; reálne skupiny sa nespúšťali znova.
Sledované odstránenia môžu zlyhať pri identifikácii
ešte pred súhrnom, podprocesy nemajú limit wrappera,
proveniencia platí len pre vyvolanie, lokálne príznaky
CI sa môžu líšiť a kontrola súkromia zostáva heuristická.
Táto lokálna oprava nedokazuje vzdialené nahratie
artefaktov ani neuzatvára zistenie IN PROGRESS.
**Následná kontrola fixture s koncami riadkov:**
úplný virtuálny pohľad CRLF len na čítanie odhalil
dve mutačné fixture závislé od LF ešte pred vyvolaním
helpera (10 úspechov / 2 zlyhania). Teraz pred mutáciou
normalizujú a vykonávajú formy LF aj CRLF bez zmeny workflow.
Vybrané konečné kontroly prechádzajú 12/12 pri skutočnom LF
a 12/12 pri virtuálnom CRLF; negatívne kontroly nesprávnej
závislosti a nejednoznačnej formy zostávajú vynútené.
Žiadna reálna skupina ani vzdialené CI sa nespúšťali znova,
takže zistenie zostáva IN PROGRESS.
**→ Bez pravidla — jednorazový prípad.** [Podrobnosti](../qa/docs/test-report-ci-verification.md).

<a id="bug-033--main-e2e-reused-one-database-between-runs-and-ignored-db_path--medium--in-progress"></a>

### BUG-033 · Hlavné E2E opakovane používalo jednu databázu a ignorovalo DB_PATH · Stredná · IN PROGRESS

| Zistené pri | 2026-10-11, hlavná konfigurácia Playwright a cielená negatívna kontrola |
| Komponent | `playwright.config.js`, riadený runner hlavného E2E |

**Problém:** predošlá konfigurácia vždy volila `data/e2e.db`
bez ohľadu na `DB_PATH` poskytnuté volajúcim, preto
opakované spustenia sady používali trvalú databázu.
Netvrdí sa tu pozorované 429, nameraný rast ani strata údajov.
**Očakávanie:** nová predvolená databáza pri každom hlavnom
E2E behu a bezpečná výslovná výnimka; čistenie až
po skončení vlastného servera.
**Oprava:** lokálna a necommitovaná. Nadradený runner mimo
prehliadačových špecifikácií vlastní oba podprocesy
aj jedinečný dočasný adresár, odmieta existujúce/chránené
cesty výnimiek a externé ciele a odstráni iba vlastný
predvolený adresár po potvrdenom skončení podprocesov.
Nové výslovne určené súbory zostávajú volajúcemu.
Aplikácia ani tvrdenia prehliadačových špecifikácií sa nemenili.
**Regresia:** počiatočných 0/5 zahŕňalo jedno skutočné zlyhanie
pevnej cesty a štyri zlyhania chýbajúceho harnessu runnera;
po prvej implementácii 4/5 so starým zapojením.
Konečné cielené kontroly Node 24/24 a statická kontrola
8/8 po štruktúrnom presune a skutočnej kontrole
zachovanej výnimky. Jeden celý lokálny hlavný E2E beh
prešiel 192/192 na telefóne a desktope, s potvrdeným
skončením servera a vyčistením vlastného predvoleného
adresára; dĺžka/mtime starej DB sa nezmenili
a DB aplikácie zostala neprítomná. Vzdialené CI sa zatiaľ
netvrdí. Nútené ukončenie nadradeného procesu môže
zanechať dočasné údaje; predvolene sa nepodporujú
paralelné príkazy s pevným portom.
[Podrobnosti](../qa/docs/test-report-e2e-isolation.md).
**→ Bez pravidla — jednorazový prípad.**

**Dodatok BUG-033 o sprievodných súboroch, 2026-10-11:**
prvá ochrana výslovnej cesty odmietala *názvy* sprievodných
súborov ako `DB_PATH`, ale prijímala novú základnú cestu
vedľa existujúceho `-wal`, `-shm` alebo `-journal`.
Dočasné kontroly reprodukovali všetky tri prípady
bez otvorenia SQLite. Kontrola zlyhávajúca pred opravou
odhalila `-wal`; lokálna oprava teraz odmieta všetky tri
cez `lstat` pred `wx`, bez spustenia základného súboru
či podprocesu a so zachovanými bajtmi/identitou
sentinela sprievodného súboru. Dotknuté kontroly:
26 úspechov, 1 voliteľná fixture visiaceho symlinku
preskočená pre oprávnenia Windows, 0 zlyhaní;
statická kontrola 8/8. Skorší úplný výsledok
prehliadača 192/192 bol **pred** touto ochranou,
nie beh najnovšieho stromu. Súbežné vytvorenie
sprievodného súboru po predbežnej kontrole zostáva
limitom TOCTOU; vzdialené CI stále nie je overené.

<a id="bug-034--declared-node-floor-could-load-an-incompatible-native-binding--high--in-progress"></a>

### BUG-034 · Deklarované minimum Node mohlo načítať nekompatibilný natívny binding · Vysoká · IN PROGRESS

| Zistené pri | Kontroly kompatibility runtime z 2026-10-11 |
| Komponent | engine balíka, minimálna verzia Node v CI, štart databázy |

**Problém:** `>=22` pripúšťalo Node 22.9, zatiaľ čo
nainštalovaný binding SQLite vyžaduje Node-API 10,
prvýkrát dostupné v rade 22 od 22.14. Pozorovaný
natívny pád je v súlade s týmto nesúladom;
presná príčina natívneho zlyhania sa neizolovala.
**Očakávanie:** pravdivé metadáta a minimálna verzia CI,
plus jasná chyba pred načítaním natívneho bindingu
alebo vytvorením dátového adresára na nepodporovanom runtime.
**Oprava:** lokálna a necommitovaná; koreň balíka
a lockfile používajú `^22.14.0 || >=23.6.0`,
CI pripína 22.14.0 a štart databázy najprv volá
ochranu stabilnej verzie/Node-API používajúcu iba
vstavané funkcie.
**Regresia:** cielené [kontroly runtime](../qa/docs/test-report-runtime.md)
zlyhali pred opravou a pokrývajú hranice verzie/API,
zapojenie workflow a poradie importov podprocesu.
Presné konečné lokálne výsledky sú v správe.
Celé vzdialené CI a kompatibilita budúcich verzií
zostávajú neoverené.
**→ Bez pravidla — jednorazový prípad.**
<a id="trace-audit-001--public-semantic-traceability-drift--in-progress"></a>

### TRACE-AUDIT-001 · Sémantický nesúlad vo verejnej sledovateľnosti · IN PROGRESS

| Zistené pri | 2026-10-12, inventúra F13 len na čítanie a ohraničená lokálna oprava |
| Komponent | Verejné architektonické odkazy, katalóg prípadov, kotvy pravidiel funkcií a tabuľka rizík AI |

**Pozorovanie:** katalóg s 280 riadkami používal vyradené čísla
architektonických ustanovení a niektoré odkazy na riziká AI
smerovali na skutočné ID s odlišným významom. Samotná existencia
ID nedokazovala sémantickú sledovateľnosť. Analýza syntetického
importu zostáva výslovne predbežná.

**Lokálna oprava:** migračný index verejných základných pravidiel,
stabilné kotvy v existujúcich zdrojoch pravidiel funkcií, opravené
odkazy katalógu a plánu AI a samostatný statický kontrolný nástroj
pre identitu/odkazy používajúci iba vstavané funkcie a negatívne
kontroly. Dve autorizované architektonické úpravy a súvisiace
SHA sú preskúmané v [správe F13](../qa/docs/test-report-traceability.md).
Žiadny historický výsledok prípadu sa nespustil ani nezmenil.

**Overenie:** lokálny Node 22.14.0: 17/17 nových statických
kontrol, 280 ID prípadov / 78 definícií pravidiel v samostatnom
kontrolnom nástroji a existujúci `scripts/check.js` 8/8.
Statická identita nedokazuje význam prípadu, vykonané pokrytie,
prijatie vlastníkom ani nový výsledok CI. Nezávislá kontrola main/
Critic a publikovanie zostávajú otvorené. **Neoznačovať ako FIXED**
na základe tohto lokálneho výsledku.

**Dodatok nezávislej kontroly ORD-087, 2026-10-12 — IN PROGRESS:**
kontrola ORD-086 odmietla lokálne prijatie F13 pre štyri
sémanticky nesprávne odkazy na mesačný limit (TC-API-096–099)
a parser definícií zdroja, ktorý prijal navyše ukotvené CORE-999.
Štyri odkazy teraz smerujú na REQ-ML-05. Kontrola CORE-999
v pamäti zlyhala pred opravou parsera (17 úspechov /
1 zlyhanie); pridali sa ohraničené kontroly rodiny zdrojov,
LF/CRLF a nesprávnej rodiny bez povýšenia opakovaných odkazov
na definície. Najnovšie cielené výsledky a hashe artefaktov
sú v [správe F13](../qa/docs/test-report-traceability.md).
Tento dodatok nemení historické stavy, nedokazuje správanie
pri behu ani neuzatvára audit; nezávislá následná kontrola
a publikovanie zostávajú otvorené.

<!-- F20-F21 status addendum begin -->
<a id="f20f21-status-correction--2026-10-13"></a>

### Oprava stavu F20/F21 — 2026-10-13

Toto je doplňujúca poznámka o aktuálnom stave, **nie** prepis
pôvodných pozorovaní alebo zaznamenaných výsledkov vyššie.
Bunky a odseky opravy `S23 · uncommitted` pre BUG-014/019
opisujú čas ich zápisu. Lokálna história Gitu umiestňuje
obe opravy do koreňa pripraveného na publikovanie `2face59`:
CSS pre krátky telefón je v `public/style.css` a `src/server.js`
mapuje `entity.too.large` na 413. Zdroj prístupnosti/
Escape/obnovy fokusu a zapojenie workflow CI sú v neskoršom
lokálnom commitnutom HEAD `b270355`; ani jeden commit
neposkytuje nový úplný výsledok vzdialeného CI pre
**aktuálne necommitovaný kombinovaný strom**.

BUG-022 zostáva **OPEN**: zatvorenie cez Escape a obnova fokusu
už majú ohraničené lokálne prehliadačové kontroly
v [datovanej východiskovej správe o prístupnosti](../qa/docs/accessibility-baseline.md),
ale úplná regresia udržania fokusu/sémantiky modálneho okna
a kontrola vlastníkom nie sú doložené. BUG-021 zostáva
**High/OPEN** a blokuje vydanie bez zaznamenanej výnimky vlastníka;
iné zistenia High označené IN PROGRESS sa lokálnymi opravami
automaticky neuzatvárajú. BUG-005 zostáva Low/OPEN
s neznámou príčinou. Cielený opakovaný test pripravenosti
neobjasnil príčinu skoršej neúspešnej kontroly;
pozrite [správu o runtime](../qa/docs/test-report-runtime.md).
Regresia vývojára, vydanie a brány UAT sú oddelené
v [testovacom pláne](../qa/docs/test-plan.md).
[Index aktuálneho stavu](../docs/qa-status.md) odlišuje
lokálny dôkaz, historické publikovanie a čakajúce prijatie.
Táto poznámka nemení žiadny stav v pôvodnom registri.
<!-- F20-F21 status addendum end -->

<a id="f22-retrybusy-assurance-addendum--2026-10-13"></a>

### Dodatok o opakovaní/zaneprázdnení F22 — 2026-10-13

[Cielená lokálna správa](../qa/docs/test-report-retry-busy.md)
zaznamenáva necommitovaný test TC-E2E-045, ktorý zadrží
odpoveď na skutočný uložený POST, skúsi natívne druhé
kliknutie, kým je Save zaneprázdnené, a overí jednu
požiadavku, jeden uložený výdavok a jeden riadok Month.
Ohraničená mutácia odpovede prehliadača oboch ochrán
zaneprázdnenia spôsobí zlyhanie tvrdenia; súbor produktu
sa nemenil. TC-E2E-047 stále overuje, že zámerné druhé
Save vytvorí druhý riadok. Jedno opakovanie v CI slúži
iba na diagnostiku: beh úspešný iba pri opakovaní je flaky
a nenulový, s trace prvého zlyhania a novou identitou
dôkazu JSON. To nedokazuje príčinu BUG-005, všetky možné
zlyhania súbehu, nový výsledok vzdialeného CI,
prijatie vydania ani UAT vlastníka. Historické
pozorovania a stavy vyššie sa nemenia.

<a id="bug-035--offset-paging-can-duplicate-or-skip-expenses-after-another-clients-write--medium--in-progress"></a>

### BUG-035 · Offset stránkovanie mohlo po zápise iného klienta výdavky zdvojiť alebo preskočiť · Stredná · IN PROGRESS

**Zistené pri:** 2026-10-16, dočasné kontroly HTTP
a prehliadača v dvoch šírkach.
**Kroky:** načítajte prvú stránku výdavkov; vložte novší
riadok z druhého klienta a potom použite `offset=2`
na ďalšiu stránku. Pri samostatnom behu odstráňte
už videný riadok pred pokračovaním so starým offsetom.
**Očakávanie:** každý zostávajúci nevidený výdavok
sa zobrazí raz; zmenený živý súčet nevytvorí
nemožný počítadlový údaj v Month.
**Skutočnosť pred opravou:** vloženie cez HTTP zopakovalo
už videné hraničné ID; odstránenie cez HTTP preskočilo
nevidené zostávajúce ID. V prehliadači vloženie
vykreslilo 52 z 52 namiesto nového štartu,
kým po odstránení sa zobrazil vymazaný riadok
namiesto zostávajúceho nevideného. Dôkazy
na telefóne aj desktope zlyhali podľa očakávania.
**Príčina:** číselný offset sleduje posunutý aktuálny
zoznam, nie poslednú videnú pozíciu `(spent_on, id)`.
**Lokálna oprava:** voliteľný režim kurzora používa
parametrizovanú podmienku keyset s tokenmi viazanými
na účet/filter a prísne kontrolovanými. Starší
volajúci s offsetom si zachovávajú prijímanú odpoveď
a správanie. Month pokračuje kurzorom a pri zmene
živého súčtu raz reštartuje prvú stránku; nepolluje.
**Regresia:** cielené syntetické kontroly HTTP 2/2,
celý lokálny kontrakt 17/17, riadený prehliadač
stránkovania 8/8, úpravy 18/18 a cielený editor/a11y
4/4 po samostatnom opakovaní harnessu pri kolízii portu.
Nie je to nemenná snímka: úpravy meniace pozíciu
v triedení, externé zmeny s rovnakým celkovým počtom
a riadky v cache zostávajú obmedzeniami.
Nezávislá kontrola kódu/dôkazov agentom prijala
túto ohraničenú lokálnu opravu dňa 2026-10-16;
BUG-035 zostáva **IN PROGRESS** do overenia
kombinovaného stromu a publikovania, nie pre
ďalšie známe zlyhanie vloženia/odstránenia.
Nevyvodzuje sa ľudský audit, UAT vlastníka,
vzdialené CI ani vydanie.
[Analýza](../qa/docs/analysis-pagination-consistency.md) ·
[správa o behu](../qa/docs/test-report-pagination-consistency.md).

<a id="f06f10-local-recovery-and-request-lifecycle-addendum--2026-10-17"></a>

## Dodatok o lokálnej obnove F06/F10 a životnom cykle požiadavky — 2026-10-17

Ohraničená lokálna dávka reprodukovala tri prehliadačové
zlyhania pred opravou: skutočne commitnuté Save a Pay
stratili odpoveď prehliadača bez obnovy s rovnakým kľúčom
a staršia odpoveď Month nahradila novší súčet.
Serverová vetva Pay s kľúčom po výslovnom zapnutí,
bežné záznamy obnovy Save, vlastníctvo relácie/obrazovky
a konečný limit čítania tela odpovede teraz majú
cielené lokálne kontroly. Samostatná regresia vlastníctva
stavu zaneprázdnenia pri prechode z autentifikácie
do aplikácie, zistená počas dávky, bola opravená
a testovaná.
[Kontrakt a presné výsledky](../qa/docs/test-report-write-lifecycle.md).
Skorší riadený základný beh s 210 testami prešiel 204/210;
regresie odmietnutia Pay a navigácie pri štarte aplikácie
sa opravili v cielených kontrolách, kým pri jednom
zlyhaní krátko zobrazeného toastu sa príčina nezistila.
Neskorší beh s 218 testami prešiel 217/218,
pretože navigácia jednej desktopovej fixture
sa prerušila pred scenárom; ten potom prešiel
samostatne 2/2. Posledný samostatný úplný beh
prešiel 218/218 so štyrmi pracovníkmi.
Ohraničená nezávislá kontrola agenta prijala
F06 a F10 lokálne dňa 2026-10-17:
**23/25 (92% podľa počtu zistení)**.
Nemení to historické stavy BUG ani nedokazuje,
že skoršie zlyhania boli flaky. Overenie kombinovaného
stromu, vzdialené CI na presnom SHA, publikovanie
a UAT vlastníka zostávajú otvorené.
