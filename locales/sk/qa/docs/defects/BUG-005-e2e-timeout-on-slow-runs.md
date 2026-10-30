[English](../../../../../qa/docs/defects/BUG-005-e2e-timeout-on-slow-runs.md) · **Slovenčina**

<a id="bug-005--one-e2e-test-times-out-on-runs-that-are-3-slower-than-normal"></a>

# BUG-005 · Jeden e2e test prekročí časový limit pri behoch ~3× pomalších než obvykle

[← Späť na README](../../../README.md#qa-evidence) · [Register defektov](../../../log/BUGS.md) · [Ďalej: index hlásení →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Pri dvoch nezvyčajne pomalých lokálnych end-to-end behoch (36–39 sekúnd namiesto približne 11) ten istý dlhý test plánovania vyčerpal 30-sekundový limit. Nezistilo sa zlyhanie viditeľné používateľovi ani príčina.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Defekt |
| Stav | **OPEN** — aktuálny kanonický register |
| Závažnosť | Nízka |
| Priorita | P3 — prerušovaný výskyt bez známeho prejavu pre používateľa |
| Komponent | neznámy — práve to je podstatou tohto záznamu |
| Zistené / dotknutá verzia | S10; presná verzia len tam, kde je uvedená nižšie |
| Prostredie / frekvencia | Lokálny Chromium; štyria pracovníci Playwright; dva pozorované pomalé behy za 36–39 s oproti obvyklým približne 11 s |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie údaje

Spustite celú lokálnu sadu prehliadačových testov so štyrmi pracovníkmi Chromium. Dotknutý test je `qa/e2e/schedules.spec.js` → „the 31st is accepted and explains itself“; dva pomalé výskyty boli zaznamenané v S08 a S10. Samostatný test zlyhanie nereprodukoval.

<a id="reproduction"></a>

## Reprodukcia

Deterministický spúšťač sa nezistil. Zlyhanie nastalo dvakrát počas kompletných lokálnych behov so štyrmi pracovníkmi, ale pomenovaný test prešiel samostatne, pri následných opakovaniach celej sady aj pri pokuse o reprodukciu nasýtením CPU. Sú to pozorovania, nie zaručený postup reprodukcie.

<a id="expected-and-requirement"></a>

## Očakávanie a požiadavka

Pomenovaný prehliadačový test má dokončiť zdokumentovaný scenár v nakonfigurovanom 30-sekundovom limite testu. Ide o zámer testu, nie o SLA odozvy aplikácie.

<a id="actual-observation"></a>

## Skutočné pozorovanie

Chromium so štyrmi pracovníkmi Playwright prekročil limit pri `locator.fill` v `qa/e2e/schedules.spec.js` po 30,000 ms. Dva lokálne behy celej sady trvali 36–39 s oproti obvyklým približne 11 s. Presná príčina zostáva neznáma.

<a id="evidence"></a>

## Dôkazy

- [Dotknutý prehliadačový scenár](../../../../../qa/e2e/schedules.spec.js) a chyba `locator.fill` po 30,000 ms citovaná v pôvodnom hlásení nižšie.
- [Zaznamenaný zdroj: `qa/e2e/schedules.spec.js`](../../../../../qa/e2e/schedules.spec.js)
- [Zaznamenaný zdroj: `qa/docs/test-plan.md`](../test-plan.md)
- [Zaznamenaný zdroj: `qa/e2e/`](../../../../../qa/e2e)
- [Úplný pôvodný register zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — vyhľadajte nadpis `BUG-005`.
- [GitHub Issue #5](https://github.com/DaniilBehus/wallet-tracker/issues/5) — externé metadáta sa môžu líšiť; stav dokumentácie určuje lokálny register.

<a id="resolution-and-verification"></a>

## Oprava a overenie

Stav: **OPEN**. Registrácia neskôr prešla na asynchrónny bcrypt a nasledujúce kompletné behy/CI boli zelené, ale hypotéza sa nepotvrdila: pokus s nasýtením CPU časový limit nereprodukoval. Žiadny limit ani tvrdenie testu sa neuvoľnili. Pri opakovaní treba zachytiť trace Playwright spolu s časmi požiadaviek servera. [Verejné Issue #5](https://github.com/DaniilBehus/wallet-tracker/issues/5) je zatvorené napriek lokálnemu záznamu OPEN; v tejto práci sa Issue nemenilo.

<a id="technical-investigation-and-dated-history"></a>

## Technické vyšetrovanie a datovaná história

<details>
<summary>Otvoriť pôvodné podrobné hlásenie/pozorovanie</summary>

<a id="original-report-bug-005--one-end-to-end-test-times-out-on-runs-that-are-3-slower-than-normal"></a>

### Pôvodné hlásenie: BUG-005 · Jeden end-to-end test prekročí limit pri behoch ~3× pomalších než obvykle

[← Späť na README](../../../README.md#qa-evidence) · [Ďalej: prehliadačová sada →](../../../../../qa/e2e)

![závažnosť](https://img.shields.io/badge/severity-Low-lightgrey?style=flat-square)
![stav](https://img.shields.io/badge/state-OPEN-red?style=flat-square)

| | |
|---|---|
| **Závažnosť** | Nízka |
| **Priorita** | P3 — prerušovaný výskyt bez známeho prejavu pre používateľa |
| **Stav** | OPEN — zámerne, pozrite nižšie |
| **Zistené pomocou** | samotná end-to-end sada, dvakrát: S08 a S10 |
| **Komponent** | neznámy — práve to je podstatou tohto záznamu |
| **Dopad na** | `qa/e2e/schedules.spec.js › the 31st is accepted and explains itself` |
| **Prostredie** | Chromium, štyria pracovníci Playwright, lokálny server |
| **Opravené v** | Neopravené. Príčina nikdy nebola charakterizovaná; pozrite nižšie. |
<a id="summary"></a>

## Zhrnutie

Sada sa zvyčajne dokončí približne za 11 sekúnd. Dvakrát trvala 36–39
sekúnd a v oboch týchto behoch ten istý test zlyhal na časovom limite
na úrovni testu.

**Príčina nie je charakterizovaná a záznam zostáva otvorený,
namiesto toho, aby sa uzavrel ako „flaky“.**
Slovo „flaky“ môže ukončiť vyšetrovanie bez jeho dokončenia.

<a id="what-happens"></a>

## Čo sa deje

```
Error: locator.fill: Test timeout of 30000ms exceeded.
qa/e2e/schedules.spec.js › Schedules › the 31st is accepted and explains itself
```

Tých 30 000 ms predstavuje rozpočet **testu**, nie vlastný limit akcie —
test vyčerpal celý čas skôr, než sa `fill` mohol vykonať.

<a id="the-signature-from-two-occurrences"></a>

## Charakteristický vzor z dvoch výskytov

Oba majú spoločný ten istý test a trvanie celej sady približne
trojnásobné oproti obvyklému. Pri dvoch dátových bodoch to už nevyzerá
ako náhoda, preto sa to zaznamenalo.

**Prečo tento test a nie iný:** má najdlhší reťazec postupných akcií UI
v sade — navigovať, vyplniť, overiť, vyplniť, overiť, vyplniť,
vyplniť, vyplniť, kliknúť, overiť. Ak sa všetko spomalí, ako prvý
vyčerpá pevný limit. Je to *príznak*, nie nevyhnutne príčina.

<a id="what-was-tried-and-did-not-reproduce-it"></a>

## Čo sa skúšalo bez reprodukcie

| Pokus | Výsledok |
|---|---|
| Samostatný test, opakovane | prechádza, ~0.5 s |
| Celá sada, štyri po sebe idúce behy | 64/64, 10.6–11.4 s |
| Celá sada dvakrát s novou databázou | 64/64, ~11 s |
| Celá sada **počas záťažového smoke testu k6, ktorý nasýtil jedno jadro** | 64/64, 11.4 s |

Posledný riadok je podstatný: pokus navrhnutý na vyvolanie problému
ho nevyvolal.

<a id="leading-suspicion-unconfirmed"></a>

## Hlavné podozrenie, nepotvrdené

Každý end-to-end test registruje vlastného používateľa a registrácia
v tom čase vykonávala `bcrypt.hashSync` — približne 55 ms blokovania
slučky udalostí na pokus, nameraných v S07. Štyria súbežní pracovníci
na zaťaženom počítači by mohli server zahltiť natoľko, že sa stránka
zastaví uprostred vykresľovania.

Bol to zvyšný problém z [BUG-004](BUG-004-bcrypt-blocks-event-loop.md)
a odvtedy sa opravil — registrácia je teraz asynchrónna. **Ak bolo
podozrenie správne, tento defekt už zmizol**; overí to až čas:
tretí výskyt by ho priamo vyvrátil. Zaznamenaná predpoveď pomôže
vyhodnotiť ďalší beh.

Je to podozrenie, nie príčina. Záťažový pokus vyššie ho mal vyvolať,
ale nevyvolal.

<a id="what-was-not-done-and-why"></a>

## Čo sa neurobilo a prečo

Časové limity `expect` ani testu sa **nezvýšili**.

Príznak by tak zmizol bez akéhokoľvek poznania a vlastné výstupné
kritérium 6 projektu (`qa/docs/test-plan.md`) to výslovne zakazuje:
test môže začať prechádzať po zmene aplikácie, nie po uvoľnení tvrdenia.
Zvýšiť limit na uzavretie defektu je presný príklad toho, čomu má
kritérium predísť.

<a id="s15--ci-now-has-a-baseline-and-it-is-not-a-slow-run"></a>

## S15 — CI už má východiskovú hodnotu a nejde o pomalý beh

Prvý zelený beh CI trval **38.3 s** pri 92 testoch, ktoré tu trvajú
13.9 s. To je 2.8× a vyzerá to presne ako charakteristický vzor
tohto defektu. Bolo lákavé to tak zapísať.

Rozhodli ďalšie dva behy:

| Beh | Trvanie |
|---|---|
| 1 | 38.3 s |
| 2 | 36.7 s |
| 3 | 36.6 s |

Rozptyl 1.7 s medzi tromi behmi je **východisková hodnota**,
nie pomalý beh. CI je jednoducho pomalší počítač než lokálny desktop
— štyri zdieľané vCPU oproti desktopu — a 37 s je jeho norma.

**Charakteristický vzor sa vždy vzťahoval na normál danej mašiny**.
Považovať „2.8× pomalšie než lokálne“ za „2.8× pomalšie než obvykle“
bola chyba, ktorú sa podarilo opraviť v rámci jednej relácie.
Dve čísla s trojnásobným rozdielom nepredstavujú automaticky
to isté pozorovanie.

Skutočný prínos: CI má teraz *východiskovú hodnotu*. Beh trvajúci
110 s by tam zodpovedal vzoru a na rozdiel od tohto počítača
si CI uchováva časy každého behu na neskoršiu kontrolu.

**Stále otvorené.** Nič sa neopakovalo a podozrenie týkajúce sa bcrypt
nie je potvrdené ani vyvrátené.

<a id="next-step-when-it-recurs"></a>

## Ďalší krok pri opakovaní

Zachytiť zlyhávajúci beh s `--trace on` a časovaním `PWDEBUG`,
spolu s časmi požiadaviek na serveri, aby bolo možné vidieť
radenie do frontu namiesto hádania. Tretí výskyt umožní
otestovať vyššie uvedené podozrenie.

<a id="-no-rule-yet"></a>

## → Zatiaľ bez pravidla

Pravidlo odvodené z necharakterizovaného zlyhania by bolo len odhadom
s pripojeným číslom.


</details>
