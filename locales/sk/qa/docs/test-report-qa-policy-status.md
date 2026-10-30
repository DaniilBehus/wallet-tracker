[English](../../../../qa/docs/test-report-qa-policy-status.md) · **Slovenčina**

<a id="f20f21-qa-policy-and-status-correction--local-documentation-report"></a>

# Oprava politiky a stavu QA F20/F21 — lokálna dokumentačná správa

[← Späť na README](../../README.md#qa-evidence) · [Aktuálny stav QA](../../docs/qa-status.md) · [Plán testov](test-plan.md) · [Ďalej: register chýb →](../../log/BUGS.md)

K 2026-10-13 ide o **výlučne dokumentačnú, necommitnutú lokálnu opravu** na vetve `work/claude-wallet-2026-09-24` s commitnutým základom `b270355c8c850282b10cc0a7bdeb81c88b784765`. Neuzatvára chybu, necertifikuje vydanie, nezaznamenáva UAT vlastníka ani neoveruje nové vzdialené spustenie CI. [Živý index stavu](../../docs/qa-status.md) treba znovu porovnať s neskorším zdrojom, Gitom a CI; staré správy o spusteniach si zachovávajú pôvodné dátumy a výsledky.

<a id="changes-within-the-ordered-scope"></a>

## Zmeny v rámci objednaného rozsahu

| Súbor | Oprava |
|---|---|
| [`qa/docs/test-plan.md`](test-plan.md) | Oddeľuje vývojársku/lokálnu regresiu, akceptáciu vydania pre presné SHA a UAT vlastníka. Špinavý lokálny strom možno testovať s uvedeným základom a hashmi zdroja; oprava testu/fixture/orákula môže byť platná pri nezávisle očakávanom správaní a neoslabených aserciách. Nevyriešený Critical/High v stave `OPEN` **alebo** `IN PROGRESS` blokuje vydanie bez výslovnej zaznamenanej výnimky vlastníka. BUG-021 zostáva High/OPEN. Číslovanie vstupných/výstupných podmienok je postupné. Zdieľaný E2E proces/databáza/IP limiter a samostatné historické meranie k6 sú uvedené pravdivo. |
| [`docs/testing.md`](../../docs/testing.md) | Nahrádza tvrdenia o siedmich importných testoch a chýbajúcom adaptéri odkazmi na aktuálne offline batch a loopback-adapter testy. Adaptér je testovací demonštrátor, nie produktový konektor providera. Lokálna commitnutá zmena workflow sa už nenazýva necommitnutou; nevyvodzuje sa žiadne nové vzdialené spustenie. Nedatované počty v komentároch príkazov sa nahrádzajú generovanými správami o spustení. |
| [`qa/docs/accessibility-baseline.md`](accessibility-baseline.md) | Pridáva iba ukazovateľ na nahradenie aktuálnym stavom pred nedotknutou datovanou základňou. Obnovenie Escape/fokusu je commitnuté; úplné udržanie fokusu v modáli a kontrast zostávajú nepreukázané. |
| [`docs/analysis/database.md`](../../docs/analysis/database.md) | Zosúlaďuje text zdroja/pokrytia s datovaným dôkazom publikovania kategórií, pričom UAT vlastníka zostáva nepodpísané. |
| [`docs/qa-status.md`](../../docs/qa-status.md) | Nový index ohraničený zdrojmi pre lokálny základ, necommitnuté zmeny, historické publikovanie, chýbajúce nové CI kombinovaného stromu pre presné SHA, F19, BUG-005/021/022, neistotu pripravenosti a UAT vlastníka. |
| [`README.md`](../../README.md) | Jeden odkaz na index aktuálneho stavu v existujúcej navigácii QA. |
| [`log/BUGS.md`](../../log/BUGS.md) | Pridáva označené upozornenie hore a označenú opravu dole; pôvodné riadky, správy, stavy a historické znenie zostávajú po odstránení iba týchto dvoch dodatkov bajtovo identické. |
| Táto správa | Zaznamenáva zmeny, kontroly a limity bez úpravy datovaných dôkazov o spustení. |

<a id="commit-facts-with-boundaries"></a>

## Fakty o commitoch a ich hranice

- Ohraničený lokálny `git log -S` a kontrola commitnutých blobov zaradili CSS pre krátky telefón a odpoveď `entity.too.large` → 413 do public-ready koreňového commitu `2face59`. Ich frázy `S23 · uncommitted` v historickom registri chýb opisovali skorší čas záznamu; register teraz pridáva odkaz namiesto prepisu tohto pôvodu.
- Lokálny HEAD `b270355` (`test: add accessibility regression and failure evidence`) obsahuje `public/app.js`, accessibility specs a `.github/workflows/ci.yml`; jeho commitnutý workflow obsahuje príkaz prístupnosti. To dokazuje prítomnosť v zdroji, nie to, že **necommitnutý kombinovaný strom** má zelené spustenie GitHubu alebo nahraté artefakty.
- [Datovaný dôkaz publikovania 2026-09-29](../../docs/analysis/README.md#dated-publication-evidence--2026-09-29) zaznamenáva úspešné CI pre `ed22c71`, nie pre tento neskorší strom. [UAT kategórií](uat-category-limits.md) zostáva nepodpísané.

<a id="checks-and-limits"></a>

## Kontroly a limity

Po úpravách na lokálnom zdrojovom strome:

| Kontrola iba na čítanie/cielená kontrola | Pozorovaný výsledok |
|---|---|
| `node scripts/check.js` s lokálnym Node 22.14.0 | 8 úspešných, 0 preskočených, 0 neúspešných; iba statické invarianty |
| `node --test qa/gates/traceability.test.js` | 21 úspešných, 0 neúspešných, 0 preskočených; iba kontroly v pamäti |
| `node scripts/traceability.js` | Statický PASS pre existujúci katalóg; bez sémantického tvrdenia alebo tvrdenia o vykonaní, F19 zostáva samostatné |
| Kontrola relatívnych cieľov Markdown odkazov v zmenených existujúcich/nových dokumentoch | Overených 259 lokálnych cieľov, 0 chýbajúcich po oprave jedného odkazu v správe; kontroluje ciele súborového systému, nie každý GitHub anchor alebo vzdialenú URL |
| Spätné načítanie doplnenej histórie | Po odstránení iba označeného upozornenia/dodatku je SHA-256 `log/BUGS.md` `41771ab1a063072eac0a06f671cdc54a027fa863794c841afa339093c2bdd7cf`, čo sa zhoduje so zmrazeným predchádzajúcim súborom. Po odstránení iba nového odkazu je SHA-256 základne prístupnosti `fed051ee997f51731039f08954df003af02bf23c1a9bd2373c9dd76376bc80d2`, čo sa zhoduje s jej predchádzajúcim súborom. |
| Rozsah a biele znaky | Všetkých 49 ostatných zmrazených hashov zdroja sa zhoduje so základňou; stav Gitu obsahuje iba 53 už existujúcich ciest, dva samostatne zmrazené existujúce dokumenty a dva nové objednané súbory. Index je prázdny; `git diff --check` končí 0; oba nové Markdown súbory nemajú koncové medzery. |

Úplné sady, server/prehliadač, databáza, provider, sieť, vzdialené CI, UAT vlastníka, Git commit ani push sa v tejto dokumentačnej úlohe **nespustili ani nevykonali**. Príčina [BUG-005](defects/BUG-005-e2e-timeout-on-slow-runs.md) a skorší [timeout pripravenosti](test-report-runtime.md) zostávajú nevysvetlené. Táto správa nie je výnimkou z blokovania vydania pre BUG-021 ani pre iný nevyriešený nález High/Critical. Vykonateľný inventár F19 zostáva neúplný a nevyhlasuje sa žiadna zručnosť vlastníka.
