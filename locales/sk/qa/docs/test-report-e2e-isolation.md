[English](../../../../qa/docs/test-report-e2e-isolation.md) · **Slovenčina**

<a id="main-playwright-e2e-database-isolation--local-verification"></a>

# Izolácia databázy hlavného Playwright E2E — lokálne overenie

[← Späť na nastavenie testov](../../docs/testing.md) · [Ďalej: plán testov →](test-plan.md)

<a id="scope-and-original-gap"></a>

## Rozsah a pôvodná medzera

Predchádzajúca hlavná konfigurácia Playwright vždy odovzdávala serveru
`data/e2e.db` a nerešpektovala `DB_PATH` volajúceho. Preto opakovane používala
jeden súbor medzi spusteniami. Ide o chybu izolácie/návrhu; nemožno z nej
vyvodzovať historické 429, rýchlosť rastu databázy ani stratu používateľských
dát. V rámci jedného spustenia samostatní testovací používatelia stále
zdieľajú ten istý jednorazový server, súbor SQLite a obmedzovač prihlásenia
podľa IP.

<a id="local-change"></a>

## Lokálna zmena

`qa/e2e-runner/run.js` je mimo adresára špecifikácií Playwright `qa/e2e/`.
Spravuje procesy Wallet servera a podradeného Playwrightu, čaká na loopback
health po hlásení svojho servera o počúvaní a potom čaká na ukončenie oboch
podradených procesov pred vymazaním overeného adresára dočasnej databázy.
Obsadený port spôsobí zlyhanie namiesto použitia cudzieho servera. Priame
`playwright test` nemá záložné spustenie vývojového servera. Rodičovský proces
aj podradené Node procesy dostávajú ochranu siete offline; zdedené premenné
providera/autentifikácie/databázy ani `.env` sa do nich nenačítavajú. Režim
AI aplikácie je vypnutý.

Každé predvolené spustenie vytvára nový vlastný dočasný adresár. Staré
`data/e2e.db` a predvolené aplikačné `data/wallet.db` nikdy nie sú cieľmi
čistenia. Explicitný `DB_PATH` musí byť nový súbor `.db` v existujúcom
kanonickom rodičovskom adresári a je vyhradený výlučne; existujúce súbory,
chránené názvy, sprievodné súbory a známe aliasy odkazov zlyhajú pred štartom.
Explicitné súbory sa ponechávajú volajúcemu, neodstraňujú sa spolu s
predvolenými dočasnými dôkazmi.

<a id="controls-and-results"></a>

## Kontroly a výsledky

Prvé spustenie kontrol s regresiou na začiatku bolo **0/5**: asercia pevného
`e2e.db` zlyhala podľa očakávania, zatiaľ čo ďalšie štyri mohli iba hlásiť, že
nový runner ešte neexistuje. Tieto štyri zlyhania samy osebe nedokazovali
konkrétne staré správanie životného cyklu. Keď runner už existoval, ale ešte
nebol zapojený, kontroly boli **4/5**; zostávajúce zlyhanie správne označilo
starý vstup konfigurácie/CI. Po zapojení a presunutí servisného kódu mimo
prehliadačových špecifikácií mala kombinovaná cielená Node sada **24/24 PASS**
(12 kontrol životného cyklu E2E a 12 existujúcich overovacích kontrol).
Nezmenená statická vlastná kontrola mala **8/8 PASS**, vrátane C5. C5 skenuje
text prehliadačových špecifikácií; jej zelený výsledok nedokazuje, že každé
runtime čakanie je typu web-first. Pripravenosť/ukončenie služby používajú
ohraničené časovače oddelene od asercí prehliadača.

