[English](../../../../qa/docs/test-report-static-gates.md) · **Slovenčina**

<a id="static-gate-exceptions-and-evidence-boundaries--local-report"></a>

# Výnimky statických brán a hranice dôkazov — lokálny report

[← Späť na README](../../README.md#qa-evidence) · [Príkazy behov](../../docs/testing.md) · [Negatívne kontroly](../../../../qa/gates/validator-controls.test.js) · [Ďalej: pozorovaná matica API →](test-report-contract.md#observed-status-matrix)

Zaznamenané 2026-10-10 voči
`b270355c8c850282b10cc0a7bdeb81c88b784765`
plus lokálne necommitnuté zmeny. Report opisuje
lokálne kontroly, nie publikovaný commit ani nový
beh GitHub CI. V tejto etape sa neoslabil žiadny
produkčný endpoint ani testovacie očakávanie.

<a id="findings-and-repair"></a>

## Zistenia a oprava

| Zistenie | Predtým | Lokálna zmena |
|---|---|---|
| [BUG-030](../../log/BUGS.md) (F15) | C9 kontrolovala len dĺžku dôvodu. Správne tvarovaná výnimka pre neexistujúcu trasu, testid či stav mohla prejsť C9; nadbytočný alebo duplicitný záznam mohol zostať. Chybné záznamy mohli vyhodiť výnimku namiesto verdiktu brány. | C9 teraz porovnáva každú výnimku s **tým istým aktuálnym inventárom** ako C6–C8. Odmieta chýbajúce, už pokryté, duplicitné a neplatné záznamy a vyžaduje použiteľný dôvod. Chýbajúci inventár zlyhá uzavretým spôsobom bez vymysleného zastaraného zistenia. |
| [BUG-031](../../log/BUGS.md) (F14) | Znenie brány mohlo znieť ako dôkaz, že požiadavky, lokátory page objectov či vetvy stavov boli vykonané. | C6–C8 sú označené ako statické porovnania deklarácií. C9 validuje iba identitu a dôvod výnimky. Dokumentácia osobitne odkazuje na dôkazy skutočných odpovedí. |

Negatívne kontroly spúšťajú skutočné kontrolné moduly
cez pamäťové rozhranie súborov; nepremenúvajú ani
nemažú projektové vstupy. Na starej logike mal
prvý beh **23 úspešných a 6 zlyhaných** kontrol:
šesť nových kontrol zastaraných/nadbytočných/
chybne tvarovaných záznamov nedostalo požadovaný
verdikt C9 (jedna chybná štruktúra vyhodila výnimku).
Po oprave rozšírená sada kontroluje aj nedostupné
inventáre a obnovu pôvodných hashov vstupov.
Záverečný zdroj prešiel **31/31 kontrolami**
v samostatnom nezávislom lokálnom vykonaní.
Skutočný súbor výnimiek stále má jeden záznam C8,
`500`; C9 ho prijíma, lebo `500` je aktuálne
deklarovaný v zdroji, ale nemá zodpovedajúcu
deklaráciu asercie.

<a id="what-these-gates-do-and-do-not-establish"></a>

## Čo brány preukazujú a čo nie

- **C6:** 21 deklarácií trás sa porovnáva s deklaráciami
  požiadaviek v kolekcii. Zápis parametrov sa pri
  porovnaní normalizuje. Zhodná deklarácia požiadavky
  nedokazuje jej vykonanie za behu.
- **C7:** 117 doslovných/deklarácií prefixov
  generovaných testid sa porovnáva s textom/vzormi
  adries v page objectoch. Ide o adresovateľnosť,
  nie meranie vykreslenej obrazovky či jedinečnosti
  selektora.
- **C8:** 14 doslovných stavov zdroja sa globálne
  porovnáva so 14 doslovnými aserciami v kolekcii
  a testoch AI. Zhodný kód niekde **nedokazuje**,
  že sa precvičila každá operácia, ktorá ho vracia.
- **C9:** výnimky musia odkazovať na aktuálne
  nepokrytú položku v tých istých statických
  inventároch, mať použiteľný dôvod a byť jedinečné.
  Nedokazuje správanie za behu.

[Matica pozorovaných operácií/stavov v kontraktovom reporte](test-report-contract.md#observed-status-matrix)
je silnejšia, samostatná vrstva skutočného HTTP a
výslovne označuje bunky **NOT EXERCISED**. Aj táto
matica pokrýva iba zachytené prípady. Výnimka `500`
zaznamenáva **neprecvičenú globálnu statickú medzeru**:
testy očakávaných vstupov odmietajú nečakané odpovede
500, no nejde o precvičenie riadenej odpovede na
vnútornú chybu. Taký test je možná budúca práca;
výnimka netvrdí opak ani široké pokrytie 500.

<a id="verification-and-limits"></a>

## Overenie a obmedzenia

Prvá záverečná sekvencia workera prešla `test:gates`
**31/31**, `check` **8/8** (nula preskočených),
`check:openapi` **21/21 zdrojových operácií**
a `test:dates` **4/4**, no jej jednorazový kontraktový
server sa nespustil pred timeoutom a offline
vyhodnocovač nedokázal zapísať pár reportov.
Tieto dva príkazy workera **zlyhali**. Ich presné
príčiny v prostredí sa nepreukázali.

Po pridaní poslednej kontroly neplatného záznamu
nezávislé lokálne vykonanie nezmeneného záverečného
zdroja prešlo `test:gates` **31/31** (vrátane
záznamov `null`/pole), `check` **8/8**
(nula preskočených), `test:contract` **15/15
s 340 validovanými skutočnými HTTP odpoveďami
a 21 operáciami** a `eval:ai` **116/116 kontrolami
fixtúr, NOT_MEASURED**; príkazy skončili s kódom 0.
Neskoršie dôkazy spätne nemenia zlyhania workera
na úspechy ani ich nediagnostikujú. Vyššie uvedené
počty OpenAPI a dátumov sú skoršie úspešné behy
workera, nie údajne nezávislé opakovania.

Skenery zámerne rozpoznávajú cielené doslovné
tvary zdroja, nie ľubovoľný dynamický JavaScript.
C8 je globálna, nie podľa operácie. Historické
počty brán a datované reporty zostávajú pôvodné.
Publikovanie, CI kombinovaného stromu a nezávislá
revízia sú oddelené brány, ktoré pri týchto
lokálnych zmenách ešte čakajú.
