[English](../../../../qa/docs/test-report-evaluator-concurrency.md) · **Slovenčina**

<a id="evaluator-concurrency--local-qa-evidence-2026-10-10"></a>

# Súbeh vyhodnocovača — lokálne dôkazy QA, 2026-10-10

[← Späť na README](../../README.md#qa-evidence) · [Príkazy testov AI](../../docs/testing.md) · [Regresné kontroly](../../../../qa/ai/tests/eval-concurrency.test.js) · [Kontroly okna](../../../../qa/ai/tests/eval-window.test.js)

Ide o **necommitnutú lokálnu** opravu vyhodnocovača,
nie výsledok živého modelu, UAT vlastníka ani beh
GitHub CI. Testy použili jednorazové databázy SQLite,
skopírované koreňové adresáre zdrojov, syntetických
používateľov, falošných poskytovateľov na loopbacku
a offline sieťovú ochranu. Nepoužila sa skutočná
databáza aplikácie ani poskytovateľ.

<a id="controlled-failures-before-the-fix"></a>

## Riadené zlyhania pred opravou

Vyhodnocovač predtým vyhľadal stabilný syntetický e-mail,
vložil používateľa a inicializoval kategórie v oddelených
operáciách. Skopírovaný vyhodnocovač synchronizoval tri
detské procesy pred ich prvým get-or-create. Dva
nahlásili `UNIQUE constraint failed: users.email`
pred odoslaním požiadavky poskytovateľovi. Skorá verzia
tejto testovacej bariéry sa spustila aj pri druhom riadku
a vypršala; trvalá kontrola do nej teraz vstupuje
**raz na detský proces**. Experiment dokazuje mechanizmus
preteku, **nie** že bol príčinou skoršieho zlyhaného
celého behu AI, pri ktorom sa chyby detských procesov
neuchovali.

V inom skopírovanom vyhodnocovači injektovaná chyba
hneď po vytvorení predvolených kategórií nechala
pred opravou **jedného používateľa a desať kategórií**.
To ukázalo, že zlyhanie nevrátilo celú inicializáciu.
Pri pevnej počiatočnej časovej značke dva súbežné behy
navyše vypísali **rovnakú cestu reportu**; jeden pár
mohol nahradiť dôkaz druhého.

<a id="local-changes-and-after-checks"></a>

## Lokálne zmeny a následné kontroly

Vyhľadanie, vytvorenie používateľa, inicializácia
predvolených/vlastných kategórií a čítanie kategórií
teraz bežia v jednej synchrónnej transakcii
`BEGIN IMMEDIATE`. Cache procesu dostáva iba
commitnutý výsledok. Transakcia sa skončí pred prácou
poskytovateľa. Odvodzovanie stabilného e-mailu a
bežné kvóty sa nemenili.

Názov každého reportu teraz obsahuje náhodnú identitu
behu. Kompletné dočasné súbory JSON a Markdown sa
publikujú pod exkluzívnymi konečnými názvami; chyba
pri druhom linku odstráni súbory vlastnené daným
pokusom a nevypíše úspešný riadok `report:`.
Pomocný pohľad `*-latest.md` identifikuje jeden
dokončený nemenný Markdown report podľa názvu
súboru a uchová vykreslený obsah pre čitateľov.
Znamená **posledný dokončený zapisovač**, nie
najneskorší chronologický štart. Dva súbory netvoria
jednu atómovú filesystem transakciu; prerušenie
procesu medzi ich samostatnými linkmi môže stále
vyžadovať čistenie. Ak sa pomocný pohľad
nedá aktualizovať, dokončený pár zostáva
a vypíše sa varovanie.

Štyri nové cielené kontroly prešli **4/4**:
jeden úplný používateľ s desiatimi kategóriami
pri súbežnom nastavení; rollback na nula riadkov
používateľov/kategórií pri injektovanom zlyhaní;
dva rôzne úplné páry reportov pri pevných hodinách;
a čistenie/žiadne oznámenie úspechu pri injektovanej
chybe publikovania druhého súboru. Spolu s existujúcimi
kontrolami reportu/okna dotknutý beh prešiel **25/25**.
W9 stále vyžaduje najviac päť požiadaviek v kĺzavom
okne, jednu rezerváciu na požiadavku, rovnosť počtu
hlásených volaní a aspoň jedno odmietnutie pri šiestich
plánovaných volaniach. Teraz osobitne pomenuje
nečakaný exit 2, signál či chýbajúci výstupný kód,
aby sa prerušené nastavenie nevydávalo za cvičenie
kvóty.

<a id="combined-local-validation"></a>

## Kombinovaná lokálna validácia

| Príkaz | Pozorovaný výsledok |
|---|---|
| `npm run test:ai` | 240 prešlo, 1 preskočený, 0 zlyhalo (241 spolu); preskočená kontrola symlinku súboru vo Windows vyžaduje ďalšie oprávnenie |
| `npm run eval:ai` | 116/116 riadkov fixtúr; `MODEL_QUALITY=NOT_MEASURED` |
| `npm run test:gates` / `npm run check` | 23/23 kontrol; 8/8 kontrol, 0 preskočených |
| `npm run check:openapi` / `npm run test:contract` | 21/21 operácií, 298 referencií; 14/14 testov a 335 validovaných skutočných loopback HTTP odpovedí |

Skorší celý beh AI, ktorý zlyhal pri W9, zostáva
historickým **zlyhaním**. Riadený pretek nastavenia
vysvetľuje možný tvar zlyhania, nie nezaznamenanú
príčinu konkrétneho behu. Tu sa nemerali browserové
sady, vzdialené CI ani kvalita živého modelu.
Ďalšie zistenia auditu zostávajú oddelené.
