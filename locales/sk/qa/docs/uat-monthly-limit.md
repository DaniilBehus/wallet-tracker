[English](../../../../qa/docs/uat-monthly-limit.md) · **Slovenčina**

<!-- locale-links-v1: source-relative links rebased for locales/sk -->

<a id="monthly-spending-limit--uat-script"></a>
# Mesačný limit výdavkov — scenár UAT

[← Späť na README](../../README.md#qa-evidence) · [Ďalej: skúmanie chýb →](defects/README.md)

Desať minút, jedna osoba a prehliadač. Bez testovacích nástrojov a klienta
API: ide o akceptačný beh, ktorý môže vykonať a podpísať aj netechnický
hodnotiteľ. Požiadavky a rozhodovaciu tabuľku, ktorú preveruje, nájdete
v [`analysis-monthly-limit.md`](analysis-monthly-limit.md).

**Prostredie — jednorazová databáza, nie vaša.** Tento beh **nespúšťajte**
pomocou `npm start`. Tento príkaz načíta `.env`, ak existuje, a otvorí
`data/wallet.db`. Akceptačný scenár by tak bežal nad skutočnými záznamami
a použil by na ne migráciu limitu. Namiesto toho spustite server s vlastným
súborom: cestou k databáze, ktorá ešte neexistuje, tajomstvom používaným
iba pri tomto behu, vypnutým poskytovateľom AI a bez čítania `.env`.

```bash
DB_PATH=./data/uat-limit.db JWT_SECRET=uat-only-not-a-real-secret \
  WALLET_AI_MODE=off PORT=3000 node src/server.js
```

```powershell
$env:DB_PATH="./data/uat-limit.db"; $env:JWT_SECRET="uat-only-not-a-real-secret"
$env:WALLET_AI_MODE="off"; $env:PORT="3000"; node src/server.js
```

Podstatný je príkaz `node src/server.js`: `npm start` spúšťa
`node --env-file-if-exists=.env
src/server.js` a práve tento prepínač
treba vynechať. Potom otvorte `http://localhost:3000` a zaregistrujte
nový e-mail pre tento beh, aby bol mesiac na začiatku prázdny.
Po skončení zmažte `data/uat-limit.db` (aj jeho súbory `-wal` a `-shm`);
`data/` je ignorované Gitom, takže sa nič z tohto behu omylom necommituje.
Netreba kľúč AI, sieťové volanie ani externú službu.

**Použité údaje.** Dva výdavky: €50.00 (Groceries) a €75.00 (Transport).

| # | Krok | Očakávaný výsledok | Pokrýva |
|---|---|---|---|
| 1 | Zaregistrujte sa a na prázdnom účte otvorte **This month** | Limit uvádza *Set limit*; riadok stavu sa nezobrazuje | R1, REQ-ML-09 |
| 2 | Na **Add** pridajte výdavok €50.00 a vráťte sa na **This month** | Súčet €50.00; limit stále uvádza *Set limit*; riadok stavu sa stále nezobrazuje | R2 |
| 3 | Klepnite na limit, zadajte `200.00` a uložte | Zobrazí sa potvrdenie; limit uvádza €200.00; riadok hovorí **Within limit · €150.00 left** | REQ-ML-10, R4 |
| 4 | Pridajte výdavok €75.00 a vráťte sa | Súčet €125.00; riadok hovorí **Within limit · €75.00 left** | R4, REQ-ML-06 |
| 5 | Klepnite na limit, zadajte `125.00` a uložte | Riadok hovorí **Limit reached** — nie „over“ | R5, predpoklad A4 |
| 6 | Klepnite na limit, zadajte `100.00` a uložte | Riadok hovorí **Over limit by €25.00** a je viditeľne označený | R6, REQ-ML-09 |
| 7 | Pridajte ešte jeden výdavok €10.00 | **Uloží sa** — limit nikdy neblokuje uloženie; riadok teraz hovorí **Over limit by €35.00** | REQ-ML-06, predpoklad A1 |
| 8 | Klepnite na limit, zadajte `abc` a uložte | Zobrazí sa chyba; limit aj riadok zostanú nezmenené | REQ-ML-10 |
| 9 | Klepnite na limit, vyprázdnite pole a uložte | Limit znovu uvádza *Set limit*; riadok stavu zmizne | REQ-ML-02, R2 |
| 10 | Znovu načítajte stránku | Limit je stále zrušený — zmena sa uložila, nielen zobrazila | REQ-ML-01 |
| 11 | Zopakujte krok 3 v okne veľkosti telefónu (šírka asi 375 px) | Limit, riadok stavu aj prstencový graf sú čitateľné; nič sa neprekrýva | REQ-ML-09, chyba rozloženia nájdená pri testovaní |

<a id="recorded-run--2026-09-23"></a>
## Zaznamenaný beh — 2026-09-23

**Vykonal ho Claude (agent AI), nie osoba.** V paneli Chromium prešiel
rovnakých jedenásť krokov a zapísal, čo pozoroval. Je to skúška scenára,
nie akceptácia: potvrdenie vlastníka nižšie zostáva zámerne prázdne
a nič z tohto záznamu sa nemá čítať ako prijatie funkcie.

Zostavenie: aplikačný kód presne podľa commitu `4ad444d` — `git diff`
voči `src/` a `public/` bol počas celého behu prázdny. Server:
`DB_PATH=./data/uat-limit.db JWT_SECRET=<throwaway> WALLET_AI_MODE=off PORT=3000
node src/server.js`, databáza vytvorená prázdna iba pre tento beh a po ňom
zmazaná, bez čítania `.env` a bez sieťového volania. Účet:
`uat-limit@example.test`, zaregistrovaný iba pre tento beh v tejto databáze.

| # | Výsledok | Čo bolo pozorované |
|---|---|---|
| 1 | PASS | Limit uvádza *Set limit*; riadok stavu je `hidden`; súčet €0.00 |
| 2 | PASS | Súčet €50.00; limit stále *Set limit*; riadok stavu stále skrytý |
| 3 | PASS | Oznámenie **Limit saved**; limit €200.00; riadok **Within limit · €150.00 left**; editor sa sám zavrel |
| 4 | PASS | Súčet €125.00; riadok **Within limit · €75.00 left** |
| 5 | PASS | Riadok **Limit reached** — hranica rovnosti zodpovedá A4 |
| 6 | PASS | Riadok **Over limit by €25.00**, okrem slov má aj triedu `figure--over` |
| 7 | PASS | Oznámenie **Saved · €10.00** — uloženie nebolo blokované; súčet €135.00; riadok **Over limit by €35.00** |
| 8 | PASS | Chybové oznámenie **Limit must be a number, for example 600.00**; limit zostal €100.00; riadok zostal **Over limit by €35.00**; editor zostal otvorený s textom v poli |
| 9 | PASS | Oznámenie **Limit removed**; limit uvádza *Set limit*; riadok stavu je znovu skrytý; súčet sa nezmenil |
| 10 | PASS | Po úplnom načítaní stránky je limit stále zrušený — stav bol uložený, nielen nakreslený |
| 11 | PASS, podľa merania, nie pohľadom | Pri 375 px je ovládací prvok limitu na x 195–285 a prstencový graf končí na x 177, takže nezaberajú rovnaký priestor; test zásahu v strede prvku vracia tento prvok, nie graf — práve to porušovala chyba z testovania; riadok stavu zaberá celú šírku 306 px pod grafom a nič neprekrýva; stránka nemá horizontálne posúvanie (`scrollWidth` 375 = viewport) |

**Čím sa tento beh líši od vykonania osobou a aké má obmedzenia**

- Okno Claude bolo počas celého behu za iným oknom, preto sa panel
  nevykresľoval: **nebola zachytená snímka a nič sa neposudzovalo pohľadom.**
  Krok 11 sa namiesto toho overil geometriou prvkov a testom zásahu.
  To odpovedá na otázku „prekrýva niečo prvok alebo blokuje klepnutie?“,
  nie na otázku „vyzerá to správne?“.
- Z rovnakého dôvodu vracal `getComputedStyle` pri obmedzenom paneli
  zastarané farby: riadok prekročeného limitu sa uprostred behu načítal
  ako bežná farba hlavičky a po opätovnom načítaní ako `#ffd4ca`.
  Pravidlo zodpovedá prvku a novo vložená kópia sa vykreslí ako
  `#ffd4ca`, preto ide o artefakt merania nevykresľujúceho sa panela,
  nie o zistenie o aplikácii. Osoba vykonávajúca krok 6 má stále
  farbu potvrdiť pohľadom.
- Backspace, Delete a Ctrl+A sa v tomto paneli nikdy nedostali na stránku.
  Písanie číslic a klikanie na tlačidlá boli skutočné vstupné udalosti;
  vyprázdnenie poľa v kroku 9 sa muselo urobiť nastavením hodnoty
  vstupného poľa cez automatizačný nástroj. Pri 375 px platilo to isté
  pre kliknutia, takže navigácia a stláčanie tlačidiel v kroku 11
  sa namiesto toho vykonali na tých istých prvkoch zo stránky.
- Jedna chyba testera je zaznamenaná, lebo inak by čísla nesedeli:
  pred krokom 2 sa omylom uložil výdavok €500,050.00. Obrazovka Add
  zachovala predtým napísanú sumu a nové číslice sa k nej pripojili.
  Riadok sa zmazal cez API a krok 2 začal znova od mesiaca s nulovou
  útratou. Nie je to chyba tejto funkcie; zachovanie sumy bolo už
  existujúcim správaním obrazovky Add.


<a id="second-run--the-owner-2026-09-24"></a>
## Druhý beh — vlastník, 2026-09-24

Rovnakých jedenásť krokov vykonal vlastník na zostavení `3d4e9a7`,
nezávisle od skúšky vyššie. **Všetkých jedenásť prešlo** a výsledok
sa krok za krokom zhoduje so zaznamenaným behom. Vlastník funkciu
prijal a uviedol jedno pozorovanie.

Oba behy zostávajú zámerne oddelené. Skúška uvádza, čo agent vedel
a nevedel overiť; tento záznam uvádza, čo videla osoba, vrátane vecí,
ktoré skúška výslovne nevedela posúdiť — farby pri prekročení limitu
a rozloženia pri 375 px pohľadom. Dve nezávislé vykonania jedného scenára
sú silnejším záznamom ako každé samostatne.

Dôkazom je tento zápis: snímky neboli zachytené a opis behu pochádza
od samotného vlastníka.

<a id="uat-obs-01--the-over-limit-state-is-marked-too-weakly"></a>
### UAT-OBS-01 · stav prekročeného limitu je označený príliš slabo

Prijaté s pripomienkou. Vlastník žiada rám okolo hodnoty limitu:
červený pri vyčerpanom limite, svetlý neutrálny rám, kým rozpočet zostáva,
a žiadny rám bez nastaveného limitu; farby majú zapadnúť do existujúcej témy.
(Oprava z 2026-09-27: záznam pôvodne uvádzal „exceeded“. Bolo to
agentovo prerozprávanie ukrajinských slov vlastníka, ktoré sa týkali
vyčerpaného limitu. Nič iné v zázname tohto behu sa nezmenilo.)

**Krok 6 tým nezlyháva.** Stav už nesie slová *Over limit by €X* aj
triedu `figure--over`, takže REQ-ML-09 AC-09.3 — farba nikdy nie je
jediným nositeľom informácie — stále platí. Ide o zlepšenie prezentácie,
sledované oddelene od tohto behu, a nebránilo akceptácii.

**Rev 1: implementovaná v `8d7cdeb`; pri opätovnej kontrole vlastníka
dňa 2026-09-27 nebola prijatá (pozri nižšie).** Čo revízia 1 vytvorila
a namerala, zostáva v pôvodne zaznamenanej podobe:

- Hodnota limitu má rám: neutrálny, kým zostáva rozpočet, červený
  po jeho vyčerpaní, bez rámu pri nenastavenom limite. Okraj je
  vždy prítomný a mení iba farbu, takže hodnoty nad ním sa
  pri zmene stavu neposúvajú.
- **Červená znamená, že nič nezostáva.** Vlastník žiadal červenú
  už pri vyčerpaní limitu, takže výdavky *presne* vo výške limitu
  dostanú červený rám rovnako ako vyššie výdavky. Slová zachovávajú
  jemnejší rozdiel: pri rovnosti riadok stavu hovorí *Limit reached*,
  nie over (REQ-ML-05 R5), a nemá triedu over.
- Kontrast rámu sa meral v prehliadači voči obom koncom gradientu
  hlavičky mesiaca, teda najtmavšiemu aj najsvetlejšiemu podkladu.
  WCAG 1.4.11 vyžaduje pre grafický objekt 3:1.

  | Paleta | Neutrálny rám | Červený rám |
  |---|---|---|
  | Dodaná (`theme.css`) | 6.17:1 · 7.91:1 | 7.06:1 · 9.04:1 |
  | Svetlá (samotný `style.css`) | 6.23:1 · 3.63:1 | 8.88:1 · 5.18:1 |

- Kontrola TC-E2E-076…080. Negatívne kontroly: ak sa rám vôbec
  nekreslí, zlyhajú štyri z piatich prípadov. Ak sa presná rovnosť
  považuje za zostávajúci rozpočet, zlyhá iba TC-E2E-078.
  Ak má farba rámu v niektorej palete kontrast pod 3:1, zlyhá
  iba prípad meriaci danú paletu.
- `docs/screenshots/2-month.png` sa znovu vytvoril pomocou
  `npm run screenshots`. Ostatné tri snímky zostali bajtovo totožné.

**Opätovná kontrola vlastníka, 2026-09-27: neprijaté.** Rám bol okolo
hodnoty limitu. Vlastník namiesto toho žiadal plné červené pole s bielym
textom okolo stavu *Over limit*, nie rám okolo limitu. Pôvodné
pozorovanie žiadalo tiež biely obrys, kým zostáva rozpočet,
a nič pri nenastavenom limite.

**Rev 2: implementovaná v `4f1c737`, čakala na opätovnú kontrolu
vlastníka.** V tejto fáze ju vlastník ešte nevidel, preto nasledujúci
záznam opisoval implementáciu, nie akceptáciu.

- Rám zmizol: hodnota limitu vyzerá ako pred UAT-OBS-01.
- Pole je teraz riadok stavu pod prstencom. Po vyčerpaní limitu —
  pri dosiahnutí alebo prekročení — je to plné červené pole
  s bielym tučným textom a zaoblenými rohmi; červená pochádza
  z rodiny nebezpečných farieb palety. Kým rozpočet zostáva,
  je to biely obrys bez výplne. Bez limitu nie je pole,
  lebo riadok je rovnako ako predtým skrytý.
- Slová a ich význam sa nemenia: pri výdavkoch presne vo výške
  limitu sa stále zobrazuje *Limit reached* bez triedy over
  (REQ-ML-05 R5) a farba stále nie je jediným nositeľom
  informácie (REQ-ML-09 AC-09.3).
- Merané v prehliadači. Text stavu má 13 px, je tučný a má
  bežnú veľkosť, preto WCAG 1.4.3 vyžaduje 4.5:1 pre bielu
  na červenej; 1.4.11 vyžaduje 3:1 pre obrys voči obom
  koncom gradientu hlavičky mesiaca.

  | Paleta | Biely text na červenej | Biely obrys na hlavičke |
  |---|---|---|
  | Dodaná (`theme.css`) | 5.44:1 | 11.90:1 · 15.25:1 |
  | Svetlá (samotný `style.css`) | 5.70:1 | 12.01:1 · 7.01:1 |

- Aj pri najdlhších vetách, ktoré pole môže obsahovať,
  *Within limit · €1,000,000.00 left* a
  *Over limit by €10,000,000.00*, zostáva v hlavičke pri 320,
  375 a 393 px, text nie je orezaný a stránka sa neposúva do strán.
  Hodnoty príjmu, zvyšku a limitu zostávajú na rovnakom mieste
  vo všetkých štyroch stavoch.
- Kontrolujú to TC-E2E-076…080, prepísané pre pole, a dva nové
  prípady: TC-E2E-084 (hodnota limitu nikdy nemá rám a hodnoty nad ňou
  sa neposúvajú) a TC-E2E-085 (pole sa zmestí pri 320, 375 a 393 px).
  Negatívne kontroly, každá ako dočasná úprava obnovená bajt po bajte:
  bez kreslenia poľa zlyhajú TC-E2E-077…080; ak presná rovnosť
  znamená zostávajúci rozpočet, zlyhá iba 078; ak červená spôsobí
  kontrast bieleho textu pod 4.5:1, zlyhá iba 079 v dodanej
  a iba 080 vo svetlej palete; ak sa vráti rám hodnoty limitu,
  zlyhá iba 084.
- `docs/screenshots/2-month.png` sa znovu vytvoril pomocou
  `npm run screenshots` a ukazuje prekročený stav. Ostatné tri
  snímky zostali bajtovo totožné. Obrázky stavov v limite
  a na hranici pri 375 px sa pripravili pre opätovnú kontrolu
  vlastníka a v repozitári sa neuchovávajú.

**Opätovná kontrola revízie 2 vlastníkom, 2026-09-27: prijaté.**
Vlastník skontroloval stavy prekročený, dosiahnutý a v limite —
znovu vytvorenú snímku mesiaca a dva obrázky pri 375 px —
a prijal stavové pole. UAT-OBS-01 je uzavreté.

**Potvrdenie** — vyplnil vlastník, nie vyššie uvedený agent.

| | |
|---|---|
| Dátum | 2026-09-24 |
| Zostavenie (commit) | `3d4e9a7` |
| Úspešné kroky | 11 / 11 |
| Nahlásené chyby | 0 chýb; 1 zistenie použiteľnosti, UAT-OBS-01 |
| Prijal vlastník | Áno — vlastník prijal 2026-09-24 |

**Mimo rozsahu tohto behu** (dohodnuté v analýze, nie tu nájdené
medzery): limity podľa kategórií, upozornenia, blokovanie ukladania,
odlišný limit pre každý mesiac a akákoľvek predpoveď.
