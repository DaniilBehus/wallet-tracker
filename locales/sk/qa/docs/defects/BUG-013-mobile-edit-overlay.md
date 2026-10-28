[English](../../../../../qa/docs/defects/BUG-013-mobile-edit-overlay.md) · **Slovenčina**

<a id="bug-013--the-edit-panel-opened-underneath-the-bottom-navigation"></a>

# BUG-013 · Panel úpravy sa otvoril pod spodnou navigáciou

[← Späť na README](../../../README.md#qa-evidence) · [Register chýb](../../../log/BUGS.md) · [Ďalej: index správ →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Mobilný panel úpravy výdavku sa otvoril za spodnou navigáciou, čím znemožnil prístup k svojim ovládacím prvkom.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Chyba |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Stredná |
| Priorita | Samostatne nezaznamenaná |
| Komponent | `public/index.html`, `public/style.css` — panel úpravy |
| Nájdené / dotknutá zostava | S16; presná zostava len tam, kde je zaznamenaná nižšie |
| Prostredie / frekvencia | Samostatne nezaznamenané; nevyvodzujte frekvenciu z neskorších zelených behov |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie dáta

S16, zistené end-to-end sadou na viewporte telefónu

<a id="reproduction"></a>

## Reprodukcia

1. Pri 375×812 otvorte výdavok na úpravu a stlačte Save.

Tento krok opakuje datovaný historický postup; nejde o novo vykonaný test.

<a id="expected-and-requirement"></a>

## Očakávané správanie a požiadavka

Panel je nad všetkým a jeho tlačidlá sa dajú stlačiť.

<a id="actual-observation"></a>

## Skutočné pozorovanie

Na tlačidlo Save sa nedalo kliknúť. Playwright našiel
prvok, posunul sa k nemu, označil ho za „visible, enabled and stable“ —
kliknutie však nedopadlo, pretože nad ním bola pevná spodná navigácia.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `public/index.html`](../../../../../public/index.html)
- [Zaznamenaný zdroj: `public/style.css`](../../../../../public/style.css)
- [Úplný pôvodný register, zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — nájdite nadpis `BUG-013`.
- [GitHub Issue #14](https://github.com/DaniilBehus/wallet-tracker/issues/14) — externé metadáta sa môžu líšiť; dokumentačnou autoritou stavu je lokálny register.

<a id="resolution-and-verification"></a>

## Vyriešenie a overenie

Aktuálne rozhodnutie: **CLOSED**. Pole opravy v registri: fixed. Tento stav sa vzťahuje iba na zdokumentovaný nález a jeho vlastný regresný dôkaz.

**CLOSED.** Vrstvenie a rozloženie panela úpravy boli opravené, takže mobilná spodná navigácia už nezachytáva jeho ovládanie Save. Pred opravou zlyhalo päť zo šiestich testov úpravy na `mobile-chromium`, kým všetkých šesť prešlo na desktope; zaznamenaných šesť testov úpravy po oprave prešlo v oboch viewportoch. Pri tomto dokumentačnom prepise sa nespustil nový prehliadačový beh.

<a id="technical-investigation-and-dated-history"></a>

## Technické skúmanie a datovaná história

<details>
<summary>Otvoriť pôvodnú podrobnú správu/pozorovanie</summary>

<a id="bug-013--the-edit-panel-opened-underneath-the-bottom-navigation--medium--closed"></a>

### BUG-013 · Panel úpravy sa otvoril pod spodnou navigáciou · Medium · CLOSED

| | |
|---|---|
| Nájdené v | S16, zistené end-to-end sadou na viewporte telefónu |
| Komponent | `public/index.html`, `public/style.css` — panel úpravy |
| Dotýka sa | úpravy výdavku na telefóne, teda každého používateľa aplikácie navrhnutej pre telefón |

**Kroky reprodukcie:** pri 375×812 otvorte výdavok na úpravu a stlačte Save.

**Očakávané:** panel je nad všetkým a jeho tlačidlá sa dajú stlačiť.

**Skutočnosť:** na tlačidlo Save sa nedalo kliknúť. Playwright našiel
prvok, posunul sa k nemu, označil ho za „visible, enabled and stable“ —
kliknutie však nedopadlo, pretože nad ním bola pevná spodná navigácia.

**Päť zo šiestich testov zlyhalo na `mobile-chromium` a všetkých šesť
prešlo na `desktop-chromium`.** Tento rozdiel je charakteristický:
problém vrstvenia sa prejaví tam, kde je viewport dosť nízky na prekrytie prvkov.

**Príčina:** panel bol vo vnútri `#screen-month` a `.screen` je flex potomok
s vlastným miestom v poradí vrstvenia. `z-index` nastavený na potomkovi
je obmedzený kontextom vrstvenia svojho predka, takže `z-index: 40`
súťažil s ďalšími deťmi tejto sekcie — nie s navigačným panelom, ktorý
je súrodencom sekcie, vykresľuje sa neskôr, a preto je navrchu.

Prvok bol skutočne viditeľný. Nebol skrytý, zakázaný ani zle umiestnený.
Ležal pod niečím iným, čo je iný typ zlyhania, ktorý `toBeVisible()`
nezachytí — asercia, ktorá by tu „prešla“, je presne tá intuitívna.

**Oprava:** panel sa presunul mimo sekcie medzi súrodencov navigácie,
kde s ňou jeho `z-index` súťaží priamo, a zvýšil sa na 50.
Zatvorenie pri zmene obrazovky sa presunulo do `showScreen`, pretože
skrytie sekcie už panel neskryje.

**Regresia:** šesť testov úpravy v oboch viewportoch. Boli napísané
pred opravou a zlyhali zo správneho dôvodu; iba tak možno vedieť,
že regresný test by zachytil chybu, podľa ktorej je pomenovaný.

**→ Pravidlo R13.**

---

</details>
