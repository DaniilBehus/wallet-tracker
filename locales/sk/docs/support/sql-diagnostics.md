[English](../../../../docs/support/sql-diagnostics.md) · **Slovenčina**

<!-- locale-links-v1: source-relative links rebased for locales/sk -->

<!-- Original English heading anchors retained for stable cross-language references. -->
<a id="sql-diagnostics"></a>
# SQL diagnostika

[← Podporný balík](README.md) · [Prevádzková príručka](runbook.md)

Dotazy len na čítanie pre najčastejšie otázky podpory, každý s účelom, parametrami a tvarom správneho výsledku. Bežia proti SQLite databáze aplikácie (`DB_PATH`, predvolene `./data/wallet.db`) počas jej chodu: databáza je v režime WAL, takže ju čitateľ neblokuje.

`qa/python/test_sql_diagnostics.py` spúšťa každý dotaz z tejto stránky — priamo text blokov nižšie, nie kópiu — proti databáze naplnenej skutočnou aplikáciou cez spojenie bez možnosti zápisu. Overuje presne uvedené stĺpce aj zhodu s API, ak odpovedá na rovnakú otázku.

<a id="rules"></a>
## Pravidlá

- **Otvoriť databázu len na čítanie.** Každý dotaz je `SELECT`, no nezmeniteľnosť zaručuje spojenie. Pomocník ju otvorí cez `readonly: true`; nechcený `UPDATE` potom zlyhá namiesto vykonania.
- **Nikdy nevyberať `users.password_hash` ani `transaction_requests.response_json`.** Druhé pole ukladá celý výdavok vrátane poznámky.
- **Uvádzať ID, nie obsah.** Ticket potrebuje `user_id 7, schedule_id 3`, nie e-mail alebo používateľský názov úveru.
- Peniaze sú v centoch: `1250` je €12.50. Dátumy sú lokálne reťazce `YYYY-MM-DD`.

<a id="running-a-query"></a>
## Spustenie dotazu

Dotaz uložiť do súboru, napríklad `query.sql`, a z priečinka aplikácie spustiť pomocníka Node nižšie. Node je prítomný, pretože na ňom aplikácia beží; pomocník používa jej SQLite ovládač.

Windows PowerShell:

```powershell
@'
const Database = require(require.resolve('better-sqlite3', { paths: [process.cwd()] }));
const db = new Database(process.argv[2], { readonly: true, fileMustExist: true });
const params = Object.fromEntries(process.argv.slice(4).map((a) => a.split(/=(.*)/s).slice(0, 2)));
console.table(db.prepare(require('fs').readFileSync(process.argv[3], 'utf8')).all(params));
'@ | Set-Content -Encoding utf8 "$env:TEMP\wallet-query.js"
node "$env:TEMP\wallet-query.js" data\wallet.db query.sql user_id=7 month=2026-09
```

Linuxový alebo macOS shell:

```bash
cat > /tmp/wallet-query.js <<'JS'
const Database = require(require.resolve('better-sqlite3', { paths: [process.cwd()] }));
const db = new Database(process.argv[2], { readonly: true, fileMustExist: true });
const params = Object.fromEntries(process.argv.slice(4).map((a) => a.split(/=(.*)/s).slice(0, 2)));
console.table(db.prepare(require('fs').readFileSync(process.argv[3], 'utf8')).all(params));
JS
node /tmp/wallet-query.js data/wallet.db query.sql user_id=7 month=2026-09
```

Parametre sú páry `name=value` zodpovedajúce zástupným symbolom `:name`; hodnoty prichádzajú ako text, ktorý SQLite správne porovná s celočíselnými stĺpcami ID.

<a id="queries"></a>
## Dotazy

<a id="q0--find-a-persons-user-id"></a>
### Q0 · Vyhľadanie ID používateľa

Všetky ďalšie dotazy potrebujú `user_id`. Ľudia sa identifikujú e-mailom, preto sa adresa zadáva iba tu; registrácia ju ukladá orezanú a malými písmenami a vyhľadávanie robí to isté. (SQLite `lower()` pokrýva len ASCII: adresu s ne-ASCII písmenami treba zadať presne v uloženom tvare.)

