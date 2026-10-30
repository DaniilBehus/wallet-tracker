[English](../../../../../qa/docs/defects/BUG-004-bcrypt-blocks-event-loop.md) · **Slovenčina**

<a id="bug-004--20-wrong-passwords-a-second-make-the-app-unusable-for-everyone"></a>

# BUG-004 · 20 nesprávnych hesiel za sekundu znefunkční aplikáciu pre všetkých

[← Späť na README](../../../README.md#qa-evidence) · [Register defektov](../../../log/BUGS.md) · [Ďalej: index hlásení →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Synchrónne kontroly bcrypt blokovali spoločnú slučku udalostí servera počas návalu pokusov s nesprávnym heslom.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Defekt |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Vysoká |
| Priorita | P0 — neautentifikovaná požiadavka znefunkční celú službu |
| Komponent | `src/auth.js` — `login`, `bcrypt.compareSync` |
| Zistené / dotknutá verzia | S07; presná verzia len tam, kde je uvedená nižšie |
| Prostredie / frekvencia | Node v24.13.1, lokálny server na porte 3100, dočasná databáza; frekvencia len tam, kde je uvedená nižšie |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie údaje

S07, pomocou záťažového smoke testu k6 `qa/load/auth-burst.js`

<a id="reproduction"></a>

## Reprodukcia

1. `npm run test:load` (spustí vlastný server na porte 3100 s dočasnou databázou, takže sa nič iné nemení).
2. Druhý scenár zaregistruje jeden účet a potom mu 15 sekúnd odosiela nesprávne heslá súčasne z 20 spojení.
3. Po celý čas sa `GET /api/health` kontroluje a meria 10-krát za sekundu. Predtým sa meria aj 5 sekúnd, aby vznikla východisková hodnota.

<a id="expected-and-requirement"></a>

## Očakávanie a požiadavka

`/api/health` vykoná jedno `SELECT 1`, nepristupuje k údajom používateľa a nesúvisí s prihlasovaním. Má zostať rýchly. Prah záťažového smoke testu je `p(95) < 250 ms`, čo je pre takúto požiadavku už veľkorysé.

<a id="actual-observation"></a>

## Skutočné pozorovanie

Pri 20 spojeniach s nesprávnym heslom za sekundu vzrástol p95 `GET /api/health` z **1.2 ms bez záťaže na 1819.1 ms pod záťažou** (prah: 250 ms). Nižšie uvedený datovaný výstup k6 uvádza aj 1494.8× nárast p95; nejde o odhad podľa UI.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `qa/load/auth-burst.js`](../../../../../qa/load/auth-burst.js)
- [Zaznamenaný zdroj: `src/auth.js`](../../../../../src/auth.js)
- [Zaznamenaný zdroj: `src/ratelimit.js`](../../../../../src/ratelimit.js)
- [Úplný pôvodný register zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — vyhľadajte nadpis `BUG-004`.
- [GitHub Issue #4](https://github.com/DaniilBehus/wallet-tracker/issues/4) — externé metadáta sa môžu líšiť; stav dokumentácie určuje lokálny register.

<a id="resolution-and-verification"></a>

## Oprava a overenie

**CLOSED.** Porovnávanie hesiel sa presunulo na asynchrónny bcrypt a obmedzovač prihlasovania teraz odmieta nadbytočné pokusy pred hashovaním. V tom istom zaznamenanom scenári k6 s 20 spojeniami počas 15 sekúnd sa p95 kontroly zdravia pod záťažou zmenil z **1819.1 ms na 5.3 ms** pri rovnakom prahu 250 ms; p95 bez záťaže zostal 1.2 ms. Samostatná kontrola povolených prihlásení v pôvodnom hlásení vymedzuje zvyšné náklady. Pri tomto prepise dokumentácie sa záťažový test nespúšťal znova.

<a id="technical-investigation-and-dated-history"></a>

## Technické vyšetrovanie a datovaná história

<details>
<summary>Otvoriť pôvodné podrobné hlásenie/pozorovanie</summary>

<a id="original-report-bug-004--twenty-wrong-passwords-a-second-make-the-app-unusable-for-everyone"></a>

### Pôvodné hlásenie: BUG-004 · Dvadsať nesprávnych hesiel za sekundu znefunkční aplikáciu pre všetkých

[← Späť na README](../../../README.md#qa-evidence) · [Ďalej: zdroj záťažového testu →](../../../../../qa/load/auth-burst.js)

![závažnosť](https://img.shields.io/badge/severity-High-orange?style=flat-square)
![stav](https://img.shields.io/badge/state-CLOSED-brightgreen?style=flat-square)

| | |
|---|---|
| **Závažnosť** | Vysoká |
| **Priorita** | P0 — neautentifikovaná požiadavka znefunkční celú službu |
| **Stav** | CLOSED 2026-09-03 |
| **Zistené pomocou** | TC-LOAD-002, `qa/load/auth-burst.js` (k6) |
| **Komponent** | `src/auth.js` — `login`, `bcrypt.compareSync` |
| **Dopad na** | každý endpoint vrátane `/api/health` |
| **Prostredie** | Node v24.13.1, lokálny server na porte 3100, dočasná databáza |
| **Opravené v** | Opravené. Pôvodný commit nie je súčasťou tejto verejnej snímky. |
<a id="summary"></a>

## Zhrnutie

Dvadsať neúspešných prihlásení za sekundu — frekvencia, ktorú môže jeden telefón
pri zlom spojení vyvolať aj náhodou — posunie `GET /api/health` z 1.2 ms na
1819 ms pri p95. Tento endpoint vykoná jedno `SELECT 1`, nepristupuje
k údajom používateľa a nesúvisí s prihlasovaním.

Na vyvolanie problému netreba účet. Netreba token ani predchádzajúci vzťah
a pred opravou nebol počet pokusov obmedzený.

<a id="steps-to-reproduce"></a>

## Kroky na reprodukciu

1. `npm run test:load` — spustí vlastný server na porte 3100 s dočasnou
   databázou, takže nič iné na počítači nemení.
2. Druhý scenár zaregistruje jeden účet a potom mu 15 sekúnd posiela nesprávne
   heslá súčasne z 20 spojení.
3. Po celý čas sa `GET /api/health` meria desaťkrát za sekundu. Meria sa aj
   päť sekúnd vopred, aby sa porovnávalo s východiskovou hodnotou, nie s dojmom.

<a id="expected"></a>

## Očakávanie

`/api/health` zostáva rýchly aj počas ďalších požiadaviek. Prah záťažového
smoke testu je `p(95) < 250 ms`, čo je už veľkorysé pri požiadavke
vykonávajúcej jeden triviálny dotaz.

<a id="actual"></a>

## Skutočnosť

<details>
<summary>Výstup k6 — neúspešný beh</summary>

```
login attempts    305 in 15s  (20/s)
refused 401       305
rate limited 429  0        <- nothing stops a guesser yet
login latency     avg 1017.8 ms   p95 1099.1 ms

GET /api/health - the same trivial request, measured twice:
  idle            avg 0.8 ms      p95 1.2 ms
  under load      avg 1134.9 ms   p95 1819.1 ms
  cost of load    1494.8x slower at p95

ERRO thresholds on metrics 'health_latency_under_load' have been crossed
```

</details>

**1.2 ms → 1819 ms.** Každý ďalší používateľ čaká takmer dve sekundy
na požiadavku, ktorá by mala trvať jednu milisekundu.

<a id="root-cause"></a>

## Príčina

`src/auth.js` volal `bcrypt.compareSync`.

bcrypt je *zámerne* nákladný — v tom spočíva jeho účel. Desať kôl
s nákladom ~50 ms je správne a nesmie sa znížiť. Defekt je **`Sync`**.

Node vykonáva JavaScript na jednom vlákne. Synchrónne volanie nepočíta
*popri* ostatných požiadavkách, ale *namiesto* nich: počas tých ~50 ms
proces nedokáže prijať spojenie, spracovať požiadavku ani odpovedať.
Dvadsať súbežných pokusov si náklad nerozdelí — čakajú jeden za druhým
a všetci ostatní čakajú za nimi.

Situáciu zhoršujú dve veci, z ktorých každá má vlastnú opravu:

- **Endpoint nevyžaduje autentifikáciu.** Na to, aby server spotreboval 50 ms CPU,
  netreba účet ani token.
- **Počet pokusov nič neobmedzovalo.** Uskutočnilo sa 305 pokusov a všetkých 305 sa spracovalo.

`register` mal rovnakú podobu (`bcrypt.hashSync`). Smoke test zápisov
to zmeral z druhej strany: vytvorenie 50 účtov trvalo 2800 ms,
približne 56 ms na každý, striktne jeden po druhom.

**Nie je to ten istý problém ako [LIMIT-001](LIMIT-001-serialised-database-work.md).**
Tam sa čaká na ~0.5 ms databázovej práce a náklad je 23×. Tu sa čaká
na ~50 ms zámerne náročného výpočtu CPU a náklad je 1495×.
Mechanizmus je rovnaký, no rozdiel predstavuje dva rády — preto je
jeden prípad prijatým obmedzením a tento je defekt.

<a id="fix--part-one-the-limiter"></a>

## Oprava — prvá časť, obmedzovač

Podľa **D-016**: päť neúspechov v 15-minútovom okne, potom 429
s `Retry-After`, počítané nezávisle podľa e-mailu a IP klienta.
`src/ratelimit.js` sa volá z prihlasovacej trasy **pred** spustením `login()`.

Toto poradie *je* oprava. Celý náklad defektu predstavuje bcrypt;
obmedzovač zaradený až za ním by nechránil nič.

<details>
<summary>Regresia — ten istý skript, tých istých 20 spojení, tých istých 15 sekúnd</summary>

```
                     before            after
login attempts       305               113 062
reached bcrypt       305               5          (the allowance)
rate limited 429     0                 113 057
login latency avg    1017.8 ms         2.6 ms
health p95 idle      1.2 ms            1.2 ms
health p95 loaded    1819.1 ms         5.3 ms
                     1495x slower      4.5x slower
threshold            CROSSED           passes
```

</details>

Nárast priepustnosti z 20/s na 7 537/s sám dokazuje, že obmedzovač je
na správnom mieste: odmietanie je lacné, pretože nastáva pred nákladnou časťou.

Hraničné správanie pokrýva kolekcia API, priečinok **08 · Login rate
limiting** — posledný povolený pokus, prvý odmietnutý, `Retry-After`,
správne heslo neobchádzajúce blokovanie, samovoľné uplynutie okna
a úspešné prihlásenie vynulujúce počítadlo.

<a id="fix--part-two-the-residual"></a>

## Oprava — druhá časť, zvyšný náklad

Prvá oprava zanechala zvyšný náklad, ktorý bol vtedy výslovne pomenovaný:
každý z piatich povolených pokusov stále blokoval slučku udalostí na ~50 ms.
Počas dvoch relácií bol tento zvyšný náklad iba slovne opísaný a **nikdy nebol zmeraný** — skript návalu
ho nevidí, pretože po piatich pokusoch sú všetky odpovede lacné 429
a obmedzovač náklad skryje.

Preto vznikol tretí skript, `qa/load/allowed-logins.js`, bežiaci proti serveru
s vypnutým obmedzovačom (`LOGIN_MAX_FAILURES` je nastavené veľmi vysoko).
Nie je to realistické nasadenie; je to spôsob, ako zmerať cenu *povolených*
pokusov.

Výsledok bol horší, než naznačoval text.

<details>
<summary>Výstup k6 — päť súbežných prihlásení, všetky sa dostali k bcrypt</summary>

```
                                                   before          after
  attempts completed in 15s                        285             1103
  login latency, avg                               265.5 ms        67.9 ms
  GET /api/health  idle p95                        1.5 ms          1.5 ms
  GET /api/health  under load p95                  422.4 ms        1.0 ms
                                                   285.8x slower   0.7x
```

</details>

**Päť nesprávnych hesiel — v povolenom rozsahu, od jedného človeka,
ktorý sa pomýlil — predĺžilo každú inú požiadavku na štyri desatiny sekundy.**

`src/auth.js` prešiel na `bcrypt.hash` a `bcrypt.compare`.
`register()` a `login()` sa stali `async`, rovnako ako obe trasy,
ktoré ich volajú. bcrypt zostal na desiatich kolách — náklad *je*
bezpečnostná vlastnosť. Zmenilo sa miesto jeho vykonania: pracovník
fondu vlákien libuv namiesto slučky udalostí, takže jedno prihlásenie
zamestná pracovníka, nie celý proces. Express 5 odovzdáva odmietnutý
promise do obsluhy chýb sám, preto jediný renderer chýb v spec §5
stále vidí všetko a trasy nepotrebovali `try/catch`.

Latencia prihlásenia tiež **klesla** z 265 ms na 68 ms a priepustnosť
za rovnakých pätnásť sekúnd stúpla z 285 na 1103, približne štvornásobne,
čo zodpovedá predvolenej veľkosti fondu vlákien.

<a id="the-ordering-that-had-to-survive-and-did"></a>

## Poradie, ktoré muselo zostať zachované — a zostalo

`rateLimit.check()` je stále prvá operácia prihlasovacej trasy,
pred `await login(...)`. Obrátenie poradia by celý defekt vrátilo.

Overené **štrukturálne, nie podľa času**: TC-API-071 pošle *správne*
heslo pri blokovaní a stále vyžaduje 429 — čo je možné iba vtedy,
ak kontrola prebehne pred autentifikáciou. Časové tvrdenie by bolo
zdanlivo jednoduché, ale nesprávne: na pomalom stroji CI by zlyhalo
z dôvodov nesúvisiacich s chránenou vlastnosťou.

<a id="regression"></a>

## Regresia

`qa/load/allowed-logins.js` ponecháva prah
`health_latency_under_load: p(95) < 100`. Synchrónny bcrypt ho nedokáže
splniť — nameraných bolo 422 ms. Teraz prechádza pri 1.0 ms.

<a id="-rule-r6"></a>

## → Pravidlo R6

Merajte ten istý lacný endpoint bez záťaže a pod záťažou **v jednom behu**.
Číslo latencie bez porovnania nič nehovorí; zistením je pomer.


</details>
