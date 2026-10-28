[English](../../../../qa/docs/analysis-schedule-editing.md) · **Slovenčina**

<a id="schedule-editing--local-ui-contract"></a>

# Úprava pravidelnej platby — kontrakt lokálneho rozhrania

[← Späť na README](../../README.md#qa-evidence) · [Základné požiadavky](../../spec/core-requirements.md#req-core-21) · [Ďalej: správa z lokálnych testov →](test-report-schedule-editing.md)

Toto je implementačný kontrakt F09, zaznamenaný pred zmenami rozhrania
dňa 2026-10-17. Historická správa BUG-021 cituje staršiu požiadavku §6.4;
ide o vtedy zaznamenané pozorovanie, nie o novo nájdený citát.
Aktuálna architektúra opisuje vytvorenie, kým aktuálne API už podporuje
`PATCH /api/schedules/{id}`. Rozhranie musí sprístupniť túto existujúcu
možnosť bez zmeny backendu alebo zmrazeného architektonického dokumentu.

| Pole rozhrania | Ukladané/PATCH pole | Pravidlo |
|---|---|---|
| Názov | `name` | Predvyplniť presne uložený text; neprázdny, najviac 60 znakov. |
| Suma | `amount_cents` | Zobraziť presnú desatinnú sumu v eurách, odoslať celé centy v podporovanom rozsahu. |
| Kategória | `category_id` | Vlastné ID alebo `null` pre nezaradenú/zmazanú kategóriu; server overuje vlastníctvo. |
| Deň | `day_of_month` | Celé číslo 1–31 vrátane zdokumentovaného obmedzenia na posledný deň mesiaca. |
| Dátum začiatku | `starts_on` | Presne uložený dátum ISO; autoritou dátumu zostáva server. |
| Voľba/počet splátok pôžičky | `total_count` | `null` pre predplatné alebo celé číslo 1–1200 pre pôžičku; server odmietne počet menší ako už zaplatený, rovnosť pôžičku uzavrie a zvýšenie počtu uzavretú pôžičku znovu otvorí. |

Dialóg sa otvorí z vlastného riadka Schedules a predvyplní sa z jeho úplného
objektu API. Save odošle **jeden PATCH na ID daného riadka**, nikdy POST.
Neposiela sa `id`, `user_id`, `paid_count` ani `active`. Úspech nahradí
viditeľný riadok z nového čítania zoznamu bez prepísania historických
výdavkov alebo počtu zaplatených splátok. Existujúca čakajúca akcia Pay
stále používa svoje zmrazené predpoklady; úprava túto platobnú identitu
ticho neopakuje ani nenahrádza.

Cancel/Escape/kliknutie na pozadie **pred Save** zatvoria editor bez PATCH;
ak prvok, ktorý ho otvoril, stále existuje, vráti sa naň fokus. Navigácia
alebo koniec relácie editor zatvorí a potlačí jeho oneskorenú spätnú
funkciu, ale nemôže vrátiť už odoslaný PATCH. Fokus natívneho modálneho
okna zostáva pri Tab/Shift+Tab vnútri a všetky polia a akcie sú
dosiahnuteľné pri 320×568. Zjavne neplatný vstup sa odmietne pred PATCH
so správou v dialógu. Serverové 404/409 alebo chyby validácie ponechajú
editor aj zadané hodnoty, ukážu odmietnutie a nikdy netvrdia úspešné
uloženie. Chyba prenosu môže nastať po potvrdení zápisu; rozhranie
musí povedať, že výsledok je neistý, nie že sa nič nezmenilo.
Každé asynchrónne dokončenie je viazané na účet/reláciu/obrazovku/dialóg,
v ktorom sa akcia začala.

Akceptácia potrebuje svedectvo o chýbajúcom Edit pred opravou, potom
prehliadačové kontroly uložených ID/polí a metódy/počtu požiadaviek
po oprave. Zahrňte konverzie medzi predplatným a pôžičkou, konflikt
počtu zaplatených/rovnosť/znovuotvorenie, chýbajúce/cudzie vlastníctvo
cez skutočné API, odmietnutie bez falošného úspechu, zrušenie,
klávesnicu a oneskorenú spätnú funkciu. Prehliadačové kontroly dopĺňajú
nezmenený katalóg 280 prípadov; kontraktové testy a statické kontroly
majú osobitné hranice dôkazov. [Správa z behu](test-report-schedule-editing.md).
