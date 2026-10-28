[English](../../../../qa/docs/test-design.md) · **Slovenčina**

<a id="test-design--wallet"></a>

# Návrh testov · WALLET

[← Späť na README](../../README.md#qa-evidence) · [Ďalej: testovacie prípady →](test-cases.md)

**Ako sa zo zmeny vždy rovnakým postupom stane sada testov.**

Nie je to kontrolný zoznam dobrých úmyslov. Je to deväť krokov,
ktoré prijmú funkciu a vydajú zoznam prípadov. Dvaja ľudia by tak
na rovnakej zmene napísali približne tie isté testy a medzera v pokrytí
by bola výsledkom rozhodnutia, nie prehliadnutia.

Každý krok nižšie má príklad z tejto aplikácie. Krok bez príkladu
je krokom, ktorý nikto v praxi nepoužil.

**Na poradí záleží.** Kroky 1–4 sú mechanické a vytvoria väčšinu
prípadov. Kroky 5–8 vyžadujú úsudok a vytvoria zaujímavé prípady.
Krok 9 sa často preskočí, hoci práve on robí zvyšok poctivým.

Tri brány v `scripts/check.js` sledujú výstup tohto procesu —
**C6** trasy, **C7** testid, **C8** stavy. Nevedia posúdiť,
či je test *dobrý*; overujú, že nič ticho nevypadlo.

<a id="applied-independently--pythonpytest-d-032"></a>

## Samostatné použitie · Python/pytest (D-032)

Vrstva Python neopakuje inventár požiadaviek Postman. Rovnaký návrh
používa pre iného klienta a prípady formuje podľa silných stránok
parametrizovaných fixtúr: jedna matica neplatných polí, chybný JSON,
štyri odmietnuté formy tokenu, vlastníctvo ako neviditeľné čítanie
aj odmietnutá zmena a dva životné cykly so stavom. Súčasťou návrhu
testu je aj fixtúra: spustí skutočný proces Node, čaká na health
a vlastní dočasnú databázu, port a tajomstvo. Test, ktorý prešiel
iba preto, že už počúval iný server, by dokazoval niečo o tom
serveri, nie o tejto aplikácii.

---

<a id="1--inventory-of-what-changed"></a>

## 1 · Inventár zmien

Vypíšte všetky artefakty dotknuté zmenou podľa druhu. Nie „funkcia
príjmu“ — skutočné plochy, lebo každý druh má vlastné testy.

| Druh | Otázka |
|---|---|
| Tabuľka alebo stĺpec | nové obmedzenia, predvolené hodnoty, nová nullable hodnota |
| Endpoint | metóda, cesta, tvar požiadavky a odpovede |
| Pole odpovede pridané k **existujúcemu** endpointu | každý používateľ aj každá schéma, ktorá ho opisuje |
| Validátor | čo prijíma a čo odmieta |
| Stav, v ktorom môže byť riadok | a každý prechod medzi stavmi |
| Vykreslený prvok | jeho testid a tok, do ktorého patrí |

**Vypracovaný príklad — mesačný príjem (D-021):**

```
table      settings(user_id PK, monthly_income_cents INTEGER NOT NULL
                    DEFAULT 0 CHECK (monthly_income_cents >= 0))
module     src/settings.js          readIncome, writeIncome
endpoints  GET /api/settings        PUT /api/settings
changed    GET /api/summary         + income_cents, + remaining_cents
validator  validate.incomeCents     integer, 0 .. 100 000 000
elements   income-value  income-edit  income-input  income-save
           income-cancel  month-remaining  remaining-label
```

Najľahšie unikne tretí riadok. Pridanie dvoch polí do
`/api/summary` pokazilo tri existujúce asercie hneď po nasadení,
lebo každá schéma v kolekcii nastavuje `additionalProperties: false`.
Tým sa krok inventarizácie vykonal automaticky a je to jediný
krok, pri ktorom vám pomáha stroj.

---

<a id="2--equivalence-classes-and-boundaries-per-field-by-type"></a>

## 2 · Triedy ekvivalencie a hranice podľa poľa a typu

Pre každé pole rozdeľte vstupy na triedy, v ktorých sa očakáva
rovnaké správanie, a testujte **jeden prípad z každej triedy aj obe
strany každej hranice**. Rozdelenie vyplýva z typu poľa, preto
je tento krok mechanický.

| Typ | Triedy na pokrytie |
|---|---|
| Celé číslo s rozsahom | pod minimom · minimum · minimum+1 · typická hodnota · maximum−1 · maximum · nad maximom · nie celé číslo · nesprávny typ · chýba · výslovné null |
| Reťazec s limitom dĺžky | prázdny · iba medzery · 1 znak · limit · limit+1 · nesprávny typ · chýba |
| Dátum ako text | platný · nesprávny formát · tvarom správny, ale nemožný (`2026-13-45`) · mimo povoleného okna · chýba |
| Celočíselná enum hodnota (deň mesiaca) | pod rozsahom · najnižšia · hodnota bez zvláštneho spracovania · hodnota spúšťajúca výnimku · nad rozsahom |
| Voliteľné pole | chýba · null · prítomné · prítomné a neplatné |
| Cudzí kľúč | vlastný · iného používateľa · neexistujúci · nie číslo |

**Vypracovaný príklad — `amount_cents` zo špecifikácie §4.3:**

```
0             -> 400   TC-API-023   below the minimum
1             -> 201   TC-API-024   the minimum
100 000 000   -> 201   TC-API-025   the maximum, exactly
100 000 001   -> 400   TC-API-026   one past it
12.5          -> 400   TC-API-027   integer cents means integer
"1250"        -> 400   TC-API-028   no coercion
absent        -> 400   TC-API-029
```

**A najdôležitejší prípad v tejto aplikácii:** `day_of_month` nie je
obyčajný rozsah 1–31. Deň 28 existuje v každom mesiaci, 31 nie,
preto je rozdelenie `{0} {1} {2..28} {29,30,31} {32}` —
päť tried, nie tri. Pravidlo skracovania v §4.1 žije celé
v štvrtej triede. Test s dňom 15 by o ňom nič nedokázal.


---

<a id="3--authentication-matrix"></a>

## 3 · Matica autentifikácie

Päť stavov tokenu × dve vlastníctva. Pätnásť políčok, z ktorých
sa väčšina zlúči — no **zámerne a písomne**, nie zabudnutím.

| | vlastný zdroj | zdroj iného používateľa |
|---|---|---|
| platný token | úspešná cesta funkcie | **404 a výslovné overenie, že to nie je 403** |
| bez tokenu | 401 | 401 (k vlastníctvu sa nedostane) |
| chybne tvarovaná hlavička | 401 | 401 |
| poškodený podpis | 401 | 401 |
| expirovaný | 401 | 401 |

**Oprávnené zlúčenie:** middleware beží pred každou chránenou trasou,
preto sa štyri neúspešné stavy tokenu overujú **raz**, na
`/categories` (priečinok 02), a neopakujú pri každom endpointe.
Je to rozhodnutie a tu je zapísané, aby ho nikto nepovažoval
za opomenutie.

**Čo sa nezlučuje:** stĺpec *vlastné oproti cudzím*. Každý endpoint
prijímajúci ID sa musí preveriť osobitne, lebo vlastníctvo sa vynucuje
v každom dopyte, nie middlewareom. Šesť prípadov v kolekcii to robí
a každý tiež overuje, že odpoveď **nie je** 403 — kód 403 by potvrdil
existenciu riadka a z enumerácie ID by urobil mapu cudzích dát (§4.3).

**Expirovaný token treba vytvoriť.** Tokeny žijú 30 dní, preto
`qa/api/run.js` podpíše jeden vlastným tajomstvom servera a dá mu
`exp` v minulosti. Prípad najprv overí, že token naozaj expiroval,
*až potom* overí 401 — inak by prešiel pri ľubovoľnom nepoužiteľnom
reťazci a nič o expirácii nedokázal.

---

<a id="4--error-contract-every-status-the-code-can-produce"></a>

## 4 · Chybový kontrakt: každý stav, ktorý môže kód vytvoriť

Vypíšte všetky stavy vrátiteľné zmeneným kódom a potom napíšte
prípad, ktorý každý **vyvolá**. Nie „overí, že by ho vrátil“;
skutočne ho spôsobí.

**C8 to vynucuje** čítaním `res.status(...)` a `new ApiError(...)`
zo `src/` a hľadaním zodpovedajúcej asercie v kolekcii.

Aktuálne: **10 vytváraných stavov, 8 overovaných, 2 výnimky
s dôvodmi.**

```
200 201 204 400 401 404 409 429   asserted
500                               excepted — §5 says it must never be reachable.
                                  Provoking one means breaking the app to prove
                                  it can break. 40+ assertions check the
                                  opposite: "never a 500".
403                               excepted — unreachable by design. validate.js
                                  exports forbidden() and nothing throws it;
                                  §4.3 requires 404 instead. TC-API-066 asserts
                                  the property that replaced it.
```

Obe výnimky sú s uvedenými dôvodmi v `scripts/check-exceptions.json`.
**Výnimka je pre niečo, čo sa nedá testovať, nikdy pre niečo,
čo sa iba ešte netestovalo.**

---

<a id="5--state-transitions-legal-and-illegal"></a>

## 5 · Zákonné a nezákonné prechody stavov

Nakreslite stavy riadka a každú šípku medzi nimi; potom testujte
šípky, ktoré nemajú existovať, lebo práve tie nikto neimplementuje.

**Vypracovaný príklad — pôžička (§4.2):**

```
        pay              pay              pay
active ─────> active ─────> active ─────> finished
  │  n of N     n+1 of N      N-1 of N     active = 0
  │                                            │
  └──────────────── pay ───────────────────────┘
                                          409, not 400
```

| Prechod | Prípad |
|---|---|
| platba, nie posledná | TC-API-054 — `finished: false` |
| platba, posledná | TC-API-056 — `remaining_count` 0, `finished` **true** |
| **platba dokončenej pôžičky** | TC-API-057 — **409**, výslovné overenie, že nie 400 |
| dokončený riadok opustí `?active=1` | TC-API-058 |
| platba cudzej pôžičky | TC-API-059 — 404 |

Tretí riadok stojí za námahu. Ide o konflikt **stavu**,
nie o zlý vstup; 400 by bola ľahká nesprávna odpoveď.
Špecifikácia ho výslovne pomenúva práve preto, že sa dá pomýliť.

**Prechod má aj druhú otázku, ktorú nikto nekladie:
kto vyhrá, keď sa dve také šípky kreslia v tom istom okamihu?**

Každá šípka vyššie predpokladá jedného aktéra. Dve karty prehliadača,
dve zariadenia alebo opakovaná požiadavka tento predpoklad rušia
a stavový automat o tom nič nehovorí. Nie je to medzera v obrázku —
je to medzera v *špecifikácii*. Jej nájdenie má väčšiu cenu než
pokrytie ďalšej šípky. Pozri §8: projekt nemal písané pravidlo
a vrstva súbehu vznikla, aby zistila skutočnú odpoveď.

**Rovnaký tvar inde:** obmedzovač frekvencie (D-016) je tiež
stavový automat — pod limitom → na limite → blokované → expirované.
Zaujímavé prechody sú „správne heslo počas blokovania“ (stále 429,
inak limit nič nechráni) a „blokované → odblokované bez zásahu“
(inak sa e-mailová adresa stane spôsobom, ako zablokovať vlastníka).


---

<a id="6--decision-table-for-combinations"></a>

## 6 · Rozhodovacia tabuľka kombinácií

Keď na seba pôsobia dve či viaceré podmienky, dajte ich do tabuľky.
Netestujte len kombinácie, ktoré vám napadli; najprv ich vypíšte
a potom rozhodnite, ktoré pokryť.

**Vypracovaný príklad — príjem × výdavky na obrazovke mesiaca:**

| # | príjem | minuté | očakávané |
|---|---|---|---|
| 1 | nenastavený | nič | `Set income`, zostatok `—` |
| 2 | nenastavený | niečo | `Set income`, zostatok `—`, donut stále vykreslí výdavky |
| 3 | nastavený | nič | Zostáva = celý príjem, bez oblúkov |
| 4 | nastavený | menej než príjem | Zostáva = príjem − minuté |
| 5 | nastavený | **presne** príjem | Zostáva = `€0.00` — nie `Over €0.00` |
| 6 | nastavený | viac než príjem | štítok sa zmení na `Over`, číslo je presah |

Riadok 5 je hranica medzi riadkami 4 a 6 a človek píšuci testy
podľa intuície ho často vynechá: pôsobí ako riadok 4, ale je
na hrane riadka 6. Riadky 2 a 3 tvoria pár „jedna podmienka
prítomná, druhá nie“, ku ktorému sa sada šťastných ciest nedostane.

Tabuľka nie je iba ilustrácia. Jej spustenie v S11 odhalilo
neotestované riadky 2, 3 a 5 — pozri retrospektívu nižšie.

---

<a id="7--interface-every-testid-both-paths-per-flow"></a>

## 7 · Rozhranie: každé testid, obe cesty každého toku

- **Každé testid vykreslené aplikáciou sa používa z page objectu.**
  Vynucuje to C7. Lokátor v súbore špecifikácie je lokátor mimo
  jediného miesta, kde podľa D-012 patria, a prvý krok späť
  k selektorom roztrúseným všade.
- **Každý tok dostane úspešnú aj odmietnutú cestu.** Uloženie bez
  sumy, bez kategórie, príjem, ktorý nie je číslom, platba odmietnutá
  serverom. Na odmietnutých cestách sa našiel BUG-003 — úspešná
  cesta znovu vykreslila obrazovku a škodu skryla.
- **Vyberajte podľa roly a názvu aj podľa testid**, keď je názov
  podstatou kontroly. Dlaždica kategórie nájdená cez
  `getByRole('button', { name: 'Groceries' })` zlyhá, ak stratí
  prístupný názov; pri testid nie.
- **Overujte číslo, nie obrázok.** Donut sa overuje ako „jeden oblúk
  na kategóriu, dostupný podľa ID kategórie“ a cez čísla vedľa neho.
  Overovanie geometrie oblúka by testovalo aritmetiku
  `stroke-dasharray`, ktorá nie je miestom rizika pre peniaze.

---

<a id="8--concurrency-repetition-server-failure"></a>

## 8 · Súbeh, opakovanie, zlyhanie servera

Tri otázky, ktoré úspešná cesta jedného používateľa nikdy nepoloží.

| Otázka | V tejto aplikácii |
|---|---|
| Čo sa stane pri paralelnej záťaži? | `qa/load/` — 50 súbežných zapisovačov a vlna chybných prihlásení. Tak sa našiel **BUG-004**: 20 chybných hesiel za sekundu predĺžilo `/api/health` z 1.2 ms na 1819 ms |
| Čo sa stane pri opakovaní? | Druhý `PUT /api/settings` musí nahradiť, nie pripočítať (TC-API-076). Druhý `DELETE` musí vrátiť 404, nie 204 (TC-API-041). Druhá platba uzavretej pôžičky musí vrátiť 409 |
| Čo sa stane pri odmietnutí serverom? | Presne **BUG-003**: obrazovka správne spracovala 409, ale tlačidlo navždy ostalo na `Paying…`. Každá akcia, ktorú možno odmietnuť, dostane taký prípad |

**Merajte voči základu alebo nemeriate nič** (R6). Každý záťažový
beh zaznamenáva `GET /api/health` v pokoji *aj* pod záťažou
v tom istom behu. „20 ms“ nič neznamená; „1.4 ms → 32 ms“
je hranica a „1.2 ms → 1819 ms“ je chyba.

---

<a id="8a--two-actors-one-row--the-class-this-project-was-missing"></a>

### 8a · Dvaja aktéri, jeden riadok — trieda, ktorá projektu chýbala

Pridané neskôr na výslovnú žiadosť. Patrí to sem, nie do §5,
pretože nejde o ďalšiu šípku stavového automatu, ale o otázku,
čo sa stane, keď sa dve šípky nakreslia súčasne.

**Začnite hľadaním pravidla, nie chyby.** Pred písaním sa pýtajte:
*hovorí špecifikácia, kto vyhrá?* V tejto aplikácii odpoveď
znela **nie** — §4.2 opisuje platbu pôžičky a §5 jej úpravu,
ale nič o ich súbehu. **Táto absencia je prvým zistením**
a má väčšiu cenu než test, lebo test môže overiť len existujúcu
odpoveď.

**Potom zistite, odkiaľ bezpečnosť naozaj prichádza.**
Zriedka je to tam, kde ju očakávate. Tu:

| | |
|---|---|
| Ako vyzeral kód | čítanie, rozhodnutie a zápis v oddelenej transakcii — učebnicová medzera medzi kontrolou a použitím |
| Prečo sa nikdy nič nepokazilo | `better-sqlite3` je synchrónny a Node má jedno vlákno, takže handler bez `await` sa nedá preložiť s iným. Event loop serializuje požiadavky skôr, než ich uvidí SQLite |
| Prečo to nestačí | je to vlastnosť runtime, nie kódu. Dva serverové procesy nad jedným súborom ju rušia, rovnako ako jediné `await` pridané do trasy — `src/auth.js` už jedno má |

**Bezpečnosť náhodou runtime nie je bezpečnosť.** Nedá sa
kontrolovať v diff-e, neobjaví sa tam a potichu zlyhá,
keď náhoda prestane platiť.


**Píšte invarianty, nie očakávaný výsledok.** Pretek nemá jedinú
očakávanú hodnotu — práve preto je pretekom. Má výsledky, ktoré
sú *povolené*, a výsledky, ktoré sú *nemožné*:

| | Povolené | Nemožné |
|---|---|---|
| platba oproti úprave | platba účtuje starú alebo novú sumu | `paid_count` sa zmení o niečo iné než jeden; platba sumy, ktorá nikdy nebola nastavená; dokončená pôžička so zostávajúcimi splátkami; akýkoľvek 5xx |
| úprava oproti zmazaniu | úprava sa zapíše a riadok sa potom zmaže; alebo riadok zmizne a úprava vráti 404 | riadok prežije úspešné zmazanie; akýkoľvek 5xx |

**Spustite to na viac než jednom procese.** Tento krok ospravedlnil
celé cvičenie. V jednom procese bolo štyridsať dvojíc
platba-oproti-úprave čistých — argument serializácie platil
presne podľa očakávania. V dvoch procesoch zdieľajúcich jednu
databázu rovnakých štyridsať dvojíc vytvorilo **štyri 500**
(BUG-012) a servery sa ani nevedeli spustiť spolu (BUG-011).
Žiadna existujúca vrstva to nevedela dosiahnuť, pretože nikdy
nevytvorila túto podmienku.

**Overte, že pretek naozaj preteká.** Scenár B v `qa/race/`
hlásil štyridsať rovnakých výsledkov — `edit 404 · delete 204`,
zakaždým. Štyridsať pozorovaní jedného pevného poradia
netestuje pretek; testuje jednu vetvu štyridsaťkrát,
druhú vôbec. Otočenie poradia požiadaviek nič nezmenilo,
čím sa vyvrátilo zjavné vysvetlenie. Zákonná, ale nedostupná
vetva je teraz pokrytá **vynúteným** poradím, výslovne
označeným ako vynútené, lebo sada, ktorá vetvu nikdy
nedosiahne, a sada, ktorá ju dosiahne zámerne, majú
rovnaký počet úspechov.

**Aj opakovanie sem patrí a odpoveď môže byť „správne, ale stále
hodné poznania“.** Dva rovnaké POSTy vytvoria dva riadky
štyridsaťkrát zo štyridsiatich. Je to HTTP podľa špecifikácie.
O tom, či to záleží, rozhoduje *ďalšia* otázka — môže sa
k tomu dostať človek? — a odpoveď bola nie, lebo
`withBusy` vypne ovládací prvok ešte pred čakaním na prvú
požiadavku. Obe polovice sú v LIMIT-002. Aj zistenie správneho
správania je zistením, pokiaľ sa ochrana pomenuje a nepredpokladá.

---

<a id="9--what-is-deliberately-not-tested"></a>

## 9 · Čo sa zámerne netestuje

Často preskakovaný krok, ktorý ostatných osem robí poctivými.
Netestovaná oblasť je buď rozhodnutie s dôvodom, alebo
prehliadnutie; rozdiel je len v tom, či je zapísaná.

| Netestované | Prečo |
|---|---|
| Viac prehliadačov | Iba Chromium, dva rozmery obrazovky. Aplikácia nepoužíva API líšiace sa medzi enginmi a jeden naozaj spustený prehliadač je lepší než štyri plánované |
| Vizuálna regresia | Bez základných snímok. Rozloženie sa namiesto toho overuje geometriou a prístupnými názvami. BUG-001 je protiargument, riešený v TC-REG-001 čítaním vypočítaného kontrastu namiesto porovnávania pixelov |
| Jednotkové testy | Špecifikácia §7 drží jediný skutočný algoritmus (`dates.js`) čistý a vrstva API zvonka preveruje všetkých sedem riadkov jeho tabuľky §4.1. Jednotková vrstva by otestovala tú istú funkciu kratšou cestou |
| Súbežné zápisy do nastavení jedného používateľa | `user_id` je PRIMARY KEY a zápis je jediný upsert, takže ho SQLite serializuje. **„Z jedného procesu“ v tejto vete znamenalo viac, než si ktokoľvek všimol** — §8a opisuje overenie predpokladu na dvoch procesoch |
| Závislosti (Express, bcrypt, …) | Kód tretích strán s vlastnými sadami |
| Štyri neúspešné stavy tokenu pri každom endpointe | Zámerne zlúčené — pozri §3 |
| 500 a 403 | Pozri §4. Obe v `check-exceptions.json` s dôvodmi |

---

<a id="retrospective--the-procedure-run-against-a-finished-feature"></a>

## Retrospektíva — postup použitý na hotovej funkcii

**S11 pustila funkciu príjmu (D-021) znovu cez kroky 1–9, aby
overila postup, nie funkciu.** Tá už bola vydaná s 13 API prípadmi
a 8 end-to-end prípadmi, všetky prechádzali.

Našlo sa **sedem medzier**; užitočné je, odkiaľ prišli:

| Krok | Medzera | Pridané ako |
|---|---|---|
| 2 · hranice | `monthly_income_cents` = 1 — trieda minimum-plus-jeden nemala prípad | TC-API-087 |
| 2 · hranice | = 100 000 000 — presný strop; testoval sa len strop+1 | TC-API-088 |
| 2 · hranice | výslovné `null` — iné než chýbajúca hodnota a prešlo inou cestou validátora | TC-API-089 |
| 3 · matica autentifikácie | `PUT /api/settings` bez tokenu — testoval sa iba `GET` | TC-API-090 |
| 6 · rozhodovacia tabuľka | riadok 2: míňanie bez nastaveného príjmu | TC-E2E-042 |
| 6 · rozhodovacia tabuľka | riadok 3: príjem bez výdavkov | TC-E2E-043 |
| 6 · rozhodovacia tabuľka | riadok 5: míňanie **presne** vo výške príjmu — hranica medzi „Left“ a „Over“ | TC-E2E-044 |

Päť zo siedmich vychádza z dvoch mechanických krokov.
To je dôvod existencie tohto dokumentu: nie sú to rafinované
prípady, ale tie, ktoré vzniknú dôsledným dokončením rozdelenia,
a všetky unikli človeku, ktorý testy písal premyslene, no ručne.

Ani jedna zo siedmich medzier neodhalila chybu aplikácie.
Aj to je výsledok — funkcia bola správna a sada teraz
dokáže viac z jej správnosti.
