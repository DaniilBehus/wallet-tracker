[English](../../../../../qa/docs/defects/BUG-032-ci-evidence-retention.md) · **Slovenčina**

<a id="bug-032--ci-and-local-verification-diverged-reports-were-not-retained"></a>

# BUG-032 · CI a lokálne overenie sa líšili; správy sa neuchovávali

[← Späť na README](../../../README.md#qa-evidence) · [Register chýb](../../../log/BUGS.md) · [Ďalej: index správ →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Lokálny testovací príkaz a CI nezdieľali jeden inventár overenia; správy API a Python sa generovali, ale neuchovávali ako artefakty CI.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Chyba |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Stredná |
| Priorita | Samostatne nezaznamenaná |
| Komponent | workflow CI, overovacie príkazy a uchovávanie dôkazov QA |
| Nájdené / dotknutá zostava | kontroly plánu 2026-10-10; presná zostava len tam, kde je zaznamenaná nižšie |
| Prostredie / frekvencia | Samostatne nezaznamenané; nevyvodzujte frekvenciu z neskorších zelených behov |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie dáta

2026-10-10, porovnanie zdrojov workflow, skriptov balíka a tvorcov správ

<a id="reproduction"></a>

## Reprodukcia

Úplný očíslovaný postup reprodukcie nebol v historickom pozorovaní zaznamenaný. Pozri datované dôkazy nižšie; nevydávajte spätne zostavený postup za vykonaný test.

<a id="expected-and-requirement"></a>

## Očakávané správanie a požiadavka

Lokálne prostredie a CI by mali používať rovnaký plán povinných úloh, bezpečne zlyhať pri chýbajúcich predpokladoch a uchovávať povolené dôkazy API/Python.

<a id="actual-observation"></a>

## Skutočné pozorovanie

Základné CI vynechávalo príkaz race, zatiaľ čo `npm test` vynechával niekoľko sád CI. Výsledkové súbory Newman a Python sa generovali lokálne bez krokov nahrávania artefaktov CI.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `qa/docs/test-report-ci-verification.md`](../test-report-ci-verification.md)
- [Úplný pôvodný register, zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — nájdite nadpis `BUG-032`.

<a id="resolution-and-verification"></a>

## Vyriešenie a overenie

Aktuálny stav registra: **CLOSED**. Datované zosúladenie zaznamenáva: [kontroly spoločného plánu](../test-report-ci-verification.md) plus [skutočný beh a artefakty po zlúčení](https://github.com/DaniilBehus/wallet-tracker/actions/runs/39248991256): šesť nahraných artefaktov; archív API obsahuje HTML, JUnit, súhrn race a súhrn behu a archív Python obsahuje JUnit a súhrn behu. Limity timeoutu a kontroly súkromia v datovanej správe platia naďalej.

Pôvodné skúmanie nižšie môže používať skorší štítok `IN PROGRESS` alebo „local/uncommitted“. Je zachované ako historický dôkaz, nie ako konkurenčný aktuálny stav. Táto migrácia dokumentácie nespustila nový scenár.

<a id="technical-investigation-and-dated-history"></a>

## Technické skúmanie a datovaná história

<details>
<summary>Otvoriť pôvodnú podrobnú správu/pozorovanie</summary>

<a id="bug-032--ci-and-local-verification-diverged-apipython-reports-were-not-retained--medium--in-progress"></a>

### BUG-032 · CI a lokálne overenie sa líšili; správy API/Python sa neuchovávali · Medium · IN PROGRESS

| Nájdené v | 2026-10-10, porovnanie zdrojov workflow, skriptov balíka a tvorcov správ |
| Komponent | workflow CI, overovacie príkazy a uchovávanie dôkazov QA |

**Problém:** publikované základné CI vynechávalo vrstvu race, zatiaľ čo
`npm test` vynechával niekoľko sád CI. Skoršia lokálna úprava pridala race,
ale žiadny spoločný plán neudržiaval lokálne a CI skupiny v zhode.
Newman HTML/JUnit a Python JUnit sa generovali bez krokov nahrávania v CI.
**Očakávané:** explicitný plán ekvivalentný CI s bezpečným zlyhaním pri
chýbajúcich predpokladoch a uchovávaním povolených správ pri úspechu aj zlyhaní.
**Oprava:** lokálna a necommitnutá; spoločný inventár šiestich skupín/18 úloh,
runner zastavujúci sa pri chybe so stavmi `NOT_RUN` a ignorovaným krátkym
súhrnom identity plus kroky nahrávania v4 pre pripravené dôkazy API/Python/race.
Existujúce stopy chýb prehliadača a sedemdňové uchovanie zostávajú.
**Overenie:** prechádza deväť cielených kontrol. Izolovaná skupina API prešla
10/10 úlohami; Python 27/27 položkami. Predvolený lokálny plán zlyhal na
chýbajúcom `gitleaks` a správne ponechal 17 úloh `NOT_RUN`. Úplné lokálne/
vzdialené CI a skutočné správanie nahrávania **nie sú overené**.
**Dodatok revízie:** skoršia sada deviatich kontrol mohla falošne prijať
nesprávnu závislosť E2E tým, že našla ďalší job, a falošne odmietnuť
ekvivalentný CRLF workflow. Prvé regresie na tom istom pomocnom nástroji
pozorovali 9 úspešných / 2 neúspešné; ohraničená kontrola jobu teraz
prechádza 12/12 vrátane nesprávnej väzby, CRLF a nepodporovaných tvarov.
Skutočný workflow bol už správny; reálne skupiny sa znovu nespustili.
Odstránené sledované súbory môžu spôsobiť zlyhanie identity pred súhrnom,
podradené procesy nemajú timeout vo wrapperi, pôvod platí iba pre okamih
spustenia, lokálne príznaky CI sa môžu líšiť a kontrola súkromia zostáva
heuristická. Táto lokálna oprava nedokazuje vzdialené nahratia artefaktov
ani neuzatvára tento nález IN PROGRESS.
**Následná oprava fixture koncov riadkov:** úplný virtuálny čítací pohľad
CRLF odhalil dve mutačné fixtures obmedzené na LF ešte pred volaním pomocného
nástroja (10 úspešných / 2 neúspešné). Teraz pred mutáciou normalizujú a
testujú formy LF aj CRLF bez zmeny workflow. Konečné vybrané kontroly prechádzajú
12/12 na skutočnom LF a 12/12 na virtuálnom CRLF; negatívne prípady nesprávnej
závislosti a nejednoznačného tvaru zostávajú vynucované. Znovu nebežala
žiadna reálna skupina ani vzdialené CI, takže nález zostáva IN PROGRESS.
**→ Žiadne pravidlo — jednorazový prípad.** [Podrobnosti](../test-report-ci-verification.md).

</details>
