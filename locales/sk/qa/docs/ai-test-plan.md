[English](../../../../qa/docs/ai-test-plan.md) · **Slovenčina**

<a id="ai-expense-entry--test-plan-and-case-register"></a>

# Zadávanie výdavkov pomocou AI — testovací plán a register prípadov

[← Späť na README](../../README.md#ai-expense-entry) · [Ďalej: prípadová štúdia AI →](ai-case-study.md)

Rozsah: voliteľná funkcia „Opísať výdavok“ (`spec/ai-expense-entry.md`,
D-033…D-040). Napísané v S23 spolu s implementáciou; pôvod označení
každého prípadu nižšie je **AGENT_AUTHORED** až do nezávislej revízie.

<a id="1-what-must-never-happen"></a>

## 1. Čo sa nesmie nikdy stať

Toto sú produktové riziká v poradí dôležitosti. Každá nižšie uvedená vrstva
zachytáva niektoré z nich; register prípadov určuje ktoré.

| Riziko | Pravidlo | Kde sa zachytáva |
|---|---|---|
| Opis vytvorí výdavok bez stlačenia Save | [AI-R01](../../spec/ai-expense-entry.md#ai-r01) | integrácia (v každej vetve sa počítajú riadky), prehliadač, vyhodnocovač |
| Číslo, dátum alebo mena sa vymyslí či násilne prevedie | [AI-R05](../../spec/ai-expense-entry.md#ai-r05), [AI-R06](../../spec/ai-expense-entry.md#ai-r06), [AI-R07](../../spec/ai-expense-entry.md#ai-r07), [AI-R08](../../spec/ai-expense-entry.md#ai-r08), [AI-R09](../../spec/ai-expense-entry.md#ai-r09) | jednotkové testy normalizátora, vyhodnocovač, kontroly produkčnej ochrany |
| Cudzia mena sa zmení na výdavok v EUR | [AI-R07](../../spec/ai-expense-entry.md#ai-r07) | ochrana skenera, kontrola vyhodnocovača na `Lunch 10 USD` |
| Opakovanie uloží dvakrát alebo obnoví zmazaný výdavok | [AI-R16](../../spec/ai-expense-entry.md#ai-r16) | testy idempotencie, Newman, pytest, opakovanie po stratenej odpovedi v prehliadači |
| Dva zámerne rovnaké nákupy sa zlúčia do jedného | [AI-R17](../../spec/ai-expense-entry.md#ai-r17) | testy idempotencie, Newman bez kľúča / súbeh D |
| Dáta iného používateľa sa dostanú k poskytovateľovi alebo do odpovede | [REQ-CORE-04](../../spec/core-requirements.md#req-core-04), [AI-R10](../../spec/ai-expense-entry.md#ai-r10) | integračná izolácia, test súkromia payloadu; vlastníctvo nad rámec odporúčaní kategórií rieši základné pravidlo |
| Kľúč, prompt alebo telo odpovede poskytovateľa unikne do logov či chýb | [AI-R12](../../spec/ai-expense-entry.md#ai-r12), [REQ-CORE-24](../../spec/core-requirements.md#req-core-24) | integračný test logov, testy adaptéra |
| Výdavky na volania sú neobmedzené: opakovania, súbežní používatelia, reštarty | [AI-R18](../../spec/ai-expense-entry.md#ai-r18) | jednotkové testy limitov, integračné limity, test reštartu |
| Testovací beh sa dostane na internet | [AI-R13](../../spec/ai-expense-entry.md#ai-r13) | sieťová ochrana a jej vlastné fail-closed testy |
| Stará odpoveď sa priradí k novému opisu alebo účtu | [AI-R15](../../spec/ai-expense-entry.md#ai-r15) | testy zastaranej odpovede v prehliadači |
| Funkcia zhorší manuálne pridanie | [AI-R03](../../spec/ai-expense-entry.md#ai-r03), [AI-R19](../../spec/ai-expense-entry.md#ai-r19), [BUG-014](../../log/BUGS.md) | testy rozloženia pri 320×568 / 375×667, hlavná e2e sada |

<a id="2-layers"></a>

## 2. Vrstvy

| Príkaz | Čo sa spúšťa | Sieť |
|---|---|---|
| `npm run test:ai` | node:test — normalizátor, kontrakty, konfigurácia, adaptér, limity, HTTP integrácia, idempotencia, sieťová ochrana, kontroly vyhodnocovača, bezpečnosť živého vyhodnocovača (skutočný proces vyhodnocovača, falošný poskytovateľ): limit, identita databázy, register holdout, pôvod obsahu, vykreslenie reportu; výber poskytovateľa a adaptér Gemini na vyhodnocovanie (D-040); [AI-R15](../../spec/ai-expense-entry.md#ai-r15) (úroveň komponentu), ukážka | prednačítaná ochrana; falošný poskytovateľ na loopbacku; syntetické databázy a jednorazové kópie zdrojov v dočasnom adresári OS |
| `npm run eval:ai` | vyhodnotenie 116 riadkov korpusu pomocou fixtúr cez produkčnú službu; report obsahuje manifest obsahu | načítaná ochrana |
| `npm run eval:ai:live -- --dry-run` | validácia korpusu a konfigurácie, plánované volania, manifest; existujúcu databázu vyhodnocovania číta iba na čítanie | nula volaní, nula zápisov |
| `npm run test:ai:e2e` | Playwright, server v živom režime s falošným poskytovateľom + demo server | iba loopback |
| `npm run test:api` | priečinok Newman 11: kontrakt AI vo vypnutom režime, uloženia s kľúčom, 413 | loopback |
| `npm run test:python` | `test_ai_keyed.py` | loopback |
| `npm run check` | C6 trasy AI v kolekcii; C7 nové testid v POM; C8 stavy z kolekcie **alebo** `qa/ai` | — |

Vyhodnotenie na skutočnom modeli je samostatný, výslovne povolený krok a
**nie je** súčasťou predvolených príkazov (pozri `qa/docs/ai-evaluation.md`).

<a id="3-entry-and-exit"></a>

## 3. Vstupné a výstupné podmienky

Vstup: napísaná špecifikácia a rozhodnutia (D-033…D-035), korpus zmrazený
s hashom manifestu ešte pred ladením normalizátora, základné sady zelené (P0).

Výstup pre offline blok: všetky príkazy z §2 zelené; spustené a zaznamenané
negatívne kontroly vrátane tých, ktoré **nesčerveneli**; snímky obrazovky
skontrolované; žiadne tvrdenie o kvalite modelu.

<a id="4-case-register-tc-ai"></a>

## 4. Register prípadov (TC-AI)

Udržiava sa tu oddelene od `qa/docs/test-cases.md`, ktorý katalogizuje
základnú aplikáciu. Prípady AI majú vlastné ID `TC-AI-###`.

| ID | Prípad | Dôkaz |
|---|---|---|
| TC-AI-001 | Schopnosti v živom režime: presné príznaky, bez tajomstva | integrácia `capabilities: live-mode flags…` |
| TC-AI-002 | Vypnutý režim: schopnosť vypnutá, koncept 503, uloženie cez klávesnicu stále 201 | integrácia; Newman 11 |
| TC-AI-003 | Vyžiadaný živý režim s kľúčom, ale bez modelu: nedostupný, v logu názvy, nie kľúč | integrácia |
| TC-AI-004 | Deväť odmietnutí pred odoslaním (401, ďalší kľúč, prázdny vstup, 501 znakov, >8 KiB, neplatný JSON, dátum ±3, súhlas false/chýba) — nula volaní, nula riadkov | integrácia |
| TC-AI-005 | Referenčný dátum ±1 deň sa prijíma | integrácia |
| TC-AI-006 | Viac než 100 kategórií → 422 pred volaním | integrácia |
| TC-AI-007 | Pripravený ukrajinský koncept: presné centy, kategória, včerajšok, pôvod, verzie; payload bez ID, e-mailu a JWT | integrácia |
| TC-AI-008 | 15 transportných fixtúr: null mena pri USD, nesúlad referenčného dátumu, neznáma referencia, 180-vs-18, vymyslená poznámka, odmietnutie, nedokončená odpoveď, neplatná obálka, upstream 429 a 500, presmerovanie, telo 128 KiB nad limitom 64 KiB, zámer nesúvisiaci s výdavkom | integrácia × `fixtures/transport-cases.json` |
| TC-AI-009 | Izolácia kontextu kategórií medzi používateľmi | integrácia |
| TC-AI-010 | Globálny denný limit platí naprieč 8 súbežnými používateľmi; Retry-After | integrácia |
| TC-AI-011 | Timeout poskytovateľa → 504; neúspešné pokusy si ponechajú rezerváciu; nasleduje minútový limit | integrácia |
| TC-AI-012 | Denné počty pretrvajú reštart | integrácia |
| TC-AI-013 | Jedna prebiehajúca požiadavka na používateľa; prerušenie klientom uvoľní miesto | integrácia |
| TC-AI-014 | Logy obsahujú iba kódy výsledku | integrácia |

| TC-AI-015 | Opakovanie s kľúčom, poradie kľúčov, 20 súbežných uložení s rovnakým kľúčom → 1 riadok | idempotencia; pytest |
| TC-AI-016 | Konflikt 409; kľúče podľa používateľa; rôzne kľúče a duplikáty bez kľúča zostávajú oddelené | idempotencia; Newman 11; pytest |
| TC-AI-017 | Opakovanie po zmazaní → 409, bez obnovenia; opakovanie po úprave zachová úpravu | idempotencia; Newman 11 |
| TC-AI-018 | Neplatné kľúče a uloženia s kľúčom bez dátumu → 400; cudzia kategória odmietnutá | idempotencia; Newman 11 |
| TC-AI-019 | Kľúč pretrvá reštart; databáza bez nových tabuliek sa aktualizuje dvakrát | idempotencia |
| TC-AI-020 | Sieťová ochrana: fetch, TCP a TLS na verejné hosty odmietnuté; loopback povolený; živý server bez falošného poskytovateľa zlyhá 502 | sieťová ochrana |
| TC-AI-021 | Vyhodnocovač odmieta vynechaný či upravený riadok, prázdny korpus a chýbajúci súbor | kontroly vyhodnocovača |
| TC-AI-022 | Vyhodnocovač zlyhá pri nesprávne označenom riadku, samých unsupported odpovediach, chybách a nule riadkov | kontroly vyhodnocovača |
| TC-AI-023 | Produkčná ochrana: 180-vs-18, null mena pri USD, neznáma referencia | kontroly vyhodnocovača |
| TC-AI-024 | Demo: banner, príklady EN/UK/SK, neznámy text DEMO_UNSUPPORTED, chýbajúca kategória, ignorovaný kľúč z prostredia, bežný server zostáva vypnutý | demo testy; demo v prehliadači |
| TC-AI-025 | Prehliadač: súhlas nezaškrtnutý, žiadne volanie pred Suggest | `ai-entry.spec.js` |
| TC-AI-026 | Prehliadač: pripravený koncept sa skontroluje a uloží až po Save; manuálne Add nedotknuté | `ai-entry.spec.js` |
| TC-AI-027 | Prehliadač: needs-input blokuje Save do opravy | `ai-entry.spec.js` |
| TC-AI-028 | Prehliadač: vysvetlenie unsupported; po chybe poskytovateľa je možné pokračovať | `ai-entry.spec.js` |
| TC-AI-029 | Prehliadač: odpoveď po Cancel / po úprave textu sa nepoužije | `ai-entry.spec.js` |
| TC-AI-030 | Prehliadač: dvojité Save → jeden riadok; stratená odpoveď → neistý stav → opakovanie s rovnakým kľúčom → jeden riadok | `ai-entry.spec.js` |
| TC-AI-031 | Prehliadač: dátum z minulého mesiaca hlási "Saved for …" | `ai-entry.spec.js` |
| TC-AI-032 | Prehliadač: značkovanie sa zobrazí ako text, nikdy sa nespustí | `ai-entry.spec.js` |
| TC-AI-033 | Prehliadač: 500 emoji sa zmestí, 501 nie (kódové body) | `ai-entry.spec.js` |
| TC-AI-034 | Prehliadač: otvorená klávesnica, focus, Escape, návrat focusu; vypnutá funkcia skryje vstup | `ai-entry.spec.js` |
| TC-AI-035 | Prehliadač 320×568: všetky kontrolné polia aj Save dostupné, bez vodorovného posúvania | `ai-entry.spec.js` |
| TC-AI-036 | BUG-014: zoznam kategórií ≥ 120 px, vidno dva riadky, tok sa dokončí pri 320×568 a 375×667 | `add-layout.spec.js` |
| TC-AI-037 | Vstupné tlačidlo nikdy neprekrýva sumu (4 rozmery obrazovky) | `add-layout.spec.js` |
| TC-AI-038 | BUG-019: priveľký JSON → 413 PAYLOAD_TOO_LARGE | Newman 11; pytest |
| TC-AI-039 | R1–R4: prilepené kódy mien, mínus pred značkou, číslice prilepené k písmenám, dátumy s dňom týždňa / „ago“ nikdy nevytvoria pripravený koncept | `normalize.test.js` R1–R4 |
| TC-AI-040 | R5: jedna nesprávna nenulová suma alebo dátum spôsobí zlyhanie vyhodnotenia | `evaluator.test.js` R5 |
| TC-AI-041 | R6–R8: tiché uloženie končí „not confirmed“; chybná odpoveď 201 zachová kľúč; opustenie obnoví ovládacie prvky | `ui-state.test.js` |
| TC-AI-042 | R9: odpoveď doručená napriek abortu sa nepoužije (kontrola generácie) spolu s mutačnou kontrolou | `ui-state.test.js` |
| TC-AI-043 | L1–L6: živý vyhodnocovač potrebuje vlastný limit, nikdy nepoužije ani nezvýši pilotné limity aplikácie ani jej DB, stabilní používatelia, holdout iba raz, suchý beh preukázaný ochranou | `evaluator-live.test.js` |
| TC-AI-044 | L7: účtovaná nedokončená alebo neplatná odpoveď poskytovateľa si zachová spotrebu tokenov (vrátane reasoning tokenov) | `openai-adapter.test.js` L7; `evaluator-live.test.js` L4 |
| TC-AI-045 | U1–U2: odpoveď či 401 starej relácie sa nedostane k novej osobe; kategória zmazaná pred Save sa odmietne, znovu načíta a nový výber dostane nový kľúč | `ui-state.test.js` U1, U2 (s mutačnými kontrolami) |

| TC-AI-046 | N1: živý vyhodnocovač odmieta databázu aplikácie dosiahnutú rovnakou cestou, relatívnym zápisom či zápisom s inou veľkosťou písmen, cez junction/symlink adresára, hard link, symlink súboru (kde sa dá vytvoriť), ešte nevytvorený súbor v aliasovanom adresári, predvolený `data/wallet.db` s `DB_PATH` alebo bez neho, sprievodný názov SQLite a alternatívny dátový tok Windows — exit 2, nula volaní, kontrolné bajty a schéma nezmenené; odlišná DB vyhodnocovania funguje, zachová kvótu a suchý beh ju číta bez zmeny | `eval-db-identity.test.js` N1.1–N1.7 (kontroly M-N1a…M-N1e, M-N1ab) |
| TC-AI-047 | N2: živé `--split all` sa odmietne; dev sa registra nikdy nedotkne; prvý beh holdout sa zaznamená s korpusom, modelom a verziami, opakovanie sa odmietne, odôvodnené opakovania zachovajú históriu; dva súťažiace procesy → jeden beh; zabitý beh si ponechá rezerváciu; počíta sa aj chyba poskytovateľa; holdout beh nezmestiteľný do dnešného limitu sa odmietne pred rezerváciou; staré riadky registra sa zachovajú a počítajú; nesúvisiaci komentár neumožní nový prvý beh | `eval-holdout.test.js` N2.1–N2.9 (kontroly M-N2a…M-N2g) |
| TC-AI-048 | N3: nesledovaná zmena normalizátora či vyhodnocovača mení zaznamenanú identitu; tajomstvá, databázy a reporty nevstúpia do manifestu; zmena počas behu sa nahlási; checkout a kópia bez Gitu dajú rovnaký manifest a rovnaký zoznam súborov ako `git ls-files`; odkazy sa nenasledujú; chýbajúce povinné vstupy sa pomenujú | `eval-provenance.test.js` N3.1–N3.7 (kontroly M-N3a…M-N3c) |
| TC-AI-049 | N4: reporty zo švu živých testov a z fixtúr vykresľujú požiadavky, spotrebu, rozsah a verdikt bez nedefinovaných hodnôt; 216 kombinácií rendereru; rovnaký nadpis pre PASS/FAIL/INCOMPLETE; neznáma spotreba nikdy nie je 0; pilot nikdy nie je akceptácia, verdikty dev a holdout sú odlišné; skutočné a falošné požiadavky oddelené; žiadna vymyslená cena; Markdown súhlasí s JSON | `eval-report.test.js` N4.1–N4.8 (kontroly M-N4a…M-N4c) |
| TC-AI-050 | Výber poskytovateľa: predvolené openai/off; neznámy poskytovateľ nič nezapne; predpoklady každého poskytovateľa pomenované bez hodnôt; žiadny fallback; aplikácia nikdy nevytvorí Gemini (jednotkový test aj skutočný server s nainštalovaným, ale nepoužitým falošným OpenAI), pevná správa 503, uloženie cez klávesnicu funguje, v logoch nie je kľúč | `provider-selection.test.js` P1–P8 (kontroly M-P1…M-P3) |
| TC-AI-051 | Adaptér Gemini (generateContent od S31, D-044; predtým Interactions API): presná požiadavka `POST models/{model}:generateContent` s nezmenenou schémou v `responseJsonSchema`, kľúč iba v `x-goog-api-key`, nebezpečné ID modelov odmietnuté, bez presmerovaní; odpoveď Gemini dá rovnaký koncept ako OpenAI a spoločné ochrany stále odmietajú; chybné/skrátené/priveľké/blokované/prerušené odpovede, viac kandidátov alebo viac textov; spotreba z `usageMetadata` vrátane thought tokenov; timeout, abort, 429/503/5xx/4xx a sieťová chyba; žiadny kľúč v chybách; sieťová ochrana blokuje skutočný host; odpoveď mimo 2xx zachová iba číselný HTTP stav, nikdy telo či hlavičky, a chyba aplikácie zostáva všeobecná (D-042); zdokumentovaný tvar GenerateContentResponse; thinking odpovede (S32): myšlienkové časti a časť len so signatúrou pred jedinou konečnou textovou časťou JSON sa prijímajú, text myšlienky sa nikdy neextrahuje, nevracia ani neloguje, jediná konečná textová časť musí byť posledná; volanie funkcie/médiá/kód/neznáme/chybné časti a myšlienka po odpovedi sa odmietajú, výstup porušujúci schému sa odmieta aj po myšlienke | `gemini-adapter.test.js` G1–G13 (kontroly M-G1…M-G10; M-H0 green, M-H1…M-H5 red; S31 M-A0 green, M-A1…M-A9 red; S32 M-T0 green, M-T1…M-T13 red) |
| TC-AI-055 | Zoznam modelov Gemini iba na čítanie (D-044): iba `GET /v1beta/models`, po stránkach; každý názov modelu Gemini s generateContent áno/nie; nastavený model dostupný / nedostupný pre tento kľúč / uvedený bez generateContent, iba presné ID, kandidáti sa nikdy nevyberajú; 404/401/403/500/presmerovanie poskytujú len stav, chybné alebo priveľké zoznamy sa nedajú použiť, bez úniku tela/hlavičky/kľúča; výstupné kódy; žiadna požiadavka generateContent ani Interactions, nezapíše sa súbor, report ani databáza; bez kľúča či modelu sa nič nespustí; testovací šev vyžaduje skutočnú ochranu | `gemini-models.test.js` M1–M8 (kontrola M-M0 green; M-M1…M-M10 red) |
| TC-AI-053 | Testovací šev vyhodnocovača (D-041): napísané `WALLET_NO_NETWORK_GUARD=active` bez skutočnej ochrany nič neotvorí; dôkaz ochrany platí iba v procese a ruší sa po výmene funkcie connect; falošné URL mimo loopbacku, s inou schémou, prihlasovacími údajmi, cestou, query, fragmentom alebo chýbajúcim/neplatným portom sa odmietnu pred databázou vyhodnocovania, reportom či požiadavkou; skutočná ochrana s obyčajnou loopback URL stále dosiahne falošný server | `eval-test-seam.test.js` T1–T5 (kontrola M-T0 green; M-T1…M-T10 red) |
| TC-AI-054 | Kĺzavé okno vyhodnocovača (D-043): najviac 5 volaní poskytovateľa v ľubovoľných kĺzavých 10 minútach, uložených v databáze vyhodnocovania; šieste volanie alebo beh plánujúci viac než voľné miesta či viac než 5 sa odmietne pred požiadavkou s časom ďalšej dostupnosti; atómová rezervácia pri odoslaní naprieč 8 procesmi a 3 paralelnými vyhodnocovačmi; neúspešné, 4xx a vypršané volania si ponechajú miesto; expirácia presne po +10 min, spätné nastavenie hodín sa stále počíta, riadky sa nikdy nemažú; pretrvanie po reštarte; čítanie iba na čítanie nič nezapíše; odmietnutie počas behu ho zastaví ako INCOMPLETE; `wallet.db` a pilotné dôkazy v checkoute sú bajtovo identické; vyhodnocovač nečíta žiadny limit volaní aplikácie, takže pri predvolenom aplikačnom limite 3 za minútu (aj 1) `--limit 5` uskutoční všetkých päť volaní bez čakania a šieste odmietne okno | `eval-window.test.js` W1–W13 (kontrola M-W0 green; M-W1…M-W12 red) |
| TC-AI-052 | Gemini vo vyhodnocovači: bez kľúča alebo pri neznámom poskytovateľovi sa nič nespustí a nikdy sa neprevezme kľúč OpenAI; požiadavky dosiahnu iba lokálny falošný Gemini server; report pomenuje poskytovateľa a model; kľúč sa neobjaví na stdout ani v reportoch; register holdout oddeľuje poskytovateľov, pričom kľúče S24 zostanú a registre S24 sa migrujú; oznámenie suchého behu; test runner čistí `GEMINI_*`/`GOOGLE_*`; odpoveď mimo 2xx sa hlási po riadkoch aj celkovo iba číselným HTTP stavom, bez upstream tela či hlavičky, promptu, opisu alebo kľúča (D-042) | `eval-gemini.test.js` E1–E8 (kontroly M-E1…M-E6, M-S1; M-H1, M-H2, M-H6…M-H8 red) |


<a id="5-what-these-tests-cannot-tell-you"></a>

## 5. Čo vám tieto testy nemôžu povedať

- Či skutočný model dobre extrahuje. Výstupy fixtúr sú ideálne odpovede
  podľa označení; overujú normalizátor a vyhodnocovač
  (`MODEL_QUALITY=NOT_MEASURED`).
- Či skutočný endpoint OpenAI prijme požiadavku presne v zostavenom tvare.
  Adaptér sleduje zdokumentovaný tvar Responses REST a testuje sa proti
  falošnému serveru, ktorý ho napodobňuje; skutočná služba nebola volaná.
- To isté platí pre Gemini: adaptér a `fake-gemini.js` sledujú zdokumentovaný
  tvar generateContent. Žiadna skutočná požiadavka na Gemini úspešne
  nedobehla, preto tvar skutočnej thinking odpovede zostáva nevidený,
  hoci parser prijíma myšlienkové časti pred konečným textom.
- Skrytie vstupu v prehliadači pri `WALLET_AI_PROVIDER=gemini` sa preukazuje
  dvoma prepojenými krokmi, nie jedným testom prehliadača: skutočný server
  hlási vypnutú schopnosť (P7) a existujúci test prehliadača dokazuje,
  že vypnutá schopnosť skryje vstup (TC-AI-034).
- Správanie na fyzickom zariadení. Veľkosti telefónov sú emulované rozmery
  Chromium; obrazovková klávesnica sa nesimuluje.
- Kontrola počítadla generácie iba na úrovni komponentu: testy prehliadača
  nedosiahnu okno, keď sa odpoveď vyrieši tesne pred abortom, preto
  `ui-state.test.js` spúšťa skutočný modul s fetch ignorujúcim abort (R9).
  Prepnutie účtu počas čakajúcej požiadavky a kategória zmazaná pred Save
  (U1, U2) sú tiež len na úrovni komponentu: produkt nemá mazanie
  kategórií a prehliadačová sada neprepína účty počas požiadavky.
- Obnovenie stránky počas neistého uloženia: nespracúva sa ani netestuje;
  koncept a jeho kľúč sú len v pamäti (plán §14.3 #15).
- Či 600 výstupných tokenov stačí reasoning modelu (otvorené riziko R-L1).
- Kontrola databázy vyhodnocovania voči procesu, ktorý medzi kontrolou
  a otvorením vymení priečinky alebo súbory. Spúšťa sa dvakrát
  (pred čítaním a tesne pred otvorením); silnejšie tvrdenie sa nerobí.
- Symbolické odkazy súborov na tomto účte Windows: ich vytvorenie vyžaduje
  oprávnenie, ktoré tento účet nemá, preto sa N1.4b tu hlási ako
  preskočený. Junction, hard link a porovnanie identity súboru sú testované.
  Na Linuxe by sa prípad so symlinkom spustil; vzdialené CI nebolo spustené.
