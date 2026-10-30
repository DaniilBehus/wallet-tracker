[English](../../../../qa/docs/ai-case-study.md) · **Slovenčina**

<a id="case-study--putting-a-language-model-next-to-money-and-keeping-it-honest"></a>

# Prípadová štúdia — jazykový model pri peniazoch a dôveryhodné hranice

[← Späť na README](../../README.md#qa-evidence) · [Ďalej: metóda evaluácie →](ai-evaluation.md)

Wallet je malý sledovač výdavkov navrhnutý najprv pre telefón: číselná
klávesnica, dlaždice kategórií, Save. Projekt pridal voliteľný spôsob
zadania: napíšte *"Учора витратив 18 євро на обід"* a získajte predvyplnený
formulár — €18.00, Restaurants, včerajší dátum, "обід" — ktorý sami
skontrolujete a uložíte.

Táto stránka je o testovaní, nie o funkcii. Zaujímavá otázka nikdy nebola
„dokáže model prečítať túto vetu?“. Bola to otázka: **čo musí platiť,
aby chyba modelu nespôsobila škodu a zelené testy naozaj niečo znamenali?**

<a id="the-problem-stated-as-risks"></a>

## Problém vyjadrený ako riziká

1. Model si vymyslí číslo. Z „Lunch yesterday“ vznikne €12.00, pretože
   12 je uveriteľná cena obeda.
2. Model nesprávne prevedie údaj. Z „Lunch 10 USD“ vznikne výdavok €10.00.
3. Návrh sa zmení na výdavok bez súhlasu osoby.
4. Opakovanie po prerušení spojenia uloží ten istý nákup dvakrát.
5. Náklady sa vymknú kontrole: opakovania, súbežní používatelia,
   reštarty, ktoré zabudnú počítadlo.
6. Kľúč, opis alebo kategórie iného používateľa uniknú niekam mimo.
7. Testy dosiahnu skutočnú službu alebo prejdú bez skutočnej kontroly.

<a id="contracts-that-make-the-risks-testable"></a>

## Kontrakty, vďaka ktorým sa dajú riziká testovať

**Model nikdy nevytvára konečné hodnoty.** Vracia úseky pôvodného textu —
`amount_text: "18"`, `currency_text: "євро"`,
`date_text: "Учора"` — a *referenciu* kategórie (`c3`)
zo zoznamu, ktorý server zostavil pre túto požiadavku. Server sám
odvodí centy, dátum a ID kategórie a overí, že každý úsek je doslovne
v opise. Úsek, ktorý tam nie je (`"18"`, keď text obsahuje `"180"`),
spôsobí 502, nie návrh.

**Server prehľadáva opis nezávisle od modelu.** Ak text obsahuje
`USD`, výsledok je unsupported bez ohľadu na tvrdenie modelu.
Ochrana smie výsledok posunúť iba k bezpečnejšiemu stavu
(`ready → needs_input → unsupported`), nikdy späť.
Tak sa z rizika 2 stáva test s jednoznačnou odpoveďou.

**Návrh nie je výdavok.** `POST /api/ai/expense-draft` nemá
cestu zápisu. Každý integračný test počíta riadky používateľa
pred každou vetvou aj po nej vrátane zlyhaní.

**Uloženie má identitu.** Kontrolná obrazovka posiela
`Idempotency-Key`. Rovnaký kľúč a obsah zopakujú prvú odpoveď 201;
iný obsah vráti 409; vymazaný výdavok sa neobnoví.
Uloženia bez kľúča sa správajú ako predtým — dve kávy sú dve kávy.

**Náklady sa ohraničia pred volaním.** Denné a minútové kvóty
sa atómovo rezervujú v SQLite pred odoslaním a zostanú minuté
aj pri zlyhaní volania; každý používateľ môže mať jednu
rozpracovanú požiadavku; bez opakovania.

<a id="tests-by-the-question-each-answers"></a>

## Testy podľa otázky, na ktorú odpovedajú

| Otázka | Kde je odpoveď |
|---|---|
| Odmieta normalizátor vymýšľanie alebo nesprávny prevod? | 30 jednotkových testov; korpus 116 riadkov v režime pripravených odpovedí |
| Zvláda skutočný adaptér skutočné tvary odpovedí? | testy adaptéra proti lokálnej náhrade s dokumentovaným tvarom REST: odmietnutie, neúplná odpoveď, presmerovanie, limit streamu 64 KiB, časový limit |
| Platí celý tok HTTP v každej vetve? | 29 integračných testov so skutočným procesom servera a novým súborom SQLite |
| Môže opakovanie vytvoriť duplikát? | 11 testov idempotencie vrátane 20 súbežných uložení s rovnakým kľúčom a reštartu |
| Môžu testy dosiahnuť internet? | vopred načítaná ochrana a 4 testy, ktoré sa ju pokúšajú obísť |
| Dodržiava rozhranie svoje prísľuby? | 25 testov Playwright × telefón a počítač vrátane opakovania stratenej odpovede uloženia s tým istým kľúčom |
| Čo s okamihmi, ku ktorým sa prehliadačový test nedostane? | 11 testov komponentu spúšťajúcich skutočný `public/ai-expense.js`: odpoveď po prerušení, tiché uloženie, zmenený účet, zmazaná kategória |
| Môže živá evaluácia minúť priveľa alebo zasiahnuť aplikáciu? | 7 testov povoleného limitu a ďalších 20 identity databázy a záznamu holdoutu; všetky spúšťajú skutočný proces evaluátora s ochranou proti sieti a lokálnou náhradou poskytovateľa |
| Hovorí správa, ktorý kód merala a akú časť korpusu? | 7 testov pôvodu na jednorazových kópiách zdrojového stromu, 8 testov správy vrátane 216 vykreslených kombinácií |
| Sú čísla skutočné? | úmyselné zmeny evaluátora, rozhrania a kontroly pokrytia v jednorazových kópiách; tri zostali zelené a každá bola vysvetlená, nie skrytá |

<a id="findings--what-testing-actually-turned-up"></a>

## Zistenia — čo testovanie skutočne odhalilo

- **BUG-014 (existujúca chyba, High):** na telefóne 320×568 bol zoznam
  kategórií pruhom širokým 18 px. Najprv reprodukované ako neúspech,
  potom opravené rozložením pre krátku obrazovku; teraz chránené
  pri dvoch veľkostiach.
- **BUG-019 (existujúca chyba, Medium):** nadmerný JSON vracal 500
  a zapisoval telo do logu. Teraz vracia 413 `PAYLOAD_TOO_LARGE`,
  overené v Newman a pytest.
- **Ochrana proti sieti pri fetch zlyhávala otvorene.** Vyhadzovala
  výnimku synchrónne vo vnútri Node fetch; tá unikla ako nezachytená
  a zrútila proces namiesto zlyhania jednej požiadavky. Test čakajúci
  na tento fetch visel 60 sekúnd namiesto toho, aby zlyhal.
  Ochrana teraz v nasledujúcom cykle zničí socket s chybou,
  podobne ako skutočné sieťové zlyhanie.
- **Tlačidlo zadania prekrývalo sumu.** Žiadny test si to nevšimol;
  ukázali to prvé snímky. Opravené; pred ponechaním testu
  ohraničujúcich obdĺžnikov pri štyroch veľkostiach sa overilo,
  že so starým CSS zlyhá.
- **Cesty Windows v `NODE_OPTIONS` stratili spätné lomky**, takže
  sa ochrana do podriadených serverov vôbec nenačítala.
  Každý podriadený server hlasno zlyhal pri štarte — iba preto,
  že cesta bola nesprávna, nie preto, že by niečo kontroloval.
- **Dve negatívne prehliadačové kontroly spočiatku nezlyhali.**
  Jedna úmyselná zmena zasiahla nesprávnu vetvu kódu;
  po oprave a opakovaní zlyhala. Druhá je skutočná medzera:
  kontrola generácie požiadavky v rozhraní sa v prehliadačovom teste
  nedá pozorovať oddelene od `AbortController`. Zaznamenala sa
  ako otvorená, nie prepísaná na kontrolu, ktorá prejde,
  a neskôr ju uzavrel test komponentu, ktorý doručí odpoveď
  napriek prerušeniu.
- **Čiastočná nezávislá kontrola našla štyri nesprávne, ale zelené
  správania**, než ju zastavil limit používania. Z `Lunch 10USD`
  vznikol pripravený návrh €10.00 (kód meny sa dotýkal číslic);
  z `Lunch -€10` vzniklo +€10.00; evaluátor prešiel s jednou
  nesprávnou sumou (59 zo 60 je nad hranicou 98 %); uloženie
  na server, ktorý nikdy neodpovedal, zostalo navždy na "Saving".
  Evaluácia s pripravenými odpoveďami predtým hlásila 113/113
  aj s prvými dvoma chybami. Každá bola reprodukovaná novým testom,
  najprv zlyhala, potom sa opravila; evaluátor teraz zlyhá
  pri jedinej nesprávnej sume alebo dátume.
- **Vlastná dokumentácia projektu radila nebezpečný postup.**
  Operátorovi hovorila zvýšiť denné limity AI aplikácie v `.env`
  pre živú evaluáciu — v tom istom súbore, ktorý aplikácia číta
  pri štarte. Živý evaluátor teraz potrebuje vlastný konečný
  limit a ignoruje limity aplikácie.
- **Zúčtované zlyhanie stratilo svoju cenu.** Pri reasoning modeli
  sa reasoning tokeny počítajú do limitu výstupných tokenov,
  takže odpoveď môže skončiť ako neúplná a napriek tomu byť
  spoplatnená. Adaptér zahadzoval údaje o použití takých odpovedí;
  teraz ich zachováva a evaluátor hlási známe a neznáme použitie
  oddelene.
- **Dokončená nezávislá kontrola našla ďalšie štyri chyby,
  všetky vo vlastnej bezpečnosti evaluátora.** Kontrola
  „nikdy databáza aplikácie“ porovnávala reťazce ciest a Windows
  junction ju obišla až do sentinelovej databázy.
  „Holdout sa spustí raz“ hľadalo slovo `holdout` v argumentoch,
  takže `--split all` odoslal rovnaké riadky bez záznamu.
  Identita kódu vychádzala z Gitu, ktorý nevidí nové súbory.
  Markdown správa vypisovala `undefined` pre premenované polia,
  hoci jednoriadkový beh vyzeral ako PASS. Vlastná kontrola
  označila prvé dve vlastnosti za testované — boli, ale iba pre
  zápis, ktorý testy použili. Každá má teraz test, ktorý najprv
  zlyhá, a 19 úmyselných porúch v jednorazových kópiách dokazuje,
  že si ich testy všimnú.

<a id="what-fixtures-cannot-prove"></a>

## Čo pripravené odpovede nedokážu dokázať

- **Kvalitu modelu.** Každé doteraz publikované číslo presnosti
  pochádza z režimu pripravených odpovedí: ideálne odpovede zo
  štítkov zastupovali model. `MODEL_QUALITY=NOT_MEASURED`.
- **Kompatibilitu so skutočným účtom OpenAI.** Uskutočnilo sa
  nula skutočných volaní.
- **Kvalitu štítkov.** Všetkých 116 riadkov napísal ten istý
  autor ako normalizátor a neboli nezávisle skontrolované.
- **Skutočné telefóny.** Iba veľkosti okien Chromium;
  bez klávesnice na obrazovke.
- **Či limit výstupných tokenov stačí reasoning modelu.**
  Pri 600 tokenoch môže mnoho odpovedí skončiť neúplne;
  ukáže to až prvý skutočný beh `--limit 1`.

<a id="where-to-challenge-this"></a>

## Kde možno výsledok spochybniť

1. `src/ai/normalize.js` — slovníky sú konečné zoznamy.
   Nájdite tvar meny alebo dátumu, ktorý prejde skenerom.
2. Či prísna schéma JSON a kontrola doslovného úseku stačia,
   keď model z dvoch skutočných čísel vyberie *nesprávne*.
3. `public/ai-expense.js` — logika zastaranej odpovede;
   kontrola generácie je dokázaná iba na úrovni komponentu,
   nie v prehliadači.
4. D-036 bod 6 — C8 teraz dôveruje tvaru volania jednej
   pomocnej funkcie v `qa/ai`.
5. Menovatele evaluátora: je „presnosť sumy na riadkoch
   s očakávanou sumou“ správna otázka alebo sa majú
   počítať aj riadky needs-input?
6. `qa/ai/evaluate.js` v živom režime — nájdite spôsob,
   ako živou evaluáciou minúť viac než
   `WALLET_AI_EVAL_DAILY_CALLS` alebo zasiahnuť
   databázu aplikácie. Známa medzera: proces, ktorý
   medzi kontrolou a otvorením vymení priečinky.