```sql
-- query: user-id
-- params: email
-- returns: user_id, created_at
SELECT id AS user_id, created_at
FROM users
WHERE email = lower(trim(:email));
```

**Tvar:** jeden riadok alebo žiadny, ak adresu nepoužíva účet. `created_at` je v UTC (`YYYY-MM-DD HH:MM:SS`).

<a id="q1--a-months-total-to-compare-with-the-summary"></a>
### Q1 · Mesačný súčet na porovnanie so súhrnom

Keď mesačná obrazovka ukáže sporný súčet, ide o rovnaký súčet, ktorý `GET /api/summary?month=YYYY-MM` vracia ako `total_cents`.

```sql
-- query: month-total
-- params: user_id, month
-- returns: total_cents, expense_rows
SELECT COALESCE(SUM(amount_cents), 0) AS total_cents,
       COUNT(*) AS expense_rows
FROM transactions
WHERE user_id = :user_id
  AND spent_on >= :month || '-01'
  AND spent_on <= :month || '-31';
```

**Tvar:** presne jeden riadok; prázdny mesiac má `total_cents` 0 a `expense_rows` 0. Odlišný `total_cents` oproti súhrnu znamená chybný súhrn a defekt na eskaláciu. Pri zhode obrazovka ukazuje údaje správne a treba zistiť, ktorý výdavok človek nečakal: zobraziť ich cez API (`GET /api/transactions?from=…&to=…`), nie ručne týmto dotazom.

<a id="q2--the-limit-and-the-state-the-summary-derives-from-it"></a>
### Q2 · Limit a stav, ktorý z neho odvodzuje súhrn

Mesačná obrazovka hodnotí výdavky voči limitu v štyroch stavoch. Dotaz používa rovnaké pravidlá ako `limitState` v `src/settings.js`, preto sa jeho `limit_status` musí zhodovať so súhrnom.

```sql
-- query: limit-state
-- params: user_id, month
-- returns: settings_row, limit_cents, total_cents, limit_status
SELECT CASE WHEN s.user_id IS NULL THEN 0 ELSE 1 END AS settings_row,
       s.monthly_limit_cents AS limit_cents,
       t.total_cents,
       CASE
         WHEN s.monthly_limit_cents IS NULL THEN 'not_set'
         WHEN t.total_cents < s.monthly_limit_cents THEN 'within'
         WHEN t.total_cents = s.monthly_limit_cents THEN 'reached'
         ELSE 'exceeded'
       END AS limit_status
FROM (SELECT COALESCE(SUM(amount_cents), 0) AS total_cents
      FROM transactions
      WHERE user_id = :user_id
        AND spent_on >= :month || '-01'
        AND spent_on <= :month || '-31') AS t
LEFT JOIN settings AS s ON s.user_id = :user_id;
```

**Tvar:** presne jeden riadok. `limit_cents` čítať pozorne — tri rôzne situácie vyzerajú podobne:

| `settings_row` | `limit_cents` | Význam |
|---|---|---|
| 0 | NULL | Človek nikdy neuložil príjem ani limit. API hlási príjem 0 a žiadny limit. |
| 1 | NULL | Riadok nastavení existuje, ale limit nie je nastavený: `not_set`, nie nula. |
| 1 | 0 | Skutočný nulový limit. Už bez výdavkov je mesiac `reached` a každý výdavok ho zmení na `exceeded`. |

Presne minutý limit je `reached`, nie `exceeded`. Limit nikdy neblokuje uloženie, preto „nemohol som uložiť pre limit“ znamená iný problém.

<a id="q3--scheduled-payments-presses-of-pay-against-the-expenses-they-wrote"></a>
### Q3 · Plánované platby: stlačenia Pay a vytvorené výdavky

`paid_count` sa zvýši o jeden pri každom stlačení **Pay**, ktoré zapíše jeden výdavok s ID rozvrhu. Wallet nikdy neplatí sám: platba bez stlačenia nevznikla.

