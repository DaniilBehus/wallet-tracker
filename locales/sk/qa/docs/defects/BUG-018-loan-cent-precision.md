[English](../../../../../qa/docs/defects/BUG-018-loan-cent-precision.md) · **Slovenčina**

<a id="bug-018--a-large-loan-loses-an-integer-cent-in-remaining-money"></a>

# BUG-018 · Veľká pôžička strácala jeden celý cent zostávajúcej sumy

[← Späť na README](../../../README.md#qa-evidence) · [Register chýb](../../../log/BUGS.md) · [Ďalej: index správ →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Násobenie pri nadmernej pôžičke prekročilo hranicu bezpečného celého čísla a zostávajúca suma bola nesprávna o jeden cent.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Chyba |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Kritická |
| Priorita | Samostatne nezaznamenaná |
| Komponent | totalCount v `src/validate.js`; tvar v `src/routes/schedules.js` |
| Nájdené / dotknutá zostava | S21; presná zostava len tam, kde je zaznamenaná nižšie |
| Prostredie / frekvencia | Samostatne nezaznamenané; nevyvodzujte frekvenciu z neskorších zelených behov |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie dáta

S21, sonda plánovanej platby s veľkým počtom a presné porovnanie BigInt

<a id="reproduction"></a>

## Reprodukcia

1. Vytvorte platnú pôžičku s amount_cents=99999999 a total_count=99999999; porovnajte remaining_cents s presným celočíselným súčinom.

Tento krok opakuje datovaný historický postup; nejde o novo vykonaný test.

<a id="expected-and-requirement"></a>

## Očakávané správanie a požiadavka

9999999800000001 centov alebo riadené odmietnutie nepodporovaných
súčtov; invariant peňazí v spec zakazuje potichu nesprávne centy.

<a id="actual-observation"></a>

## Skutočné pozorovanie

201 s 9999999800000000 centmi, teda nebezpečným celým číslom JavaScriptu.
Prijíma sa aj total_count=1e30. Sú to extrémne syntetické vstupy.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `src/validate.js`](../../../../../src/validate.js)
- [Zaznamenaný zdroj: `src/routes/schedules.js`](../../../../../src/routes/schedules.js)
- [Zaznamenaný zdroj: `public/app.js`](../../../../../public/app.js)
- [Zaznamenaný zdroj: `qa/api/wallet.postman_collection.json`](../../../../../qa/api/wallet.postman_collection.json)
- [Úplný pôvodný register, zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — nájdite nadpis `BUG-018`.

<a id="resolution-and-verification"></a>

## Vyriešenie a overenie

Aktuálne rozhodnutie: **CLOSED**. Pole opravy v registri: bd516ac. Tento stav sa vzťahuje iba na zdokumentovaný nález a jeho vlastný regresný dôkaz.

TC-API-109 (1200 splátok pri strope sumy: 201 a `remaining_cents`
presne 99999999 × 1200, s kontrolou bezpečného celého čísla),
TC-API-110 (1201 → 400), TC-API-111 (nahlásená pôžička, 99999999 × 99999999 →
400), TC-API-112 (1e30 → 400) a TC-API-113 (rovnaký strop pri `PATCH`) v
`qa/api/wallet.postman_collection.json`; TC-E2E-075 v `qa/e2e/schedules.spec.js`
pre formulár, ktorý tiež kontroluje, že sa nič neodošle. Kontroly: po
odstránení stropu počtu zlyhá 6 zo 650 asercií Newmana — a dve extrémne
pôžičky stále odmieta produktová kontrola; po odstránení oboch kontrol
zlyhá 12 a nahlásená pôžička sa znova prijme. Po odstránení klientského
stropu TC-E2E-075 zlyhá v oboch viewportoch. Keď je všetko zapnuté:
650 zo 650 a 16 zo 16.

<a id="technical-investigation-and-dated-history"></a>

## Technické skúmanie a datovaná história

<details>
<summary>Otvoriť pôvodnú podrobnú správu/pozorovanie</summary>

<a id="bug-018--a-large-loan-loses-an-integer-cent-in-remaining-money--critical--closed"></a>

### BUG-018 · Veľká pôžička strácala jeden celý cent zostávajúcej sumy · Critical · CLOSED

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

</details>
