[English](../../../../../qa/docs/defects/LIMIT-002-unkeyed-duplicate-post.md) · **Slovenčina**

<a id="limit-002--the-same-post-twice-creates-two-expenses-unkeyed-requests-keyed-saves-replay--d-035"></a>

# LIMIT-002 · Rovnaký POST dvakrát vytvorí dva výdavky (požiadavky bez kľúča; ukladanie s kľúčom sa opakuje — D-035)

[← Späť na README](../../../README.md#qa-evidence) · [Register chýb](../../../log/BUGS.md) · [Ďalej: index správ →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Dva rovnaké POST bez kľúča sú dve samostatné vytvorenia výdavku. Ukladanie s kľúčom neskôr získalo ochranu opakovania; správanie bez kľúča zostáva prijatou hranicou, nie chybou.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Prijaté obmedzenie návrhu |
| Stav | **ACCEPTED** — aktuálny kanonický register |
| Závažnosť | Nevzťahuje sa |
| Priorita | Samostatne nezaznamenaná |
| Komponent | `src/routes/transactions.js` — `POST /` a neprítomnosť idempotency key |
| Nájdené / dotknutá zostava | S16; presná zostava len tam, kde je zaznamenaná nižšie |
| Prostredie / frekvencia | Samostatne nezaznamenané; nevyvodzujte frekvenciu z neskorších zelených behov |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie dáta

S16, scenár D v `qa/race/` — výslovne vyžiadaná kontrola

<a id="observation-or-measurement-procedure"></a>

## Postup pozorovania alebo merania

1. Dve bajtovo identické požiadavky `POST /api/transactions` odoslané pomocou `Promise.all` štyridsaťkrát.

Tento krok opakuje datovaný historický postup; nejde o novo vykonaný test.

<a id="expected-and-requirement"></a>

## Očakávané správanie a požiadavka

Toto prijaté obmedzenie nemá očakávaný výsledok v štýle chyby. Požiadavky bez kľúča sú samostatné uloženia; požiadavky s kľúčom sa opakujú podľa datovanej aktualizácie D-035 nižšie.

<a id="actual-observation"></a>

## Skutočné pozorovanie

Štyridsať párov bajtovo identických požiadaviek bez kľúča vždy vrátilo 201/201 a vytvorilo dva riadky. Ide o zaznamenané pozorovanie, nie vyvodené zlyhanie.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `qa/ai/tests/idempotency.test.js`](../../../../../qa/ai/tests/idempotency.test.js)
- [Zaznamenaný zdroj: `qa/race/`](../../../../../qa/race)
- [Zaznamenaný zdroj: `src/routes/transactions.js`](../../../../../src/routes/transactions.js)
- [Zaznamenaný zdroj: `qa/e2e/double-submit.spec.js`](../../../../../qa/e2e/double-submit.spec.js)
- [Úplný pôvodný register, zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — nájdite nadpis `LIMIT-002`.
- [GitHub Issue #15](https://github.com/DaniilBehus/wallet-tracker/issues/15) — externé metadáta sa môžu líšiť; dokumentačnou autoritou stavu je lokálny register.

<a id="resolution-and-verification"></a>

## Vyriešenie a overenie

**ACCEPTED, neopravené ako všeobecný zákaz duplicitných požiadaviek.** Každý zo 40 zaznamenaných párov bez kľúča vrátil 201/201 a vytvoril dva výdavky. Klient, ktorý potrebuje bezpečné opakovanie, musí poslať platný `Idempotency-Key`: datovaná kontrola ukladania s kľúčom odoslala 20 súbežných požiadaviek s rovnakým kľúčom a zachovala jeden riadok. Cesta revízie AI taký kľúč posiela; bežná cesta klávesnice bez kľúča stále vytvorí nový výdavok pri úmyselnom druhom Save. Pri tomto prepise sa nespustil nový test.

<a id="technical-investigation-and-dated-history"></a>

## Technické skúmanie a datovaná história

<details>
<summary>Otvoriť pôvodnú podrobnú správu/pozorovanie</summary>

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

**Každý pár vytvoril duplicitu. Neexistovala žiadna deduplikácia.**

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

**→ Žiadne pravidlo.** Ochrana už existuje (`withBusy`) a predchádza
tejto kontrole.

---

</details>
