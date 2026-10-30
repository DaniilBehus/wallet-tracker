[English](../../../../qa/docs/test-report-traceability.md) · **Slovenčina**

<a id="f13-semantic-traceability-repair--local-review-report"></a>

# Oprava sémantickej sledovateľnosti F13 — lokálna revízna správa

[← Späť na README](../../README.md#qa-evidence) ·
[Index základných pravidiel](../../spec/core-requirements.md) ·
[Katalóg prípadov](test-cases.md)

Stav: **IN PROGRESS — lokálne, necommitnuté; čaká na hlavnú a nezávislú
revíziu**. Ide o statickú opravu dokumentácie/identity, nie o nový
behaviorálny beh, výsledok vzdialeného CI, podpis UAT vlastníka ani
tvrdenie o zručnosti v CV. Pracuje sa na vetve
`work/claude-wallet-2026-09-24`, HEAD
`b270355c8c850282b10cc0a7bdeb81c88b784765`; základ ORD-083
pred úpravou sa zhodoval pre 41/41 súborov.

<a id="what-changed-by-source-family"></a>

## Čo sa zmenilo podľa skupiny zdrojov

| Skupina | Zdroj definície | Aktuálne mapovanie |
|---|---|---|
| Core | [core-requirements.md](../../spec/core-requirements.md) | 28 stabilných ID odvodených z aktuálnej verejnej architektúry/OpenAPI/pomocných dôkazov; detaily iba implementácie sú označené, nie vydávané za obnovené rozhodnutie vlastníka |
| Celkový mesačný limit | [analysis-monthly-limit.md](analysis-monthly-limit.md) | Existujúce REQ-ML-01…10 s explicitnými anchormi; prípady ukazujú na presné pravidlo |
| Limit kategórie | [analysis-category-limits.md](analysis-category-limits.md) | Existujúce REQ-CL-01…13 s explicitnými anchormi; skrátené bunky viacerých ID rozšírené na presné odkazy |
| AI draft | [ai-expense-entry.md](../../spec/ai-expense-entry.md) | Existujúce AI-R01…21 s explicitnými anchormi; tabuľka rizík AI opravuje menu (R07), dátumy (R08/R09), vlastníctvo (CORE-04/R10), logovanie (R12/CORE-24) a manuálne Add (R03/R19) |
| Kontraktové kontroly | [API README](../../docs/api/README.md#requirements-for-the-contract-checks) | Existujúce REQ-CONTRACT-01…06 s explicitnými anchormi a presnými odkazmi na katalóg |
| Historické označenia D a § | [migračný index](../../spec/core-requirements.md#legacy-reference-migration-index) | Iba navigácia; pôvodné zdôvodnenie/schválenie **UNKNOWN**. D-017 je kontext prostredia/portu, nie správanie produktu |
| Predbežný import | [analýza syntetického importu](analysis-synthetic-import.md) | Stále autorsky vytvorený agentom a predbežný; nevymyslel sa prijatý REQ ani nový riadok katalógu |

Katalóg má stále **280 odlišných ID prípadov**. Jeho kroky, očakávané
hodnoty, priority a historické stavové bunky sa neprepísali. Prvých 229
sedemstĺpcových riadkov dostalo sémantické odkazy na aktuálne
pravidlá/chyby; zostávajúcich 51 riadkov kategórie/kontraktu dostalo
priame odkazy do svojich existujúcich buniek požiadavky/kontroly. Mení
sa navigácia, nie dátum ani výsledok historického behu. Pomenovaný
`TC-CONTRACT-IMPORT` zostáva mimo katalógu; F19 musí vykonateľný inventár
zosúladiť samostatne.

Niektoré staršie očakávania prípadov stále citujú bývalé čísla ustanovení
alebo datované znenie UI. Tieto bunky očakávaných hodnôt zostávajú ako
historické dôkazy, nie sú prezentované ako aktuálne anchory architektúry.
Úvodné znenie sledovateľnosti teraz výslovne oddeľuje platnosť odkazu od
sémantickej pravdivosti a vykonania. Zastarané odkazy v pláne testov na
spec §4.1–4.3/§6/§6.5/§9 teraz smerujú na aktuálne pravidlá alebo sekcie
architektúry; riadok runtime odkazuje na udržiavanú politiku Node namiesto
tvrdenia o zastaranom minime.

Manuálna revízia zdroja opravila tri ľahko zameniteľné hranice v indexe
Core: pravidlo hesla 8/72 bajtov platí pre **registráciu**; výdavok
`spent_on` môže dosiahnuť zajtrajšok podľa lokálneho času servera, kým
plánovaná platba `starts_on` nemá relatívne dátumové obmedzenie; a nový
účet číta príjem `0`, pričom voliteľný je **limit**, nie príjem. Preto
syntakticky platné odkazy stále potrebujú nezávislé sémantické čítanie.

<a id="architecture-and-checksum-review"></a>

## Revízia architektúry a kontrolného súčtu

V architektúre sa vykonali iba dve úpravy:

1. Zastaraný riadok runtime `Node.js 22+` teraz odkazuje na skutočnú
   politiku verzií v `docs/testing.md` a `package.json`.
2. Sekcia kvality teraz odkazuje na nový verejný index pravidiel.

Žiadne iné pravidlo architektúry ani kontrakt ID testov v §5 sa nezmenili.
Dĺžka surových bajtov sa zmenila **8192 → 8349**. SHA-256 sa zmenil
`b0a9dd0a75c26dda1af571011ea286dce0a520c50cf38c851ee584acf19cbb06`
→ `32eb753d83cd5d3aa0b68f88f540ac0516c331523e02ac778f86cab0ae018836`.
Súbor kontrolného súčtu bol aktualizovaný spolu s dokumentom; C1 nebol
oslabený.

<a id="static-checker-and-bounded-controls"></a>

## Statický checker a ohraničené kontroly

`scripts/traceability.js` používa iba vstavané moduly Node. Bezpečne odmieta
prázdne/chýbajúce vstupy, duplicitné zdrojové definície/anchory a ID prípadov,
chýbajúce alebo nesprávne anchory, neznáme/neprepojené ID, odkazy na
nesprávny zdroj, neplatné odkazy na chyby a nepodporované tvary riadkov.
Opakované odkazy považuje za odkazy, nie duplicitné definície. Hlási
hranicu predbežného importu. AI má vlastný register prípadov, takže
checker **nevyžaduje**, aby sa každá požiadavka AI/funkcie objavila v
280-riadkovom hlavnom katalógu.

`qa/gates/traceability.test.js` mal pri zmrazení revízie ORD-086 17 čistých
kontrol v pamäti; ORD-087 pridáva štyri cielené kontroly, teraz 21. Starý
`§5 health` trace je zlyhávajúci **fixture** a opravený explicitný odkaz
prechádza; netvrdí sa, že starý celý strom bol vykonaný proti tomuto
novému checkeru. Kontroly pokrývajú LF/CRLF, odstránené/preklepnuté/
duplicitné anchory, definície a prípady, nesprávne zdroje a chýbajúce
ciele, neznáme/neprepojené ID, prázdny vstup, nepodporované tvary a odkazy
na chyby. Platné CORE-01 plus nepodporované CORE-999 pôvodne uniklo
checkeru (16 úspešných / 1 neúspešný); po zovšeobecnenom skene neznámych
ID ten istý test prešiel (17/17).
Úmyselne nesprávny, no syntakticky platný odkaz health→auth zostáva zelený:
sémantická ekvivalencia vyžaduje ľudskú revíziu.

Samostatný checker **nie je zapojený do `npm run check` ani CI**, lebo
úpravy `scripts/check.js`, metadát balíka a workflow sú mimo tohto
zadania. F19 stále vlastní úplnú obojstrannosť vykonateľných zdrojov a
aktuálny inventár. Táto správa preto nenazýva statický PASS úplným pokrytím.

<a id="actual-local-verification-and-limits"></a>

## Skutočné lokálne overenie a limity

| Príkaz, prenosný Node 22.14.0 | Výsledok |
|---|---|
| `node --test qa/gates/traceability.test.js` | 21 úspešných, 0 neúspešných, 0 preskočených po ORD-087; skorších 17/17 patrí predchádzajúcemu zmrazeniu |
| `node scripts/traceability.js` | STATIC PASS: 280 ID prípadov, 78 definícií pravidiel |
| `node scripts/check.js` | C1/C2/C3/C5/C6/C7/C8/C9: 8 úspešných, 0 neúspešných |

Tu sa nespustil server, prehliadač, HTTP, databáza, AI provider, celá sada,
UAT vlastníka ani vzdialené CI. Skoršie päťsekundové zlyhanie pripravenosti
zostáva samostatné a nevyriešené; táto práca ho nemôže premenovať na
zelené. Konečné spätné čítanie zistilo všetkých 39 chránených hashov
ORD-083 nezmenených; ďalšie dva zmrazené súbory (`test-plan.md`,
`log/BUGS.md`) sú autorizované úpravy. Všetkých 280 ID prípadov a ich
kroky, očakávané hodnoty, priority a stavové bunky sa presne zhodujú
s katalógom pred opravou. Stav Gitu má 53 dotknutých ciest: všetkých
41 predtým špinavých ciest plus 12 ďalších ciest, všetkých 12 v zozname
povolených pre túto úlohu; nevznikla neočakávaná cesta ani čistenie.
Prefix `log/BUGS.md` pred týmto novým záznamom auditu má hash
`27f15a779872891a368cf4c96f466e65fd7fd60db10b67f64c149e173edff5f9`,
zhodný so zmrazeným základom; úprava logu iba pridáva na koniec.

<a id="current-artifact-sha-256"></a>

## Aktuálne SHA-256 artefaktov

Surové bajtové hashe každého zmeneného artefaktu ORD-085/087 okrem tejto
správy (súbor nemôže obsahovať vlastný konečný hash):

```text
spec/core-requirements.md              468c2cbc34f5ab30fc2439a3874488a07010bbc106bfd65aa4aa959c6b8a4d27
spec/architecture.md                   32eb753d83cd5d3aa0b68f88f540ac0516c331523e02ac778f86cab0ae018836
spec/architecture.sha256               8fd9cc0c7b549f989469922db5d3a3740f7f1abb851a14705df209d6ad937d43
qa/docs/test-cases.md                  a2d1ff0cb206113ac82ec8f6014a5d17d7627265a26602dd6cb81f52962b512d
qa/docs/test-plan.md                   2eb700778afdb3590950cf7539335533a2b3c0d8b46501450752c61d2e3cd370
qa/docs/ai-test-plan.md                e0af218eefbc6f8279677bb63ba72747cc83df2db07183b5e694e1fedad9887c
qa/docs/analysis-monthly-limit.md      7994aa327f3ef81df4f5bb78076bce7611b42bd1edd7c4ea7b4c6efadc77d886
qa/docs/analysis-category-limits.md   796ef379ddba571bc0ef5eae7fa0c6eb4afd86e80d284b7cad19ee6942f5fdb0
spec/ai-expense-entry.md               2cb400a8843038bfea1cb01ece6c4d3d6b5216633a969fa4015b508e7b8a9510
docs/api/README.md                     add82b9668cfe1618648f849b97223d90858b7bcb18a1ebc44d3127ff549419a
scripts/traceability.js                0618ed8b86312816d7b493beec869790a8ec11df7716e29c5c0b4a59aec9722a
qa/gates/traceability.test.js          ebe5aa804a83a39428aacb29ad1c1f20a55c4a8fc934f2500688ace3884844a2
log/BUGS.md                            41771ab1a063072eac0a06f671cdc54a027fa863794c841afa339093c2bdd7cf
```

<a id="ord-087-narrow-independent-review-correction"></a>

## ORD-087 úzka oprava po nezávislej revízii

Nezávislá revízia ORD-086 **neprijala lokálnu akceptáciu** pre dva ohraničené
nálezy; ani jeden nebol runtime chybou Walletu.

- R01: TC-API-096/097/098/099 sú riadky rozhodovacej tabuľky R3–R8.
  Ich štyri bunky sledovateľnosti teraz všetky odkazujú na
  [REQ-ML-05](analysis-monthly-limit.md#req-ml-05), nie na nesúvisiace
  pravidlá ML-06/07/08/09. Revidovaná kontrola pripína toto explicitné
  očakávanie a blízke odlišné prípady (101→06, 102/103→07, 104/105→08,
  E2E-065/066→09). Je to človekom revidovaná asercia mapovania,
  nie sémantika odvodená statickým parserom.
- R02: pripojenie `REQ-CORE-999` ako ukotveného zdrojového nadpisu predtým
  vracalo `ok:true` a 78 definícií. Presný svedok v pamäti bol pridaný
  najprv a vyprodukoval očakávanú červenú: 17 úspešných / 1 neúspešný.
  Kandidáti zdroja sa teraz hľadajú pred validáciou typovanej skupiny/ID/tvaru
  v každom ohraničenom bloku definície; ukotvená definícia v tvare pravidla
  mimo svojho bloku tiež zlyhá. Súbežné kontroly LF/CRLF pokrývajú všetkých
  päť skupín zdrojov, kandidátov nesprávnej skupiny a opakované bežné
  odkazy mimo bloku. Chybný alebo nepodporovaný kandidát sa nemôže
  skryť za platnú definíciu zdroja. Zostáva to ohraničenou bránou
  formátu Markdown, nie všeobecným parserom ani sémantickým orákulom.

Všetkých predchádzajúcich 17 kontrol zostáva; súčasná sada má 21.
V ORD-087 sa nemenil produkt, architektúra, CI, balík, existujúci
vykonateľný scenár ani stav prípadu. F13 zostáva **IN PROGRESS** do
hlavnej a cielenej nezávislej následnej revízie; netvrdí sa nové
vzdialené CI, UAT vlastníka ani inventár F19.
Konečné spätné čítanie našlo všetkých **48/48** ostatných hashov
súborov ORD-086 nezmenených. Menilo sa len päť objednaných ciest.
Skorší výsledok 17/17 zostáva dôkazom pre zmrazenie ORD-086, nie
tvrdením o novom pomocnom nástroji.
