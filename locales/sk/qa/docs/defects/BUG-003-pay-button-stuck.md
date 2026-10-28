[English](../../../../../qa/docs/defects/BUG-003-pay-button-stuck.md) · **Slovenčina**

<a id="bug-003--pay-button-stays-on-its-busy-label-after-a-refused-payment"></a>

# BUG-003 · Tlačidlo Pay zostalo po odmietnutej platbe v stave zaneprázdnenia

[← Späť na README](../../../README.md#qa-evidence) · [Register chýb](../../../log/BUGS.md) · [Ďalej: index správ →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Odmietnutá platba plánovanej položky ukázala správne hlásenie konfliktu, ale tlačidlo Pay zostalo natrvalo označené ako zaneprázdnené.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Chyba |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Stredná |
| Priorita | P1 — ovládací prvok, ktorý nesprávne opisuje svoju funkciu |
| Komponent | `public/app.js` — `paySchedule`, `withBusy` |
| Nájdené / dotknutá zostava | S04; presná zostava len tam, kde je zaznamenaná nižšie |
| Prostredie / frekvencia | Chromium, viewporty Pixel 5 a desktop, lokálny server; frekvencia iba ak je uvedená nižšie |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie dáta

S04, pomocou TC-E2E-030 (`qa/e2e/pay-conflict.spec.js`) — prípad napísaný na základe podozrenia, nie spontánneho zlyhania

<a id="reproduction"></a>

## Reprodukcia

1. Vytvorte pôžičku s `total_count = 1` a otvorte Upcoming.
2. Uzavrite pôžičku inde — v druhej karte, na inom zariadení alebo priamym
   `PATCH /api/schedules/:id/pay`. Obrazovku neobnovujte.
3. Stlačte `Zaplatiť`.

<a id="expected-and-requirement"></a>

## Očakávané správanie a požiadavka

Konflikt sa nahlási a tlačidlo sa vráti k ponuke
akcie — `Zaplatiť`, zapnuté, s nezmeneným prístupným názvom. Spec §4.2
uvádza 409 ako zdokumentovaný prechod stavu, takže rozhranie ho musí zvládnuť.

<a id="actual-observation"></a>

## Skutočné pozorovanie

Hlásenie konfliktu sa objavilo, ale tlačidlo zostalo na `Platím…`, kým jeho prístupný názov stále hovoril `Zaplatiť Posledná splátka`. Viditeľný a oznámený stav si po 409 odporovali.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `public/app.js`](../../../../../public/app.js)
- [Zaznamenaný zdroj: `qa/e2e/upcoming.spec.js`](../../../../../qa/e2e/upcoming.spec.js)
- [Úplný pôvodný register, zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — nájdite nadpis `BUG-003`.
- [GitHub Issue #3](https://github.com/DaniilBehus/wallet-tracker/issues/3) — externé metadáta sa môžu líšiť; dokumentačnou autoritou stavu je lokálny register.

<a id="resolution-and-verification"></a>

## Vyriešenie a overenie

**CLOSED.** `withBusy` teraz pred dočasným zaneprázdneným štítkom uloží pôvodný text a v `finally` ho obnoví. Zaznamenaná regresia TC-E2E-030 ponechala po odmietnutí tlačidlo zapnuté a označené `Zaplatiť`; nasledujúci celý prehliadačový beh hlásil **60 úspešných (11.6 s)**. Ide o datovaný dôkaz, nie nový beh.

<a id="technical-investigation-and-dated-history"></a>

## Technické skúmanie a datovaná história

<details>
<summary>Otvoriť pôvodnú podrobnú správu/pozorovanie</summary>

<a id="original-report-bug-003--the-pay-button-stays-on-its-busy-label-after-a-refused-payment"></a>

### Pôvodná správa: BUG-003 · Tlačidlo Pay zostalo po odmietnutej platbe v stave zaneprázdnenia

[← Späť na README](../../../README.md#qa-evidence) · [Ďalej: prehliadačové regresné testy →](../../../../../qa/e2e/upcoming.spec.js)

![severity](https://img.shields.io/badge/severity-Medium-yellow?style=flat-square)
![state](https://img.shields.io/badge/state-CLOSED-brightgreen?style=flat-square)

| | |
|---|---|
| **Závažnosť** | Medium |
| **Priorita** | P1 — ovládací prvok, ktorý nesprávne opisuje svoju funkciu |
| **Stav** | CLOSED 2026-09-02 |
| **Našiel** | TC-E2E-030, `qa/e2e/pay-conflict.spec.js` |
| **Komponent** | `public/app.js` — `paySchedule`, `withBusy` |
| **Dotýka sa** | obrazovka Upcoming (spec §6.3) |
| **Prostredie** | Chromium, viewporty Pixel 5 a desktop, lokálny server |
| **Opravené v** | Opravené. Pôvodný commit nie je súčasťou tohto verejného snapshotu. |
<a id="summary"></a>

## Súhrn

Keď server odmietne platbu, tlačidlo `Zaplatiť` si natrvalo ponechá
dočasný štítok `Platím…`. Zostáva tak až do opätovného vykreslenia
obrazovky iným spôsobom a prístupný názov stále znie
`Zaplatiť <name>` — viditeľný text a názov čítaný čítačkou obrazovky
si teda odporujú v tom, čo tlačidlo robí.

<a id="steps-to-reproduce"></a>

## Kroky reprodukcie

1. Prihláste sa a vytvorte pôžičku s `total_count = 1`.
2. Otvorte **Čoskoro** (Upcoming). Riadok obsahuje tlačidlo `Zaplatiť`.
3. Uzavrite pôžičku inde — v druhej karte, na inom zariadení alebo priamym
   `PATCH /api/schedules/:id/pay`. Obrazovka sa neobnoví.
4. Stlačte `Zaplatiť` na stále otvorenej obrazovke.

<a id="expected"></a>

## Očakávané

Zobrazí sa chybové hlásenie a tlačidlo znovu ponúkne akciu:
štítok `Zaplatiť`, zapnuté, prístupný názov nezmenený. Spec §4.2
považuje túto cestu za bežný očakávaný prechod stavu — 409 je
zdokumentovaná odpoveď, nie pád — preto sa rozhranie musí obnoviť
do použiteľného stavu.

<a id="actual"></a>

## Skutočnosť

Hlásenie je správne: *Táto platba je už uzavretá.* Tlačidlo zostane:

```html
<button data-testid="schedule-pay-60" aria-label="Zaplatiť Posledná splátka">Platím…</button>
```

Je zapnuté, klikateľné, ale natrvalo má správu o priebehu už dokončenej operácie.

<details>
<summary>Výstup testu</summary>

```
Expected: "Zaplatiť"
Received: "Platím…"
    14 × locator resolved to <button … aria-label="Zaplatiť Posledná splátka">Platím…</button>
```

</details>

<a id="root-cause"></a>

## Príčina

Chyba poradia medzi volajúcim a pomocnou funkciou, nie chyba logiky jednej z nich.

`withBusy(button, fn)` zakazuje tlačidlo počas asynchrónnej akcie.
Najprv uloží `button.textContent` a v `finally` ho obnoví, takže
tlačidlo nakoniec vyzerá ako na začiatku.

`paySchedule` nastavilo štítok zaneprázdnenia **samo, jeden riadok pred volaním funkcie**:

```js
button.textContent = T.paying;      // 'Platím…'
await withBusy(button, async () => { … });
```

Snapshot teda zachytil `Platím…` namiesto `Zaplatiť` a obnovenie, ktoré
malo zmenu vrátiť, ju natrvalo zachovalo. Každý ďalší volajúci `withBusy`
bol správny, pretože žiadny štítok nemenil — preto sa chyba objavila
presne na jednom tlačidle.

Na úspešnej ceste zostala skrytá: úspešná platba znovu vykreslí celý
zoznam a čerstvé tlačidlo má správny štítok. Iba cesta bez opätovného
vykreslenia — odmietnutie — ponechá poškodené tlačidlo na obrazovke.
Chyba viditeľná iba na chybovej ceste je presne dôvod pre end-to-end
testy chybových ciest.

<a id="fix"></a>

## Oprava

Štítok zaneprázdnenia sa presunul do pomocnej funkcie za snapshot
ako voliteľný tretí argument:

```js
async function withBusy(button, fn, busyLabel) {
  const label = button ? button.textContent : null;   // snapshot first
  if (button) {
    button.disabled = true;
    if (busyLabel) button.textContent = busyLabel;    // then change
  }
  …
}
```

`paySchedule` odovzdáva `T.paying` a sama tlačidlo nemení.
Pomocná funkcia teraz vlastní obe polovice zmeny, takže nemôže
obnoviť štítok, ktorý nenastavila.

<a id="regression"></a>

## Regresia

TC-E2E-030 zostáva regresným prípadom v sade. Nasledujúci celý beh:

```
60 passed (11.6s)
```

<a id="-rule-r5"></a>

## → Pravidlo R5

Pomocná funkcia, ktorá obnovuje stav, musí byť jediným miestom, ktoré
ho mení. Ak volajúci zmení hodnotu zachytávanú pomocnou funkciou,
„obnovenie“ zapíše späť dočasnú hodnotu a zmena sa stane trvalou.

</details>
