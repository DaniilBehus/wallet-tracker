[English](../../../../../qa/docs/defects/BUG-017-password-byte-limit.md) · **Slovenčina**

<a id="bug-017--password-suffixes-after-72-bytes-are-silently-ignored"></a>

# BUG-017 · Koncovky hesiel po 72 bajtoch sa potichu ignorovali

[← Späť na README](../../../README.md#qa-evidence) · [Register chýb](../../../log/BUGS.md) · [Ďalej: index správ →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

bcrypt ignoroval bajty hesla za svojím limitom 72 bajtov, takže odlišné dlhé heslá sa mohli autentifikovať, akoby boli rovnaké.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Chyba |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Vysoká |
| Priorita | Samostatne nezaznamenaná |
| Komponent | `src/auth.js` — validácia hesla a bcrypt |
| Nájdené / dotknutá zostava | S21; presná zostava len tam, kde je zaznamenaná nižšie |
| Prostredie / frekvencia | Samostatne nezaznamenané; nevyvodzujte frekvenciu z neskorších zelených behov |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie dáta

S21, izolovaná sonda hranice registrácie/prihlásenia

<a id="reproduction"></a>

## Reprodukcia

1. Použite syntetické heslo zo 72 ASCII bajtov `a` nasledovaných `A`; zaregistrujte sa a potom sa prihláste s rovnakými 72 bajtmi nasledovanými `B`.

Tento krok opakuje datovaný historický postup; nejde o novo vykonaný test.

<a id="expected-and-requirement"></a>

## Očakávané správanie a požiadavka

Odmietnuť nepodporovanú dĺžku alebo rozlišovať prijaté heslá.

<a id="actual-observation"></a>

## Skutočné pozorovanie

Registrácia 201, prihlásenie so zmenenou koncovkou 200. Nejde o ľubovoľné
obídenie hesla: prvých 72 bajtov musí byť rovnakých.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `src/auth.js`](../../../../../src/auth.js)
- [Zaznamenaný zdroj: `public/app.js`](../../../../../public/app.js)
- [Zaznamenaný zdroj: `qa/api/wallet.postman_collection.json`](../../../../../qa/api/wallet.postman_collection.json)
- [Zaznamenaný zdroj: `qa/e2e/auth.spec.js`](../../../../../qa/e2e/auth.spec.js)
- [Úplný pôvodný register, zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — nájdite nadpis `BUG-017`.

<a id="resolution-and-verification"></a>

## Vyriešenie a overenie

Aktuálne rozhodnutie: **CLOSED**. Pole opravy v registri: 53b310b. Tento stav sa vzťahuje iba na zdokumentovaný nález a jeho vlastný regresný dôkaz.

TC-API-106 (72 ASCII bajtov stále prijatých, 201), TC-API-107
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

<a id="technical-investigation-and-dated-history"></a>

## Technické skúmanie a datovaná história

<details>
<summary>Otvoriť pôvodnú podrobnú správu/pozorovanie</summary>

<a id="bug-017--password-suffixes-after-72-bytes-are-silently-ignored--high--closed"></a>

### BUG-017 · Koncovky hesiel po 72 bajtoch sa potichu ignorovali · High · CLOSED

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

</details>
