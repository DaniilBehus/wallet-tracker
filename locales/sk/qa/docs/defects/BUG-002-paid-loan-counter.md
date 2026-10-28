[English](../../../../../qa/docs/defects/BUG-002-paid-loan-counter.md) · **Slovenčina**

<a id="bug-002--a-fully-paid-loan-still-shows-one-instalment-left"></a>

# BUG-002 · Úplne splatená pôžička stále ukazovala jednu zostávajúcu splátku

[← Späť na README](../../../README.md#qa-evidence) · [Register chýb](../../../log/BUGS.md) · [Ďalej: index správ →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Po poslednej splátke pôžičky riadok ukazoval dokončený stav, ale stále tvrdil, že zostáva jedna splátka a peniaze.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Chyba |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Vysoká |
| Priorita | Samostatne nezaznamenaná |
| Komponent | `public/app.js` — `paySchedule`, `markRowFinished` |
| Nájdené / dotknutá zostava | S03; presná zostava len tam, kde je zaznamenaná nižšie |
| Prostredie / frekvencia | Samostatne nezaznamenané; nevyvodzujte frekvenciu z neskorších zelených behov |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie dáta

S03, splácanie pôžičky s 3 splátkami až do konca na obrazovke Upcoming

<a id="reproduction"></a>

## Reprodukcia

1. Vytvorte pôžičku s `total_count = 3`.
2. Otvorte Upcoming a trikrát stlačte `Zaplatiť`.
3. Prečítajte riadok odpočtu pri tejto položke.

<a id="expected-and-requirement"></a>

## Očakávané správanie a požiadavka

`zostáva 0 z 3 · 0,00 €` popri dokončenom stave. Spec §4.2:
po poslednej platbe je `remaining_count` 0 a odpoveď nesie
`"finished": true` **„so the UI can celebrate“**.

<a id="actual-observation"></a>

## Skutočné pozorovanie

Riadok ukazoval dokončený stav (`Splatené 🎉`, tlačidlo Pay zmizlo), ale odpočet po poslednej platbe stále ukazoval `zostáva 1 z 3 · 100,00 €`.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `public/app.js`](../../../../../public/app.js)
- [Úplný pôvodný register, zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — nájdite nadpis `BUG-002`.
- [GitHub Issue #2](https://github.com/DaniilBehus/wallet-tracker/issues/2) — externé metadáta sa môžu líšiť; dokumentačnou autoritou stavu je lokálny register.

<a id="resolution-and-verification"></a>

## Vyriešenie a overenie

**CLOSED.** Cesta DOM pre poslednú platbu teraz používa tú istú funkciu `remainingText(...)` ako prvé vykreslenie a `remaining_count` z odpovede Pay. V zaznamenanej regresii s dvomi splátkami sa odpočet zmenil z `2 z 2 · 100,00 €` na `1 z 2 · 50,00 €` a napokon na `0 z 2 · 0,00 €`; dokončený riadok zostal viditeľný a tlačidlo Pay zmizlo. Pri tomto prepise sa nespustil nový test.

<a id="technical-investigation-and-dated-history"></a>

## Technické skúmanie a datovaná história

<details>
<summary>Otvoriť pôvodnú podrobnú správu/pozorovanie</summary>

<a id="bug-002--a-fully-paid-loan-still-shows-one-instalment-left--high--closed"></a>

### BUG-002 · Úplne splatená pôžička stále ukazovala jednu zostávajúcu splátku · High · CLOSED

| | |
|---|---|
| Nájdené v | S03, splácanie pôžičky s 3 splátkami až do konca na obrazovke Upcoming |
| Komponent | `public/app.js` — `paySchedule`, `markRowFinished` |

**Kroky reprodukcie:**
1. Vytvorte pôžičku s `total_count = 3`.
2. Otvorte Upcoming a trikrát stlačte `Zaplatiť`.
3. Prečítajte riadok odpočtu pri tejto položke.

**Očakávané:** `zostáva 0 z 3 · 0,00 €` popri dokončenom stave. Spec §4.2:
po poslednej platbe je `remaining_count` 0 a odpoveď nesie
`"finished": true` **„so the UI can celebrate“**.

**Skutočnosť:** dokončený stav sa objavil správne — zelený riadok,
`Splatené 🎉`, tlačidlo Pay zmizlo — ale odpočet stále ukazoval:

```
zostáva 1 z 3 · 100,00 €
```

Pôžička, ktorú používateľ práve splatil, tvrdila, že stále dlží jednu splátku.

**Príčina:** riadok aktualizovali dve cesty kódu a iba jedna zapisovala
odpočet. Platba, ktorá pôžičku nedokončí, volá `loadUpcoming()`, čím
znovu vykreslí každý riadok zo servera a je preto vždy aktuálna. Posledná
platba úmyselne **nenačíta** zoznam — ten je filtrovaný na `active=1`,
takže obnovenie by riadok odstránilo a používateľ by nikdy nevidel
dokončenie — namiesto toho upraví riadok na mieste cez `markRowFinished`.
To zmenilo štýl a odstránilo tlačidlo, ale nedotklo sa textu. Zobrazený
počet zostal z predchádzajúceho vykreslenia.

Je to ten istý typ zlyhania, proti ktorému je navrhnutá spec v §5 odmietnutím
ukladať `next_due` a `remaining_count`: odvodená hodnota uložená inde
než tam, kde sa počíta, zostarne. Server toto pravidlo dodržiava;
DOM sa potichu stal druhým miestom uchovania hodnoty.

**Oprava:** reťazec odpočtu teraz tvorí jediná funkcia
`remainingText(total_count, remaining_count, amount_cents)`, ktorú
volá prvé vykreslenie aj posledná platba — tá odovzdáva `remaining_count`
priamo z odpovede `PATCH /pay`. Zostávajú dvaja zapisovači, ale text
už nemôžu vytvoriť odlišne.

**Regresia:** čerstvá pôžička s 2 splátkami zaplatená do konca, s čítaním
odpočtu po každom kroku:

```
start       zostáva 2 z 2 · 100,00 €
after 1st   zostáva 1 z 2 · 50,00 €
after 2nd   zostáva 0 z 2 · 0,00 €
finished    row--done: true, "Splatené 🎉", pay button removed
```

**→ Pravidlo R3.**

---

</details>
