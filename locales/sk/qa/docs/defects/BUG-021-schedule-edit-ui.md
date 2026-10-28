[English](../../../../../qa/docs/defects/BUG-021-schedule-edit-ui.md) · **Slovenčina**

<a id="bug-021--schedules-cannot-be-edited-through-the-interface"></a>

# BUG-021 · Plánované platby sa nedali upravovať cez rozhranie

[← Späť na README](../../../README.md#qa-evidence) · [Register chýb](../../../log/BUGS.md) · [Ďalej: index správ →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Aplikácia nemala v rozhraní použiteľnú cestu na úpravu plánovanej platby, hoci sa vyžadoval scenár úpravy.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Chyba |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Vysoká |
| Priorita | Samostatne nezaznamenaná |
| Komponent | `public/app.js` loadSchedules / submitSchedule; `public/index.html` |
| Nájdené / dotknutá zostava | S21; presná zostava len tam, kde je zaznamenaná nižšie |
| Prostredie / frekvencia | Samostatne nezaznamenané; nevyvodzujte frekvenciu z neskorších zelených behov |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie dáta

S21, revízia spec voči UI a živá kontrola Schedules

<a id="reproduction"></a>

## Reprodukcia

1. Vytvorte plánovanú platbu, otvorte Schedules a skúste cez UI zmeniť názov, sumu alebo deň splatnosti.

Tento krok opakuje datovaný historický postup; nejde o novo vykonaný test.

<a id="expected-and-requirement"></a>

## Očakávané správanie a požiadavka

Pridanie alebo úprava cez formulár podľa spec §6.4.

<a id="actual-observation"></a>

## Skutočné pozorovanie

Riadky zoznamu sú neinteraktívne; formulár iba vytvára. V sonde
obsahujú 2 riadky plánovaných platieb 0 tlačidiel/odkazov/vstupov/prvkov role=button.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `public/app.js`](../../../../../public/app.js)
- [Zaznamenaný zdroj: `public/index.html`](../../../../../public/index.html)
- [Zaznamenaný zdroj: `qa/docs/test-report-schedule-editing.md`](../test-report-schedule-editing.md)
- [Úplný pôvodný register, zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — nájdite nadpis `BUG-021`.

<a id="resolution-and-verification"></a>

## Vyriešenie a overenie

Aktuálny stav registra: **CLOSED**. Datované zosúladenie zaznamenáva: [zlyhanie úpravy plánovaných platieb pred opravou a lokálnu regresiu](../test-report-schedule-editing.md), publikované s Playwright CI, plus [PASS vlastníka produktu z úpravy plánovanej platby na aktuálnej zostave 2026-10-19 a akceptáciu testovanej zostavy](../uat-current-build.md#owner-record--reported-2026-10-19). Uzatvára sa konkrétna chyba chýbajúcej úpravy; agent nevykonal UAT ani nezískal všeobecnú výnimku z rizík.

Pôvodné skúmanie nižšie môže používať skorší štítok `IN PROGRESS` alebo „local/uncommitted“. Je zachované ako historický dôkaz, nie ako konkurenčný aktuálny stav. Táto migrácia dokumentácie nespustila nový scenár.

<a id="technical-investigation-and-dated-history"></a>

## Technické skúmanie a datovaná história

<details>
<summary>Otvoriť pôvodnú podrobnú správu/pozorovanie</summary>

<a id="bug-021--schedules-cannot-be-edited-through-the-interface--high--in-progress"></a>

### BUG-021 · Plánované platby sa nedali upravovať cez rozhranie · High · IN PROGRESS

| | |
|---|---|
| Nájdené v | S21, revízia spec voči UI a živá kontrola Schedules |
| Komponent | `public/app.js` loadSchedules / submitSchedule; `public/index.html` |

Kroky, očakávaný/skutočný výsledok a „Fix: not applied“ nižšie zachovávajú
pôvodné pozorovanie S21 pred opravou; nasleduje datovaná aktualizácia.

**Kroky reprodukcie:** vytvorte plánovanú platbu, otvorte Schedules a skúste cez UI
zmeniť názov, sumu alebo deň splatnosti.
**Očakávané:** pridanie alebo úprava cez formulár podľa spec §6.4.
**Skutočnosť:** riadky zoznamu sú neinteraktívne; formulár iba vytvára. V sonde
obsahujú 2 riadky plánovaných platieb 0 tlačidiel/odkazov/vstupov/prvkov role=button.
**Príčina:** PATCH na API existuje, ale k riadkom plánovaných platieb nie je
pripojený stav úpravy UI ani handler aktualizácie. Samotný endpoint nespĺňa §6.4.
**Oprava:** neaplikovaná. Implementujte chýbajúce UI alebo získajte explicitné
rozhodnutie o rozsahu; neprepisujte spec iba preto, aby súčasný kód vyzeral úplný.
**Regresia:** potvrdené v zdroji a prehliadači; treba pridať skutočný test úpravy
plánovanej platby v UI.
**→ Pravidlo R14.**

**Lokálny dodatok, 2026-10-17:** pôvodné pozorovanie a starší odkaz §6.4
vyššie zostávajú historické. Riadená prehliadačová kontrola najprv zlyhala
na chýbajúcej akcii Edit. Lokálna oprava UI teraz poskytuje natívny modál
pre vlastnený riadok a používa existujúci endpoint PATCH. Jej prvý širší
beh odhalil novú implementačnú chybu chýbajúceho HTML-`id`; bola diagnostikovaná
zo zachovanej stopy chyby stránky a opravená. Konečná
[lokálna správa F09](../test-report-schedule-editing.md)
zaznamenáva kontroly uložených polí/životného cyklu a klávesnice aj celý
spravovaný prehliadačový beh. Cielená nezávislá agentova revízia prijala F09
lokálne 2026-10-17. Stav je **IN PROGRESS**, nie CLOSED: zostávajú
overenie kombinovaného stromu, vzdialené CI pre presné SHA, publikovanie
a UAT vlastníka. Táto revízia nezistila ďalšiu známu chybu úpravy
plánovaných platieb.

</details>
