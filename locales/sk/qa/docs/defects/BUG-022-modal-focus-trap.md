[English](../../../../../qa/docs/defects/BUG-022-modal-focus-trap.md) · **Slovenčina**

<a id="bug-022--expense-overlay-does-not-contain-keyboard-focus"></a>

# BUG-022 · Vizuálny editor výdavkov neudržiaval fokus klávesnice

[← Späť na README](../../../README.md#qa-evidence) · [Register chýb](../../../log/BUGS.md) · [Ďalej: index správ →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Fokus klávesnice mohol opustiť prekryvný editor výdavkov, takže viditeľnému modálu chýbalo udržanie fokusu.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Chyba |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Stredná |
| Priorita | Samostatne nezaznamenaná |
| Komponent | `public/index.html` #tx-edit-sheet; handlery editora `public/app.js` |
| Nájdené / dotknutá zostava | S21; presná zostava len tam, kde je zaznamenaná nižšie |
| Prostredie / frekvencia | Samostatne nezaznamené; nevyvodzujte frekvenciu z neskorších zelených behov |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie dáta

S21, kontrola klávesnice a sémantiky v Chromiu

<a id="reproduction"></a>

## Reprodukcia

1. Otvorte editor výdavku; stlačte Escape; potom fokusujte Cancel a stlačte Tab.

Tento krok opakuje datovaný historický postup; nejde o novo vykonaný test.

<a id="expected-and-requirement"></a>

## Očakávané správanie a požiadavka

Prístupný modálny editor drží fokus vo svojich ovládacích prvkoch,
podporuje jasné zatvorenie a obnoví fokus po zatvorení.

<a id="actual-observation"></a>

## Skutočné pozorovanie

Escape ho nechá otvorený; Tab prejde na nav-add mimo editora.
Editor nemá rolu dialog ani atribút aria-modal.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `public/index.html`](../../../../../public/index.html)
- [Zaznamenaný zdroj: `public/app.js`](../../../../../public/app.js)
- [Zaznamenaný zdroj: `qa/docs/test-report-modal-bind.md`](../test-report-modal-bind.md)
- [Úplný pôvodný register, zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — nájdite nadpis `BUG-022`.

<a id="resolution-and-verification"></a>

## Vyriešenie a overenie

Aktuálny stav registra: **CLOSED**. Datované zosúladenie zaznamenáva: [správu o modáli/fokuse](../test-report-modal-bind.md), publikovaný natívny dialóg a prehliadačové CI/prístupnosti. Uzatvára to konkrétnu chybu udržania fokusu, nie ľudský audit prístupnosti ani certifikáciu WCAG.

Pôvodné skúmanie nižšie môže používať skorší štítok `IN PROGRESS` alebo „local/uncommitted“. Je zachované ako historický dôkaz, nie ako konkurenčný aktuálny stav. Táto migrácia dokumentácie nespustila nový scenár.

<a id="technical-investigation-and-dated-history"></a>

## Technické skúmanie a datovaná história

<details>
<summary>Otvoriť pôvodnú podrobnú správu/pozorovanie</summary>

<a id="bug-022--expense-overlay-does-not-contain-keyboard-focus--medium--in-progress"></a>

### BUG-022 · Vizuálny editor výdavkov neudržiaval fokus klávesnice · Medium · IN PROGRESS

| | |
|---|---|
| Nájdené v | S21, kontrola klávesnice a sémantiky v Chromiu |
| Komponent | `public/index.html` #tx-edit-sheet; handlery editora `public/app.js` |

**Kroky reprodukcie:** otvorte editor výdavku; stlačte Escape; potom fokusujte Cancel
a stlačte Tab.
**Očakávané:** prístupný modálny editor drží fokus vo svojich ovládacích prvkoch,
podporuje jasné zatvorenie a obnoví fokus po zatvorení.
**Skutočnosť:** Escape ho nechá otvorený; Tab prejde na nav-add mimo editora.
Editor nemá rolu dialog ani atribút aria-modal.
**Príčina:** vizuálne prekrytie je implementované bez modálnej sémantiky,
udržania fokusu klávesnice alebo handlera Escape.
**Oprava:** neaplikovaná. Pridajte vhodný vzor dialógu a správanie klávesnice.
**Regresia:** reprodukované v prehliadači; treba pridať sémantické a klávesnicové regresie.
**→ Pravidlo R14.**

**Lokálna aktualizácia 2026-10-16 (pôvodné pozorovanie zachované):** editor je teraz
pomenovaný natívny modál s explicitným cyklením Tab medzi prvým/posledným prvkom,
upozornením na chybu v dialógu a overeným obnovením pri Escape/Cancel/kliknutí
na pozadie. Cielené lokálne dôkazy z prehliadača a axe sú v
[správe o modáli/binde](../test-report-modal-bind.md).
Nezávislá lokálna agentova revízia kódu/dôkazov prijala opravu modálu
2026-10-16. BUG-022 je **IN PROGRESS** do publikovania a overenia
kombinovaného stromu, nie preto, že by bola známa ďalšia chyba fokusu.
Táto datovaná aktualizácia nahrádza ukazovateľ stavu OPEN z 2026-10-13 nižšie;
skorší riadok „Fix: not applied“ zaznamenáva pôvodné pozorovanie, nie
aktuálny stav zdroja. Nevyvodzuje sa ľudský audit prístupnosti,
UAT vlastníka, vzdialené CI ani vydanie.

</details>
