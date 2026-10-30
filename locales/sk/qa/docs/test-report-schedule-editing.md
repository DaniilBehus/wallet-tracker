[English](../../../../qa/docs/test-report-schedule-editing.md) · **Slovenčina**

<a id="f09-schedule-edit-ui--local-verification"></a>

# F09 úprava plánu v UI — lokálne overenie

[← Späť na README](../../README.md#qa-evidence) · [Kontrakt úpravy](analysis-schedule-editing.md) · [Ďalej: nastavenie testov →](../../docs/testing.md)

Dátum: 2026-10-17. Report dokumentuje necommitnutú
lokálnu opravu. Jej neskoršia samostatná revízia agentom
v danom rozsahu je zaznamenaná nižšie; nejde o vzdialený
beh CI, vydanie ani UAT vlastníka.

<a id="beforeafter-evidence"></a>

## Dôkazy pred opravou a po nej

Jediný plánovaný browserový test pred opravou v spravovanom
runneri zlyhal: existujúci vlastnený plán nemal ovládanie
`schedule-edit-{id}`. Samotné pridanie tlačidla umožnilo
tomuto malému testu prejsť 2/2, no **nedokázalo funkčnosť
formulára**. Prvý širší beh 12 testov potom zaznamenal
10 rovnakých timeoutov po kliknutí. Uchovaná stopa ukázala
`TypeError: Cannot set properties of null (setting 'value')`
v `openScheduleEditor`: nové HTML vstupy mali `data-testid`,
ale chýbalo im `id` používané selektormi aplikácie.
Po opakovanom zlyhaní sa práca zastavila; v nasledujúcej
obmedzenej oprave sa zosúladili všetky nové ID editora.
Celá úspešná cesta otvorenia, predvyplnenia, PATCH,
zachovania ID/bez POST potom prešla 1/1 pred pokračovaním
ostatných kontrol. Staršie červené behy zostávajú
červeným historickým dôkazom.

<a id="current-local-results"></a>

## Súčasné lokálne výsledky

| Kontrola | Výsledok a hranica |
|---|---|
| Doplnkové browserové kontroly úpravy plánu | 18/18 na telefóne a desktope: predvyplnenie/PATCH s rovnakým ID/bez ďalšieho plánu; Cancel/Escape/focus; posúvanie pri 320×568/udržanie Tab; validácia a server 404/409; konflikt zaplateného počtu/rovnosť/opätovné otvorenie/konverzia predplatného; commitnutá stratená odpoveď; zastaraná navigácia a novo prihlásený účet. Cudzie vlastníctvo 404 sa overuje aj proti skutočnému jednorazovému API; UI 404 je jasne označený testovací response seam. |
| Hlavná spravovaná browserová sada | 236/236 so štyrmi workermi na jednorazovom lokálnom serveri/databáze. Zahŕňa deväť nových scenárov v dvoch rozmeroch; katalóg ostáva na 280 prípadoch, nie 298. |
| AI v prehliadači | 50/50 s lokálnym falošným poskytovateľom; bez volania živého modelu. |
| Kontrakt | 18/18 vrátane existujúcich kontrol PATCH/pay/vlastníctva plánu a Pay s kľúčom; backend sa nemenil. |
| Čisté/statické | 105/105 kontrol zdrojov/brán, 13/13 kontrol plánu CI; aktuálny inventár zdrojov 280 hlavných ID, OpenAPI 21 operácií/308 lokálnych referencií, F13 280 ID/78 definícií pravidiel, `scripts/check.js` 8/8. Ide o štruktúrne kontroly, nie 280 úspešných behaviorálnych testov. |

UI odosiela len zmenené upraviteľné polia, nikdy ID
vlastnené serverom, počet zaplatených ani príznak active.
Po úspešnej odpovedi nasleduje nové čítanie plánov.
Odmietnutie serverom ponechá zadané hodnoty viditeľné
a vráti text tlačidla; stratená odpoveď po skutočnom
commite označí výsledok za neznámy. Modálne okno sa
zatvára pri navigácii/konci relácie a oneskorená
odpoveď nemôže zmeniť inú obrazovku či účet.
Neposkytuje optimistickú súbežnosť pre dva súčasné
editory; server zostáva autoritou pre vlastníctvo
a konflikty počtu zaplatených.

BUG-021 zostáva po lokálnej akceptácii **High/IN PROGRESS**;
overenie kombinovaného stromu, vzdialené CI na presnom SHA,
publikovanie a UAT vlastníka ešte čakajú. Žiadne historické
pozorovanie chyby sa neprepisuje, akoby sa nestalo.

<a id="scoped-independent-local-review--2026-10-17"></a>

## Nezávislá lokálna revízia v danom rozsahu — 2026-10-17

Nezávislá revízia agentom prijala F09 lokálne. Počet
prijatých zistení je teraz **24/25 (96% podľa počtu
zistení)**, nie miera pokrytia testov, námahy, času
či pripravenosti vydania. Prvý červený test a prvé
zlyhanie implementácie vyššie zostávajú dôkazom.
Revízia neodhalila ďalšiu známu chybu úpravy plánu;
nespustila vzdialené CI na presnom SHA, nezverejnila
zmenu, nevykonala UAT vlastníka ani neschválila vydanie.