```sql
-- query: schedule-payments
-- params: user_id
-- returns: schedule_id, name, total_count, paid_count, active, linked_expenses, unlinked_payments
SELECT s.id AS schedule_id,
       s.name,
       s.total_count,
       s.paid_count,
       s.active,
       COUNT(t.id) AS linked_expenses,
       s.paid_count - COUNT(t.id) AS unlinked_payments
FROM schedules AS s
LEFT JOIN transactions AS t ON t.schedule_id = s.id AND t.user_id = s.user_id
WHERE s.user_id = :user_id
GROUP BY s.id
ORDER BY s.id;
```

**Tvar:** jeden riadok na rozvrh. `total_count` NULL znamená predplatné; číslo znamená úver s daným počtom splátok a `active` 0 ukončenie.

- `unlinked_payments` 0: každé stlačenie Pay má stále svoj výdavok.
- `unlinked_payments` nad 0: používateľ zmazal výdavok vytvorený platbou. Počet zostáva zámerne — platba nastala — preto ide o vysvetliteľný stav, nie poruchu. Aj preto môže mesiac zobrazovať menej splátok, než bolo zaplatených.
- `unlinked_payments` pod 0: na rozvrh odkazuje viac výdavkov než počet platieb. To nemá byť možné; eskalovať.

`name` je používateľský text. Použiť ho na nájdenie správneho rozvrhu, potom uvádzať `schedule_id`.

<a id="q4--keyed-saves-and-their-tombstones"></a>
### Q4 · Uloženia s kľúčom a ich tombstones

Uloženie s `Idempotency-Key` (používa ho AI kontrolná obrazovka) sa zaznamená raz na kľúč. Opakovanie rovnakého kľúča odpovedá z tohto záznamu — odpoveď má `Idempotency-Replayed: true` — a nepridáva nový riadok. Databáza teda ukazuje existujúce kľúče, nie frekvenciu opakovaní.

```sql
-- query: keyed-saves
-- params: user_id
-- returns: operation_key, transaction_id, created_at, state
SELECT r.operation_key,
       r.transaction_id,
       r.created_at,
       CASE WHEN t.id IS NULL THEN 'tombstone' ELSE 'live' END AS state
FROM transaction_requests AS r
LEFT JOIN transactions AS t ON t.id = r.transaction_id
WHERE r.user_id = :user_id
ORDER BY r.created_at DESC, r.operation_key;
```

**Tvar:** jeden riadok na kľúč. `live` znamená, že výdavok stále existuje. `tombstone` znamená jeho neskoršie zmazanie so zámerne zachovaným záznamom: oneskorené opakovanie potom vráti 409 namiesto obnovenia výdavku. „Po zmazaní som znovu stlačil uložiť a dostal konflikt“ je teda správne fungujúci návrh.

<a id="q5--todays-ai-quota-use"></a>
### Q5 · Dnešné využitie kvóty AI

AI návrhy majú denný strop globálne aj na osobu. Každý pokus, ktorý dosiahne poskytovateľa, spotrebuje miesto vrátane zlyhaného; tým sa bráni nekonečnému opakovaniu proti nefunkčnému poskytovateľovi.

```sql
-- query: ai-quota-today
-- params: user_id, day
-- returns: scope, count
SELECT scope, count
FROM ai_quota
WHERE period = :day
  AND ((scope = 'global-day' AND user_id = 0)
    OR (scope = 'user-day' AND user_id = :user_id))
ORDER BY scope;
```

`day` je lokálny dátum servera, `YYYY-MM-DD`.

**Tvar:** najviac dva riadky. `global-day` je celok voči `WALLET_AI_GLOBAL_DAILY_CALLS` (predvolene 20); `user-day` je daná osoba voči `WALLET_AI_USER_DAILY_CALLS` (predvolene 5). Žiadny riadok znamená žiadny dnešný pokus. Počet na strope vysvetľuje `429` pri návrhu; s vypnutým AI sa nikdy nič nepočíta a návrh odpovie `503`.
