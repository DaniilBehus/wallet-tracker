[English](../../../docs/design-system.md) · **Slovenčina**

<!-- locale-links-v1: source-relative links rebased for locales/sk -->

<a id="interface-design-system"></a>
# Dizajnový systém rozhrania

[← Späť na README](../README.md#architecture) · [Ďalej: poznámky k architektúre →](../spec/architecture.md)

Wallet používa jednotnú tmavú tému navrhnutú najprv pre mobily v častiach Add, Month, Upcoming, Schedules a pri zadávaní výdavku s AI. Referenčný obrázok ovplyvnil hĺbku tmavozelenej farby a jemné zakrivené línie v hornej časti aplikácie. Línie zostávajú mimo obsahových plôch; nikdy nie sú za štítkami, textom vstupných polí ani hodnotami grafov. Obrázkové pozadie sa neopakuje na jednotlivých obrazovkách.

| Úloha | Token | Hodnota |
|---|---|---|
| Pozadie aplikácie | `--bg` | `#071C1B` |
| Karty | `--surface` / `--surface-raised` | `#102B2A` / `#163532` |
| Hlavný / vedľajší text | `--text` / `--muted` | `#F0F7F4` / `#A7C0BA` |
| Primárna akcia | `--accent` | `#48D6C4` |
| Oddeľovače / obrysy vstupných polí | `--line` / `--line-strong` | `#2B514B` / `#5A8E84` |

Rozloženie definuje `public/style.css`; [`public/theme.css`](../../../public/theme.css) určuje paletu a vzhľad komponentov. Hlavné sumy sú výraznejšie a väčšie ako pomocné štítky. Karty majú zaoblenie 18 px, kompaktné ovládacie prvky 12 px a súvisiace polia sú zoskupené s rovnomernými rozostupmi. Primárne akcie majú plnú mätovú farbu a nespoliehajú sa na žiaru. Chyby používajú samostatnú jemnú koralovú farbu a fokus má viditeľný mätový obrys. Spodná navigácia používa jednoduché jednofarebné ikony SVG spolu s textovými štítkami. Stĺpce grafu a výseky prstencového grafu majú pri sebe názvy kategórií aj číselné hodnoty, takže farba nikdy nie je ich jediným označením.

Kontrast bol vypočítaný pre skutočné dvojice tokenov: text tela na pozadí aplikácie **16.22:1**, tlmený text na kartách **7.77:1**, zástupný text vo vstupných poliach **6.80:1**, text primárneho tlačidla na mätovej farbe **9.02:1** a okraj vstupného poľa oproti jeho ploche **4.36:1**. Tenší oddeľovač kariet je dekoratívny, nie jediná hranica ovládacieho prvku.

[Skutočné snímky rozhrania](../README.md#screenshots) boli po zmene dizajnu znovu vytvorené. [Snímky AI](ai-feature.md) používajú deterministické demo dáta, nie živý model. Prehliadačové kontroly pokrývajú rozloženia pri 320 px, 375 px a na počítači, dlhé názvy kategórií, súčet €1,000,000, prázdne zoznamy, chyby validácie, otvorené formuláre, fokus klávesnice a horizontálne pretekanie. Stavy načítavania a chýb AI pokrývajú [prehliadačové testy](../../../qa/e2e).
