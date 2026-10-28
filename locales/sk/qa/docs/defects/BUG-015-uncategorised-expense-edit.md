[English](../../../../../qa/docs/defects/BUG-015-uncategorised-expense-edit.md) · **Slovenčina**

<a id="bug-015--editing-an-uncategorised-expense-sends-category-zero"></a>

# BUG-015 · Úprava nekategorizovaného výdavku odosielala kategóriu nula

[← Späť na README](../../../README.md#qa-evidence) · [Register chýb](../../../log/BUGS.md) · [Ďalej: index správ →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Úprava iba poznámky nekategorizovaného výdavku odosielala kategóriu nula namiesto zachovania jeho null kategórie.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Chyba |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Stredná |
| Priorita | Samostatne nezaznamenaná |
| Komponent | `public/app.js` — openTransactionEditor / submitTransactionEdit |
| Nájdené / dotknutá zostava | S21; presná zostava len tam, kde je zaznamenaná nižšie |
| Prostredie / frekvencia | Samostatne nezaznamenané; nevyvodzujte frekvenciu z neskorších zelených behov |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie dáta

S21, úprava v prehliadači a zachytený stav PATCH

<a id="reproduction"></a>

## Reprodukcia

1. Vytvorte platný výdavok s vynechaným/null category_id; otvorte jeho riadok Month; zmeňte iba Note; uložte.

Tento krok opakuje datovaný historický postup; nejde o novo vykonaný test.

<a id="expected-and-requirement"></a>

## Očakávané správanie a požiadavka

Zmení sa iba poznámka a kategória zostane null (D-029).

<a id="actual-observation"></a>

## Skutočné pozorovanie

PATCH obsahuje category_id 0 a vracia 400. Výber pomenovanej
kategórie je obchádzka, ale nesprávne si vynucuje zmenu klasifikácie.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `public/app.js`](../../../../../public/app.js)
- [Zaznamenaný zdroj: `qa/e2e/editing.spec.js`](../../../../../qa/e2e/editing.spec.js)
- [Úplný pôvodný register, zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — nájdite nadpis `BUG-015`.

<a id="resolution-and-verification"></a>

## Vyriešenie a overenie

Aktuálne rozhodnutie: **CLOSED**. Pole opravy v registri: a399e79. Tento stav sa vzťahuje iba na zdokumentovaný nález a jeho vlastný regresný dôkaz.

TC-E2E-070 (úprava iba poznámky), TC-E2E-071 (uloženie bez zmeny neodosiela
žiadnu požiadavku) a TC-E2E-072 (výdavok vytvorený zaplatením plánovanej platby
bez kategórie) v `qa/e2e/editing.spec.js`. Čítajú PATCH zo siete
namiesto obrazovky, pretože chyba bola v obsahu požiadavky: asercia na
obrazovke by prešla hneď, ako by toast povedal „saved“. Kontrola:
po vrátení dvoch riadkov opravy všetky tri zlyhajú v oboch viewportoch (6 z
6); s opravou prechádza 18 z 18 v tomto súbore.

<a id="technical-investigation-and-dated-history"></a>

## Technické skúmanie a datovaná história

<details>
<summary>Otvoriť pôvodnú podrobnú správu/pozorovanie</summary>

<a id="bug-015--editing-an-uncategorised-expense-sends-category-zero--medium--closed"></a>

### BUG-015 · Úprava nekategorizovaného výdavku odosielala kategóriu nula · Medium · CLOSED

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

</details>