Kontroly životného cyklu pokrývajú odlišné čerstvé predvolené databázy,
odmietnutie existujúcich a chránených explicitných ciest bez zmeny sentinelových
bajtov, odmietnutie hard linku, odmietnutie čistenia pri nahradenom adresári,
zachovanie pri nepotvrdenom podradenom procese, skutočný úspech a zlyhanie
podradeného procesu, skutočný jednorazový Wallet server, skutočný zachovaný
explicitný override, obsadený port, skoré/predčasné ukončenie servera,
signalizovaný prehliadač a odstránené zdedené premenné prostredia.
Po týchto kontrolách a nezmenenej vlastnej kontrole sa presne raz spustilo celé
`npm run test:e2e` na lokálnom strome pred ochranou sprievodných súborov:
**192/192 PASS** na telefóne a desktope za 27.3 sekundy. Rodič potvrdil
ukončenie servera a odstránenie svojho predvoleného adresára. Staré `data/e2e.db`
malo predtým aj potom rovnakú dĺžku súboru a čas poslednej úpravy; táto kontrola
metadát nečítala jeho obsah ani nedokázala zhodu bajtov. Predvolené aplikačné
`data/wallet.db` zostalo neprítomné. Ide o lokálne vykonanie, **nie** o nový
výsledok GitHub CI.

<a id="2026-10-11-adjacent-sidecar-correction"></a>

## 2026-10-11 oprava susedných sprievodných súborov

Prvé kontroly explicitnej cesty odmietali sprievodný súbor **ako názov
`DB_PATH`**, ale neskúmali vopred existujúci `new.db-wal`, `new.db-shm` ani
`new.db-journal` vedľa inak nového `new.db`. Tri jednorazové sondy pred opravou
taký základ prijali; žiadna neotvorila SQLite ani sa nedotkla aplikačnej
databázy. Nová regresia najprv zlyhala na `-wal`, pretože základ bol vytvorený.
Runner teraz používa `lstat` na všetky tri susedné názvy pred výlučnou
rezerváciou `wx`, takže aj visiaci symlink sa považuje za kolíziu, nie za
neprítomný súbor. Sprievodný súbor nečíta ani nemaže.

Konečné dotknuté Node/overovacie kontroly: **26 úspešných, 1 preskočená,
0 neúspešných**. Všetky tri prípady bežných sprievodných súborov prešli
kontrolami alokácie aj nespustenia podradeného procesu; zachovali sentinelové
bajty a identitu súboru, pričom základ zostal neprítomný. Voliteľný fixture
visiaceho symlinku bol preskočený, pretože táto relácia Windows nevie taký
symlink vytvoriť; netvrdí sa tu vykonanie príslušnej vetvy kódu.
Nezmenená statická vlastná kontrola má **8/8 PASS**. Vyššie uvedený plný
prehliadačový výsledok **192/192** predchádza tejto ochrane; nebol opakovaný ani
preznačený za dôkaz najnovšieho zdrojového stromu. Vzdialené CI zostáva
neoverené.

<a id="remaining-limits"></a>

## Zostávajúce limity

Predvolený lokálny port je 3002, preto dva súbežné príkazy používajúce tento
port nemôžu bežať naraz; bezpečný `QA_E2E_PORT` môže zvoliť iný lokálny port.
Násilné ukončenie rodiča môže zanechať jeho ignorovaný dočasný adresár.
Neskoršie spustenia nečistia staré názvy, pretože nevedia dokázať vlastníctvo.
Volajúcim zadaná nová databáza sa ponechá aj po neúspešnom spustení. Sieťová
ochrana Node zabraňuje externým Node TCP/TLS volaniam, nie každej možnej
natívnej požiadavke prehliadača. Táto predbežná kontrola sprievodných súborov
nemôže zabrániť inému procesu vytvoriť sprievodný súbor po kontrolách `lstat`
a pred otvorením nového základu v SQLite; netvrdí sa záruka proti pretekom
na nepriateľskom súborovom systéme. Tento výsek neprepracúva adresáre ukážok
AI ani prístupnosti a z lokálneho overenia sa nevyvodzuje vzdialené GitHub CI
ani nahratie artefaktov.
