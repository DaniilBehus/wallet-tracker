[English](../../../../docs/analysis/README.md) · **Slovenčina**

<!-- locale-links-v1: source-relative links rebased for locales/sk -->

<a id="analysis-models--wallet-behaviour-and-category-limits"></a>
# Analytické modely — správanie Wallet a limity kategórií

[← Späť na README](../../README.md#start-here)

Ide o **modely osobného projektu**, nie o dôkaz podnikovej alebo bankovej
analýzy. Diagramy AI opisujú hranicu aplikácie; netvrdia, že prebehlo hodnotenie
živého modelu alebo meranie jeho kvality.

**Najprv si prečítajte stav.** Existujúce procesy AI a celkového mesačného
limitu aj sekvencia opisujú implementované správanie. Limity kategórií boli
zmrazené pred implementáciou v `4d08651` dňa 2026-09-28; ich implementácia
je teraz verejná. [Zaznamenaná správa z testov](../../qa/docs/test-report-category-limits.md)
oddeľuje automatizované dôkazy od [UAT kategórií 13/13 podľa vyjadrenia
vlastníka](../../qa/docs/uat-category-limits.md) na neskoršom pomenovanom
testovacom zostavení. [Záznam o aktuálnom zostavení](../../qa/docs/uat-current-build.md)
tiež uvádza úpravu pravidelnej platby, fokus klávesnice a obnovenie mesiaca ako
PASS podľa vyjadrenia vlastníka; voliteľná strata odpovede Save/Pay má stav
**NOT RUN**. Samotné modely nie sú dôkazom vykonaných testov ani všeobecným
súhlasom s vydaním.

Šesť viditeľných SVG sú **vysvetľujúce modulárne mapy**, nie exporty BPMN
alebo UML. Každá stránka odkazuje na zachovaný formálny SVG a upraviteľný
model `.bpmn` alebo `.mmd`; pôvodný SVG UML zostáva vlastným formálnym zdrojom.

<a id="dated-publication-evidence--2026-09-29"></a>
### Datované dôkazy o publikovaní — 2026-09-29

Implementácia kategórií a kontroly OpenAPI boli publikované v
[zostavení `ed22c71`](https://github.com/DaniilBehus/wallet-tracker/commit/ed22c717eb2a405c3f262aceea8d96739b619809).
[CI presne pre toto zostavenie](https://github.com/DaniilBehus/wallet-tracker/actions/runs/36531663045)
úspešne skončilo vrátane kontraktu API a prehliadačových kontrol.
Ide o datovaný záznam publikovania, nie o prísľub stavu neskorších zostavení;
aktuálny odznak CI je v [koreňovom README](../../README.md#analyst-portfolio).
Tento výsledok CI predchádzal [neskoršej akceptácii vlastníka s obmedzeným
rozsahom](../../qa/docs/uat-category-limits.md).

<a id="choose-a-question"></a>
## Vyberte si otázku

| Otázka | Model |
|---|---|
| Čo sa stane medzi opísaním výdavku a jeho uložením? | [Mapa výdavku s AI a formálny BPMN](ai-expense-process.md) |
| Zabráni limit výdavkov zaznamenať výdavok? | [Mapa mesačného limitu a formálny BPMN](monthly-limit-process.md) |
| Ako sa mení a vyhodnocuje limit kategórie? | [Mapa limitu kategórie a formálny BPMN](category-limit-process.md) |
| Aké ciele môže človek vo Wallet dosiahnuť? | [Mapa možností a formálny UML](use-cases.md) |
| Ktorý komponent zapisuje a čo sa stane pri opakovaní? | [Mapa návrhu a uloženia a formálny sekvenčný diagram](draft-save-sequence.md) |
| Aké vzťahy a obmedzenia existujú? | [Mapa dátového modelu a formálny ERD](database.md) |

V zachovanom formálnom BPMN sú plné šípky sekvenčnými tokmi v rámci
účastníka a prerušované šípky správami medzi účastníkmi. Sú to opisné,
nevykonateľné modely, nie nasadené procesné nástroje. Modulárne mapy
používajú bežné vysvetľujúce šípky; nevykladajte ich ako notáciu BPMN.

<a id="follow-one-requirement"></a>
## Sledujte jednu požiadavku

[REQ-ML-05 a jej rozhodovacia tabuľka](../../qa/docs/analysis-monthly-limit.md#3-decision-table--limit-state)
→ [proces limitu](monthly-limit-process.md)
→ [implementácia](../../../../src/settings.js)
→ [TC-API-095–100](../../qa/docs/test-cases.md#api--monthly-spending-limit--folder-12)
→ [zaznamenaná správa](../../qa/docs/test-report-monthly-limit.md).

Pri AI sledujte [AI-R01 / AI-R02 / AI-R16](../../spec/ai-expense-entry.md#2-rules-acceptance-ids)
→ [sekvencia](draft-save-sequence.md)
→ [integračné testy HTTP](../../../../qa/ai/tests/integration.test.js)
a [testy uloženia s kľúčom](../../../../qa/ai/tests/idempotency.test.js).
Odkazy na testy označujú pokrytie; netvrdia, že tu prebehol nový test správania.

Pri limitoch kategórií sledujte špecifikáciu a zaznamenané dôkazy:
[CL-D1…12 / REQ-CL-01…13](../../qa/docs/analysis-category-limits.md)
→ [proces](category-limit-process.md)
→ [stĺpec a databázový CHECK](database.md)
→ [sledovateľnosť](../../qa/docs/analysis-category-limits.md#5-traceability)
→ [zaznamenaná správa](../../qa/docs/test-report-category-limits.md)
→ [akceptácia 13/13 podľa vyjadrenia vlastníka](../../qa/docs/uat-category-limits.md).

[Kontrakt celého API a vykonateľné kontroly](../api/README.md) ·
[Prehliadačové kontroly Selenium + Python](../../qa/selenium/README.md)

<a id="maintain-and-reproduce"></a>
## Údržba a reprodukcia

Každá stránka uvádza autoritatívne zdroje a zjednodušenia. **Existujúce
správanie bolo opätovne overené voči kódu v `4829b7d` dňa 2026-09-27.**
Sekvenciu návrhu a uloženia bolo treba zmeniť: Mermaid ju nevedel parsovať;
teraz odlišuje upraviteľný výsledok od odmietnutia, ukazuje potvrdenie alebo
vrátenie transakcie pri uložení s kľúčom a prenáša ID požiadavky. Databázový
model, oba modely BPMN a prípady použitia zodpovedali kódu podľa vtedajšieho
návrhu; jeden štítok BPMN bol presunutý mimo úlohy. Zastaraný komentár v teste
je uvedený na stránke sekvencie; nie je použitý ako požiadavka.

Dňa 2026-09-28 boli formálne modely kategórií dokončené podľa prijatej
špecifikácie pred produkčným kódom limitov kategórií. Neskoršia implementácia
pridala PATCH, stĺpec a editor. Viditeľné modulárne mapy opisujú implementáciu;
publikovanie je zaznamenané vyššie a akceptácia vlastníka zostáva samostatná.
Datované zmrazenie je zachované v Gite. Zmena stavu nemení CL-D1…12 ani
akceptačné pravidlá.

- Pred úpravou modelu znovu čítajte aktuálny kontrakt, trasu, schému a testy.
- Zachovajte voliteľné polia, rozdiel medzi nulou a `NULL`, výsledky zlyhaní
  a hranice zápisu.
- Kreslite iba deklarované cudzie kľúče databázy; pravidlá vlastníctva
  v aplikácii zobrazujte samostatne.
- Upravujte zdroje `.bpmn` / `.mmd` (formálny SVG UML je svojím vlastným
  upraviteľným zdrojom), znovu generujte formálne SVG v `formal/` a udržiavajte
  bloky Mermaid na stránkach zhodné so súbormi `.mmd`. Modulárny generátor
  aktualizujte osobitne.
- Parsujte, vykreslite a vizuálne skontrolujte každý model; skontrolujte
  odkazy a potom spustite `npm run check` a `git diff --check`. Správna
  syntax nedokazuje vecnú presnosť.

Modulárne mapy potrebujú iba Node; dajú sa znovu vytvoriť alebo skontrolovať
bez inštalácie balíkov:

```bash
node scripts/render-analysis-maps.js
node scripts/render-analysis-maps.js --check
```

Nástroje formálneho exportéra, ak sú dostupné, sú v Gitom ignorovanom
`output/`; závislosti projektu ani lockfile netreba meniť. Exportér používa
prehliadač Playwright. Prvý príkaz nižšie je voliteľné jednorazové
nastavenie nástrojov, nie zmena projektových závislostí. `--check` porovná
bajty zachovaných formálnych SVG bez prepisovania; vynechajte ho iba pri
úmyselnom opätovnom generovaní formálnych súborov.

```bash
npm install --prefix output/analysis-tools --no-save --package-lock=false --ignore-scripts bpmn-js@18.30.1 mermaid@12.0.0
node scripts/render-analysis.js --check output/analysis-tools
node scripts/render-analysis.js output/analysis-tools
```

Formálny skript používa import bpmn-js (s XML parserom bpmn-moddle) a skutočné
API `parse` a `render` v Mermaid. Kontrola zlyhá pri upozorneniach importu,
nefunkčných lokálnych odkazoch, nesúhlasných blokoch Mermaid, orezanom texte
alebo štítku mimo vlastného poľa — poznámky, aktéra či úlohy. Obnovuje sa
päť formálnych SVG v `formal/`; zachovaný formálny SVG UML sa kontroluje, ale
negeneruje znovu. Exporty sú bajtovo stabilné: značky šípok sú číslované
namiesto náhodných názvov a odchýlka čiar Mermaid má pevné semienko, takže
druhý beh nič nemení. Šesť kontrolných PNG ide do `output/analysis-review/`
a necommituje sa; prezrite si aj ich, pretože štítok prechádzajúci cez čiaru
kontrola ohraničujúceho obdĺžnika neodhalí.

Odkazy na nástroje: [bpmn-js](https://bpmn.io/toolkit/bpmn-js/),
[API Mermaid](https://mermaid.js.org/config/usage),
[notácia Mermaid ER](https://mermaid.js.org/syntax/entityRelationshipDiagram).

[Ďalej: proces výdavku s AI →](ai-expense-process.md)
