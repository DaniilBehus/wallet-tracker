[English](../../../../../qa/docs/defects/BUG-014-short-phone-categories.md) · **Slovenčina**

<a id="bug-014--categories-collapse-to-an-18-px-strip-on-a-short-phone"></a>

# BUG-014 · Kategórie sa na krátkom telefóne zrútili na pás vysoký 18 px

[← Späť na README](../../../README.md#qa-evidence) · [Register chýb](../../../log/BUGS.md) · [Ďalej: index správ →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Na krátkom telefóne sa výber kategórií zrútil na pás vysoký 18 px vedľa číselnej klávesnice.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Chyba |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Vysoká |
| Priorita | Samostatne nezaznamenaná |
| Komponent | `public/style.css` — flex rozloženie Add a ovládacie prvky s pevnou výškou |
| Nájdené / dotknutá zostava | S21; presná zostava len tam, kde je zaznamenaná nižšie |
| Prostredie / frekvencia | Samostatne nezaznamenané; nevyvodzujte frekvenciu z neskorších zelených behov |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie dáta

S21, skutočné Chromium pri 320×568

<a id="reproduction"></a>

## Reprodukcia

1. Prihláste sa s predvyplnenými predvolenými kategóriami; zmeňte veľkosť na 320×568; otvorte Add. Skontrolujte viditeľnú výšku skupiny Categories a snímku obrazovky.

Tento krok opakuje datovaný historický postup; nejde o novo vykonaný test.

<a id="expected-and-requirement"></a>

## Očakávané správanie a požiadavka

Čitateľné/voliteľné kategórie vedľa číselnej klávesnice (spec §6.1).

<a id="actual-observation"></a>

## Skutočné pozorovanie

clientHeight 18, scrollHeight 670. Štítky sú orezané na úzky
pás. Save zostáva viditeľné; horizontálna šírka dokumentu je správne 320.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `public/style.css`](../../../../../public/style.css)
- [Zaznamenaný zdroj: `qa/e2e/ai/add-layout.spec.js`](../../../../../qa/e2e/ai/add-layout.spec.js)
- [Úplný pôvodný register, zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — nájdite nadpis `BUG-014`.

<a id="resolution-and-verification"></a>

## Vyriešenie a overenie

Aktuálne rozhodnutie: **CLOSED**. Pole opravy v registri: publikované v `2face59`. Tento stav sa vzťahuje iba na zdokumentovaný nález a jeho vlastný regresný dôkaz.

`qa/e2e/ai/add-layout.spec.js`, napísaný a spustený najprv v červenom stave:
clientHeight 18 pri 320×568 a 108 pri 375×667 proti starému CSS (hranica
120). Po oprave: 4/4 na mobilnom a desktopovom projekte — zoznam ≥ 120 px, dva
riadky úplne viditeľné, bez horizontálneho pretečenia, zadanie sumy → kategórie → Save sa dokončí.
Patrí do sady AI, pretože chyba chráni obrazovku Add, na ktorej leží vstupný
bod AI.

<a id="technical-investigation-and-dated-history"></a>

## Technické skúmanie a datovaná história

<details>
<summary>Otvoriť pôvodnú podrobnú správu/pozorovanie</summary>

<a id="bug-014--categories-collapse-to-an-18-px-strip-on-a-short-phone--high--closed"></a>

### BUG-014 · Kategórie sa na krátkom telefóne zrútili na pás vysoký 18 px · High · CLOSED

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

</details>
