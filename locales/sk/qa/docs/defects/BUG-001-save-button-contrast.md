[English](../../../../../qa/docs/defects/BUG-001-save-button-contrast.md) · **Slovenčina**

<a id="bug-001--save-button-invisible--white-text-on-white-background"></a>

# BUG-001 · Tlačidlo Save nebolo viditeľné — biely text na bielom pozadí

[← Späť na README](../../../README.md#qa-evidence) · [Register chýb](../../../log/BUGS.md) · [Ďalej: index správ →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Ovládací prvok Save mal biely text na bielom pozadí: jeho štítok existoval v DOM, ale na obrazovke Add sa nedal čítať.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Chyba |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Vysoká |
| Priorita | Samostatne nezaznamenaná |
| Komponent | `public/style.css`, `public/index.html` |
| Nájdené / dotknutá zostava | S03; presná zostava len tam, kde je zaznamenaná nižšie |
| Prostredie / frekvencia | Samostatne nezaznamenané; nevyvodzujte frekvenciu z neskorších zelených behov |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie dáta

S03, prvý pohľad na obrazovku Add vo viewporte 375×812

<a id="reproduction"></a>

## Reprodukcia

1. Prihláste sa a prejdite na obrazovku Add.
2. Pozrite sa na pravý dolný kláves číselnej klávesnice.

<a id="expected-and-requirement"></a>

## Očakávané správanie a požiadavka

Primárnou akciou predvolenej obrazovky aplikácie je modré tlačidlo
s textom `Uložiť`. Spec §6.1 vyžaduje tlačidlo Save a patrí medzi tri
ťuknutia v definícii hotového stavu „two taps and a Save“ (§8, session 4).

<a id="actual-observation"></a>

## Skutočné pozorovanie

Kláves vyzeral prázdny, hoci `textContent` bol `"Uložiť"`: vypočítané farby pozadia a textu boli obe `rgb(255, 255, 255)`.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `public/style.css`](../../../../../public/style.css)
- [Zaznamenaný zdroj: `public/index.html`](../../../../../public/index.html)
- [Úplný pôvodný register, zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — nájdite nadpis `BUG-001`.
- [GitHub Issue #1](https://github.com/DaniilBehus/wallet-tracker/issues/1) — externé metadáta sa môžu líšiť; dokumentačnou autoritou stavu je lokálny register.

<a id="resolution-and-verification"></a>

## Vyriešenie a overenie

**CLOSED.** Samostatné pravidlo `.key--save.key` teraz nastavuje pozadie, okraj a farbu spolu, aby ich poradie rovnako špecifických pravidiel nerozdelilo. Zaznamenaná kontrola v prehliadači našla modré `rgb(61, 90, 254)` za bielym textom `rgb(255, 255, 255)` a potvrdila, že ostatné ovládacie prvky `.btn--primary` neboli dotknuté. Ide o datovaný dôkaz, nie nový beh.

<a id="technical-investigation-and-dated-history"></a>

## Technické skúmanie a datovaná história

<details>
<summary>Otvoriť pôvodnú podrobnú správu/pozorovanie</summary>

<a id="bug-001--save-button-invisible--white-text-on-white-background--high--closed"></a>

### BUG-001 · Tlačidlo Save nebolo viditeľné — biely text na bielom pozadí · High · CLOSED

| | |
|---|---|
| Nájdené v | S03, prvý pohľad na obrazovku Add vo viewporte 375×812 |
| Komponent | `public/style.css`, `public/index.html` |

**Kroky reprodukcie:**
1. Prihláste sa a prejdite na obrazovku Add.
2. Pozrite sa na pravý dolný kláves číselnej klávesnice.

**Očakávané:** primárnou akciou predvolenej obrazovky aplikácie je modré tlačidlo
s textom `Uložiť`. Spec §6.1 vyžaduje tlačidlo Save a patrí medzi tri
ťuknutia v definícii hotového stavu „two taps and a Save“ (§8, session 4).

**Skutočnosť:** prázdny biely kláves. Text bol po celý čas v DOM —
`textContent` bol `"Uložiť"` — a vykresľoval sa bielou na bielej:

```
{ bg: "rgb(255, 255, 255)", color: "rgb(255, 255, 255)", text: "Uložiť" }
```

**Príčina:** špecifickosť CSS rozhodnutá poradím v zdroji. Prvok mal
`.key` aj `.btn--primary`. Oba selektory majú špecifickosť (0,1,0), takže
vyhrá neskoršia deklarácia — a `.key` je v štýle napísané nižšie
než `.btn--primary`. `.key` nastavuje `background: var(--surface)`, ale nie `color`,
takže pozadie prišlo z `.key` (biele) a farba z `.btn--primary`
(biela). Samostatne nebolo nesprávne ani jedno pravidlo; ich dvojica
sa rozdelila poradím deklarácií a vyhrala polovica z každého.

**Oprava:** kláves uloženia prestal preberať `.btn--primary`. Má vlastné
pravidlo `.key--save.key` — špecifickosť (0,2,0), vyššiu než obe —
ktoré nastavuje pozadie, okraj a farbu spolu, takže ich poradie už
nemôže oddeliť.

**Regresia:** stránka sa znovu načítala a vypočítaný štýl sa znovu prečítal;
potvrdilo sa aj to, že ďalší dvaja používatelia `.btn--primary` (submit v `.auth`,
`.row__pay`) nikdy neboli dotknutí, pretože `.btn` je deklarované
*pred* `.btn--primary`, nie po ňom.

```
{ bg: "rgb(61, 90, 254)", color: "rgb(255, 255, 255)", text: "Uložiť" }
```

**→ Pravidlo R2.**

---

</details>
