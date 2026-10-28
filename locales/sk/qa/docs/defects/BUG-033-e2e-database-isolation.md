[English](../../../../../qa/docs/defects/BUG-033-e2e-database-isolation.md) · **Slovenčina**

<a id="bug-033--main-e2e-reused-one-database-between-runs-and-ignored-db_path"></a>

# BUG-033 · Hlavné E2E opakovane používalo jednu databázu a ignorovalo DB_PATH

[← Späť na README](../../../README.md#qa-evidence) · [Register chýb](../../../log/BUGS.md) · [Ďalej: index správ →](README.md)

<a id="overview-and-impact"></a>

## Prehľad a dopad

Hlavná konfigurácia E2E opakovane používala pevný súbor SQLite a ignorovala volajúcim zadaný DB_PATH, čo znižovalo izoláciu behov.

<a id="metadata"></a>

## Metadáta

| Pole | Zaznamenaná hodnota |
|---|---|
| Typ | Chyba |
| Stav | **CLOSED** — aktuálny kanonický register |
| Závažnosť | Stredná |
| Priorita | Samostatne nezaznamenaná |
| Komponent | `playwright.config.js`, spravovaný hlavný E2E runner |
| Nájdené / dotknutá zostava | audit konfigurácie/kontrol 2026-10-11; presná zostava len tam, kde je zaznamenaná nižšie |
| Prostredie / frekvencia | Samostatne nezaznamenané; nevyvodzujte frekvenciu z neskorších zelených behov |

<a id="preconditions-and-test-data"></a>

## Predpoklady a testovacie dáta

2026-10-11, hlavná konfigurácia Playwright a cielená negatívna kontrola

<a id="reproduction"></a>

## Reprodukcia

Úplný očíslovaný postup reprodukcie nebol v historickom pozorovaní zaznamenaný. Pozri datované dôkazy nižšie; nevydávajte spätne zostavený postup za vykonaný test.

<a id="expected-and-requirement"></a>

## Očakávané správanie a požiadavka

Každé predvolené spustenie E2E by malo používať čerstvú vlastnú databázu; bezpečné explicitné nastavenie DB_PATH by sa malo rešpektovať.

<a id="actual-observation"></a>

## Skutočné pozorovanie

Skoršia konfigurácia Playwright vždy vyberala `data/e2e.db`, aj keď bol zadaný DB_PATH, takže opakované spustenia zdieľali trvalú databázu.

<a id="evidence"></a>

## Dôkazy

- [Zaznamenaný zdroj: `qa/docs/test-report-e2e-isolation.md`](../test-report-e2e-isolation.md)
- [Úplný pôvodný register, zachovaný ako datovaný archív](../../../log/BUGS-archive-before-2026-10-26.md) — nájdite nadpis `BUG-033`.

<a id="resolution-and-verification"></a>

## Vyriešenie a overenie

Aktuálny stav registra: **CLOSED**. Datované zosúladenie zaznamenáva: [negatívne kontroly izolovanej databázy a sprievodných súborov](../test-report-e2e-isolation.md); E2E runner a Playwright CI prešli. Násilné ukončenie ani TOCTOU pri sprievodnom súbore sa netvrdia ako vyriešené.

Pôvodné skúmanie nižšie môže používať skorší štítok `IN PROGRESS` alebo „local/uncommitted“. Je zachované ako historický dôkaz, nie ako konkurenčný aktuálny stav. Táto migrácia dokumentácie nespustila nový scenár.

<a id="technical-investigation-and-dated-history"></a>

## Technické skúmanie a datovaná história

<details>
<summary>Otvoriť pôvodnú podrobnú správu/pozorovanie</summary>

<a id="bug-033--main-e2e-reused-one-database-between-runs-and-ignored-db_path--medium--in-progress"></a>

### BUG-033 · Hlavné E2E opakovane používalo jednu databázu a ignorovalo DB_PATH · Medium · IN PROGRESS

| Nájdené v | 2026-10-11, hlavná konfigurácia Playwright a cielená negatívna kontrola |
| Komponent | `playwright.config.js`, spravovaný hlavný E2E runner |

**Problém:** predchádzajúca konfigurácia vždy vyberala `data/e2e.db` bez ohľadu
na volajúcim zadaný `DB_PATH`, takže opakované spustenia sady používali trvalú
databázu. Netvrdí sa tu pozorovaná 429, meraný rast ani strata dát.
**Očakávané:** čerstvá predvolená databáza pre každé hlavné spustenie E2E
a bezpečné explicitné nastavenie; čistenie iba po zastavení vlastného servera.
**Oprava:** lokálna a necommitnutá. Rodičovský runner mimo prehliadačových
špecifikácií spravuje oba podradené procesy aj jedinečný dočasný adresár,
odmieta existujúce/chránené cesty override a externé ciele a odstráni
iba vlastný predvolený adresár po potvrdenom ukončení podradených procesov.
Explicitné nové súbory zostanú volajúcemu. Nezmenili sa žiadne asercie
aplikácie ani prehliadačových špecifikácií.
**Regresia:** úvodných 0/5 zahŕňalo jedno skutočné zlyhanie pevnej cesty
a štyri zlyhania testovacieho rámca kvôli chýbajúcemu runneru; po prvej
implementácii 4/5, keď ešte zostalo staré zapojenie. Konečné cielené Node
kontroly 24/24 a statická kontrola 8/8 po štruktúrnom presune a skutočnej
kontrole zachovaného override. Jeden úplný lokálny hlavný beh E2E prešiel
192/192 na telefóne a desktope s potvrdeným ukončením servera a čistením
vlastného predvoleného adresára; stará DB mala rovnakú dĺžku/mtime a
aplikačná DB zostala neprítomná. Vzdialené CI sa tu zatiaľ netvrdí.
Násilné ukončenie rodiča môže zanechať dočasné dáta; súbežné príkazy
na pevnom porte sa predvolene nepodporujú.
[Podrobnosti](../test-report-e2e-isolation.md).
**→ Žiadne pravidlo — jednorazový prípad.**

**Dodatok BUG-033 o sprievodných súboroch, 2026-10-11:** prvá ochrana
explicitnej cesty odmietala *názvy* sprievodných súborov ako `DB_PATH`,
ale prijala nový základ vedľa existujúceho `-wal`, `-shm` alebo
`-journal`. Jednorazové sondy zopakovali všetky tri bez otvorenia SQLite.
Kontrola zlyhávajúca pred opravou odhalila `-wal`; lokálna oprava teraz
odmieta všetky tri cez `lstat` pred `wx` bez vytvorenia základu alebo
spustenia podradeného procesu, pričom bajty/identita sentinelových súborov
zostávajú nezmenené. Dotknuté kontroly: 26 úspešných, 1 voliteľný fixture
visiaceho symlinku preskočený pre oprávnenia Windows, 0 neúspešných;
statická kontrola 8/8. Skorší úplný prehliadačový výsledok 192/192 bol
**pred** touto ochranou, nie je behom najnovšieho stromu. Súbežné vytvorenie
sprievodného súboru po predbežnej kontrole zostáva limitom TOCTOU;
vzdialené CI je stále neoverené.

</details>
