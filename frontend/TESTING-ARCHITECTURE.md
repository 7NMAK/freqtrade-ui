# Testing & Experiments — Architecture Document

Ovaj dokument definiše KOMPLETNU funkcionalnost sekcije "Testing & Experiments".
Svaka funkcija, svako dugme, svaki input i output su opisani.
Dizajn se NE pravi dok se ovaj dokument ne odobri.

---

## GLOBALNA PRAVILA ZA CELU APLIKACIJU

### Datumi i vreme — UVEK sa vremenom
- SVE datume u celoj aplikaciji prikazujemo sa datumom I vremenom
- Format: **YYYY-MM-DD HH:mm:ss** (ili kraći HH:mm gde prostor ne dozvoljava)
- Ovo važi za: testove, eksperimente, trade-ove, logove, istoriju, sve
- Nikad samo datum bez vremena — nedovoljno precizno kad imaš stotine testova

### Tooltipovi — SVAKI tehnički termin ima objašnjenje
- Svaki Loss Function ime u tabeli/formi ima tooltip sa objašnjenjem (npr. "SortinoDaily — Optimizuje Sortino ratio na dnevnoj bazi, penalizuje downside volatilnost")
- Svaki Sampler ime ima tooltip (npr. "CmaEs — Covariance Matrix Adaptation Evolution Strategy, dobro za kontinualne prostore")
- Svaki FreqAI model ime ima tooltip (npr. "LightGBMRegressor — Gradient boosting za regresiju, brz i efikasan na tabelarnim podacima")
- Svaka FreqAI opcija ima tooltip (npr. "DBSCAN — Density-based clustering za uklanjanje outlier-a, ne zahteva broj klastera unapred")
- Tooltipovi se prikazuju na hover (desktop) i na tap (mobile)
- Tekst tooltipa je kratak (1-2 rečenice), jasan, bez žargona gde je moguće
- Ovo važi SVUDA u aplikaciji gde se pojavljuju tehnički termini — ne samo u Testing sekciji

---

## DOGOVORENI WORKFLOW

```
Strategija → Backtest (bazni parametri)
    → Hyperopt (svih 6 samplera)
    → FreqAI (opciono — ML optimizacija, zaseban korak posle Hyperopt-a)
        → Svaki eksperiment ima IME + OPIS (korisnik daje)
        → Svi rezultati su uvek vidljivi u comparison tabeli
    → Verify (BILO KOJI rezultat — korisnik bira koji hoće da verifikuje)
        → PASS? → [Opciono: AI Review] → Paper Trading → Live
        → FAIL? → Vrati se, izaberi drugi rezultat za verification
```

Pipeline Tracker koraci (7 koraka):
**Backtest → Hyperopt → FreqAI → Verify → [AI Review] → Paper → Live**

- FreqAI je opcioni ali EKSPLICITNO VIDLJIV korak u pipeline-u
- Ako korisnik ne koristi FreqAI, korak se prikazuje kao ⊘ preskočen
- Ako koristi, pravi verziju koja se poredi sa Hyperopt rezultatima

Pravila:
- Nema ponavljanja hyperopt petlji (overfitting)
- Hyperopt se radi sa svih 6 samplera odjednom
- FreqAI je ZASEBAN korak posle Hyperopt-a u pipeline-u — opcioni ali eksplicitno vidljiv
- FreqAI rezultat se tretira isto kao hyperopt rezultat — ima ime, opis, metrike, može se verifikovati i promovisati
- Ako korisnik ne koristi FreqAI, korak se prikazuje kao preskočen (⊘) u pipeline-u
- Sa verziranjem, u svakom momentu možeš da se vratiš na prethodnu verziju
- Verification se radi za BILO KOJI rezultat — korisnik bira koji hoće da verifikuje
- Ako verification FAIL, korisnik se vraća i bira drugi rezultat za verification
- AI Review (OpenRouter) je OPCIONI korak pre Paper tradinga — preporučen ali ne blokira
- SVI testovi su UVEK VIDLJIVI — ništa se ne skriva i ne briše
- Promovisani/izabrani test je označen zvezdom (★) i vizuelno istaknut u tabeli
- Ostali testovi su normalno prikazani u istoj tabeli — korisnik uvek vidi kompletnu sliku

### Imenovanje eksperimenata:
Svaki eksperiment (backtest, hyperopt, verification, FreqAI) MORA imati:
- **Ime** (kratko, korisnik daje): npr. "BTC 2024 baseline", "6-sampler Sharpe run", "OOS 2023 verify"
- **Opis** (opcioni, korisnik daje): npr. "Bazni test sa default parametrima pre optimizacije"
- **Auto-generisani tag**: tip + datum + strategija (npr. "Hyperopt · Mar 28 · BollingerBreak")

Ovo omogućava da u comparison tabeli i svuda drugde lako razlikuješ testove po imenu umesto po tehničkim detaljima.

### Comparison tabela — UVEK VIDLJIVA:
Na svakom tabu (osim Compare taba koji je detaljniji), postoji mini comparison panel na dnu ili sa strane koji prikazuje sve rezultate za izabranu strategiju:
- Ime eksperimenta, tip, datum, ključne metrike (profit%, DD, Sharpe)
- Klik na red → otvara detalje tog eksperimenta
- Checkbox za selekciju → dodaje u Compare tab za detaljno poređenje
- Sortabilno po bilo kojoj koloni

---

## NAVIGACIJA — DVE STRANICE

### Stranica 1: EXPERIMENT LIST (ulazna tačka)
URL: /experiments

Ovo je PRVA stvar koju korisnik vidi. Lista svih strategija sa njihovim testovima.
NEMA dropdown-a za strategiju — korisnik bira iz tabele gde vidi kontekst.

**Sadržaj:**
- Header: "Experiments" + "New Experiment" dugme (kreira potpuno novi draft od nule)
- Tabela strategija sa ključnim info:
  - Ime strategije
  - Status badge (Draft, Testing, Optimized, Paper, Live)
  - Broj testova
  - Poslednji test (tip + datum)
  - Najbolji profit%, Max DD, Sharpe
  - Pipeline progress (mini vizuelizacija)
- Search, Sort, Filter kontrole
- Klik na red → otvara Stranicu 2 (workspace za tu strategiju)

### Stranica 2: STRATEGY WORKSPACE (rad sa jednom strategijom)
URL: /experiments/[strategy-name]

Otvara se kad klikneš na strategiju iz liste. Sadrži SVE tabove za tu strategiju.

**Header:**
- "← Nazad" dugme (vraća na listu)
- Ime strategije + Status Badge
- "New Test" dugme (pokreće novi test za OVU strategiju)

**Pipeline Tracker (ispod headera):**
- Vizuelni koraci (7): Backtest → Hyperopt → FreqAI → Verify → [AI Review] → Paper → Live
- FreqAI je opcioni korak — prikazan sa isprekidanom linijom ako nije korišćen (⊘)
- [AI Review] je opcioni korak — prikazan sa isprekidanom linijom ili blažom bojom
- Stanja krugova: ✓ završen (zeleno popunjen), ● aktivan (accent pulsira), ○ pending (prazan), ⊘ preskočen/opciono (isprekidano, sivo)
- Za BollingerBreak: Backtest ✓, Hyperopt ✓, FreqAI ⊘ skipped, Verify ✓, [AI Review] ⊘ skipped, Paper ● (Day 12/30), Live ○
- Za SampleStrategy: Backtest ✓, Hyperopt ○, FreqAI ○, Verify ○, [AI Review] ○, Paper ○, Live ○
- Za Diamond: Backtest ✓, Hyperopt ✓, FreqAI ● (Running), Verify ○, [AI Review] ○, Paper ○, Live ○

**Pipeline tabovi u workspace-u (5):**
1. Backtest — bazni test sa default parametrima
2. Hyperopt — optimizacija sa 288 testova (svi sampleri × loss × spaces)
3. FreqAI — ML optimizacija sa 128 testova (svi modeli × outlier × PCA × noise)
4. Naš AI — AI Review sa ocenama i preporukama (OpenRouter)
5. Validation — Verification backtest + Lookahead + Recursive (KAPIJA za Paper Trading)

Ovo su koraci pipeline-a — korisnik ide redom (FreqAI i Naš AI su opcioni ali vidljivi).

**Pomoćna dugmad u headeru workspace-a (uvek vidljiva, iz bilo kog taba):**
- **"📋 Svi testovi (416)"** — otvara fullscreen overlay sa tabelom SVIH testova za ovu strategiju
- **"⚖️ Uporedi"** — otvara fullscreen overlay za side-by-side poređenje dva testa
- **"📊 Analiza"** — otvara fullscreen overlay sa dubinskom analizom (enter_tag, exit_reason, §30 groups)

Ova 3 dugmeta nisu koraci u pipeline-u — to su ALATI koje korisnik koristi kad mu trebaju.
Klik → otvara overlay preko trenutnog taba. Zatvori (X ili Escape) → vraća se gde je bio.

Zašto overlay a ne tab: jer su ovo pomoćni pogledi, ne koraci. Korisnik može biti na Hyperopt tabu, otvoriti "Svi testovi" da proveri nešto, zatvoriti ga i nastaviti sa Hyperopt-om — bez gubitka konteksta.

### Toast Notifikacije
- Pozicija: fixed donji desni ugao
- Tipovi: success (zeleno), error (crveno), warning (amber), info (sivo)
- Auto-dismiss: success/info 3s, warning 6s, error 10s

---

## TAB 1: BACKTEST

**Svrha**: Pokretanje baznog backtesta sa default parametrima strategije. Ovo je prvi korak — vidiš da li strategija uopšte radi.

### Layout: dva panela
- Levo (380px): forma za konfiguraciju
- Desno (1fr): rezultati (skriveni dok se ne pokrene test)

### Levi panel — FORMA

#### Polja:

| # | Polje | Tip | Default | FT flag | Opis |
|---|-------|-----|---------|---------|------|
| 1 | Test Name | Text input | Auto: "[Strategy] baseline [date]" | — | Korisnik imenuje ovaj test za lako prepoznavanje |
| 2 | Description | Text input (opcioni) | Prazno | — | Kratki opis šta se testira |
| 3 | Strategy | Select (readonly) | Iz selektora | --strategy | Pre-popunjeno iz strategy bar |
| 4 | Start Date | Date input | 2024-01-01 | --timerange start | Početak perioda |
| 5 | End Date | Date input | 2025-01-01 | --timerange end | Kraj perioda |
| 6 | Timerange display | Text (readonly) | "20240101-20250101" | — | Auto-generisano iz datuma |

#### Advanced Options (sklopivo, `<details>`):

| # | Polje | Tip | Default | FT flag |
|---|-------|-----|---------|---------|
| 5 | Timeframe Override | Select | "Use strategy default", 1m, 5m, 15m, 30m, 1h, 4h, 1d | --timeframe |
| 6 | Timeframe Detail | Select | None, 1m, 5m | --timeframe-detail |
| 7 | Max Open Trades | Number input | Prazan (use strategy) | --max-open-trades |
| 8 | Starting Capital | Number input | 10000 | --dry-run-wallet |
| 9 | Stake Amount | Number input | Prazan (use strategy) | --stake-amount |
| 10 | Fee Override | Number input | Prazan (auto) | --fee |
| 11 | Enable Protections | Checkbox | OFF | --enable-protections |
| 12 | Cache Results | Checkbox | ON | --cache |
| 13 | Enable FreqAI | Checkbox | OFF | --freqaimodel |
| 14 | Export | Radio (3 opcije) | Trades selected | --export |
| 15 | Breakdown | Checkboxes (3) | Month checked | --breakdown |

#### Dugmad:

| Dugme | Akcija | Stanje |
|-------|--------|--------|
| **Start Backtest** (primary) | Pokreće backtest → loading toast → posle 2s prikaže rezultate | Disabled dok traje |
| **Load Result** | Otvara backtest history panel, bira prethodni rezultat | Uvek aktivan |
| **Stop** | Prekida running backtest | Disabled dok ne traje backtest |
| **Reset** | Sakriva rezultate, resetuje formu | Uvek aktivan |

#### Backtest History Panel (ispod forme):
- Lista prethodnih backtest rezultata za izabranu strategiju
- Svaki red: ime strategije, datum, timerange, broj trgovina, profit%
- Klik na red → učitava te rezultate u desni panel
- Sortiran po datumu (najnoviji prvi)

### Desni panel — REZULTATI (skriveni dok se ne pokrene)

#### Stat Boxes (grid 3x2):

| Metrika | FT polje | Format | Boja |
|---------|----------|--------|------|
| Total Trades | trade_count | Broj | Neutral |
| Win Rate | win_rate | XX.X% | Zeleno ako >60% |
| Total Profit | profit_total_abs | +$X.XX / +X.XX% | Zeleno/crveno |
| Max Drawdown | max_drawdown | -X.XX% / -$X.XX | Crveno |
| Sharpe Ratio | sharpe | X.XX | Neutral |
| Sortino Ratio | sortino | X.XX | Neutral |

#### Equity Curve:
- SVG linijski grafikon
- X osa: vreme
- Y osa: portfolio vrednost
- Gradijent ispod linije (accent boja sa opacity)

#### Trades Table:

| Kolona | FT polje | Format |
|--------|----------|--------|
| # | trade_id | Broj |
| Pair | pair | BTC/USDT:USDT |
| Side | is_short | Long (zeleno) / Short (crveno) |
| Profit% | close_profit | +X.XX% / -X.XX% |
| Profit$ | close_profit_abs | +$X.XX / -$X.XX |
| Open Date | open_date | YYYY-MM-DD HH:mm |
| Close Date | close_date | YYYY-MM-DD HH:mm |
| Duration | trade_duration | Xd Xh |
| Enter Tag | enter_tag | Tekst |
| Exit Reason | exit_reason | Tekst |

- Paginacija: "Showing 1-20 of N" + Prev/Next dugmad
- Sortabilne kolone (klik na header)

---

## TAB 2: HYPEROPT

**Svrha**: Automatska optimizacija parametara strategije. Pokreće svih 6 samplera, poredi rezultate, bira pobednika.

### Layout: dva panela (isto kao Backtest)

### Levi panel — FORMA

#### Polja:

| # | Polje | Tip | Default | FT flag |
|---|-------|-----|---------|---------|
| 1 | Test Name | Text input | Auto: "[Strategy] hyperopt [date]" | — |
| 2 | Description | Text input (opcioni) | Prazno | — |
| 3 | Strategy | Select (readonly) | Iz selektora | --strategy |
| 4 | Epochs | Number | 100 | --epochs |
| 5 | Start Date | Date | 2024-01-01 | --timerange start |
| 6 | End Date | Date | 2025-01-01 | --timerange end |

#### Spaces (8 checkboxova):

| Space | FT flag value | Opis |
|-------|---------------|------|
| buy | buy | Entry parametri |
| sell | sell | Exit parametri |
| roi | roi | Return on investment table |
| stoploss | stoploss | Stop loss vrednost |
| trailing | trailing | Trailing stop parametri |
| protection | protection | Protections parametri |
| trades | trades | Trade count filteri |
| default | default | Sve odjednom |

#### BATCH TESTING — Kompletna matrica testiranja

Cilj: testirati SVE varijante (space kombinacije × loss funkcije × samplere) da bi rezultati bili što precizniji. Iz svih rezultata korisnik bira više pobednika i lansira ih kao zasebne Paper Trading botove.

**Tri dimenzije testiranja:**
1. **Spaces** — koje parametre optimizuješ (4 preseta + custom)
2. **Loss Functions** — kako se meri "uspeh" (12 funkcija)
3. **Samplers** — koji algoritam traži optimum (6 samplera, UVEK svih 6)

**Kompletna matrica:**
```
4 space preseta × 12 loss funkcija × 6 samplera = 288 runova
```

**Predefinisani space preseti** (dugmad za brzo dodavanje):
- "Signals Only" → buy + sell
- "Signals + Risk" → buy + sell + roi + stoploss
- "Signals + Trailing" → buy + sell + trailing
- "Full" → sve uključeno
- + Custom kombinacije

**12 Loss Functions** (sve se testiraju po defaultu):
1. ShortTradeDurHyperOptLoss
2. OnlyProfitHyperOptLoss
3. SharpeHyperOptLoss
4. SharpeHyperOptLossDaily
5. SortinoHyperOptLoss
6. SortinoHyperOptLossDaily
7. CalmarHyperOptLoss
8. MaxDrawDownHyperOptLoss
9. MaxDrawDownRelativeHyperOptLoss
10. MaxDrawDownPerPairHyperOptLoss
11. ProfitDrawDownHyperOptLoss
12. MultiMetricHyperOptLoss

**6 Samplera** (uvek svih 6 za svaki test):
1. TPESampler
2. GPSampler
3. CmaEsSampler
4. NSGAIISampler
5. NSGAIIISampler
6. QMCSampler

#### Batch Builder

Korisnik može:
- **"Run Full Matrix"** dugme → pokreće SVE kombinacije (288 runova)
- **Selektivan batch** → bira samo određene space/loss kombinacije
- **Custom** → dodaje proizvoljan red sa bilo kojom konfiguracijom

**Batch Builder tabela:**

| # | Spaces | Loss Functions | Samplers | Epochs (auto) | Status |
|---|--------|---------------|----------|---------------|--------|
| 1 | Signals Only | All 12 | All 6 | 100 | ○ Pending |
| 2 | Signals + Risk | All 12 | All 6 | 200 | ○ Pending |
| 3 | Signals + Trailing | All 12 | All 6 | 150 | ○ Pending |
| 4 | Full | All 12 | All 6 | 500 | ○ Pending |

Svaki red u tabeli generiše: 12 loss × 6 samplera = **72 runova**
Ukupno sa 4 preseta: 4 × 72 = **288 runova**

- Loss Functions kolona: "All 12" po defaultu, ili klik da izabereš samo neke
- Samplers kolona: uvek "All 6" (ne može se menjati — uvek testiramo sve)
- Epochs: auto na osnovu broja parametara, ručno editabilno
- Svaki red ima ✕ dugme za uklanjanje

**Auto Epochs** (automatski predložen, ručno editabilan):

| Spaces | Približan broj parametara | Auto Epochs |
|--------|--------------------------|-------------|
| buy + sell | ~3 | 100 |
| buy + sell + roi + stoploss | ~6 | 200 |
| buy + sell + trailing | ~5 | 150 |
| all spaces | 15+ | 500 |

#### Od rezultata do Paper Trading botova

```
288 hyperopt runova → Master tabela svih rezultata
    → Korisnik bira VIŠE pobednika (ne samo jednog)
    → Svaki pobednik → zaseban Paper Trading bot
    → Posle 30 dana → poređenje pravih rezultata
    → Najbolji bot → Live
```

Primer:
- Bot 1: Signals Only + SharpeDaily + CmaEs (best Sharpe)
- Bot 2: Full + SortinoDaily + TPE (best risk-adjusted)
- Bot 3: Signals+Risk + MaxDD + QMC (lowest drawdown)
- Bot 4: Signals Only + CalmarLoss + GPS (best Calmar ratio)
- Svi rade Paper Trading istovremeno na istom paru
- Posle 30 dana: uporedi stvarne rezultate → najbolji ide na Live

**Server**:
- **Primarni: CCX43** — 16 CPU (AMD), 64 GB RAM, 320 GB disk
  - 288 runova: ~55 min (16 paralelnih procesa)
  - 1 strategija istovremeno = optimalno
  - 2 strategije paralelno = moguće ali duplo sporije (~110 min)
- **Upgrade ako treba: CCX63** — 48 CPU, 192 GB RAM, 320 GB disk
  - 288 runova: ~18 min
  - 3 strategije paralelno bez problema

**Info box**: "Full Matrix: 4 preseta × 12 loss × 6 samplera = 288 runova. CCX43: ~55 min. CCX63: ~18 min."

*(Loss Functions i Samplers su definisani gore u Batch Testing sekciji)*

#### Advanced Options (sklopivo, važi za ceo batch):

| # | Polje | Tip | Default | FT flag |
|---|-------|-----|---------|---------|
| 7 | Min Trades | Number | Prazan | --min-trades |
| 8 | Max Trades | Number | Prazan | --max-trades |
| 9 | Random State | Number | Prazan | --random-state |
| 10 | Jobs | Select | -1 (all CPUs) | --jobs |
| 11 | Effort | Slider 0.0-1.0 | **1.0** | — |
| 12 | Early Stop | Number | Prazan | --hyperopt-loss |

#### Dugmad:

| Dugme | Akcija |
|-------|--------|
| **Run Batch** (primary) | Pokreće SVE testove u batch-u (svaki sa svih 6 samplera) |
| **Run Single** | Pokreće samo izabrani red sa svih 6 samplera |
| **Stop All** | Zaustavlja sve running testove |

#### Server zahtevi:
- Batch testovi se mogu pokretati paralelno ako server ima dovoljno CPU/RAM
- Jobs flag (-j) kontroliše koliko CPU-a koristi svaki run
- Više testova istovremeno zahteva jači server (više CPU jezgara, više RAM-a)
- UI prikazuje progress za svaki test pojedinačno

### Desni panel — REZULTATI

#### Master Comparison Table (svi rezultati na jednom mestu):

| Kolona | Opis |
|--------|------|
| Test Name | Ime testa iz batch-a (npr. "Signals Only") |
| Sampler | Koji sampler (TPE, GPS, CmaEs...) |
| Loss Function | Koja loss funkcija |
| Spaces | Koje space kombinacije |
| Epochs | Broj epoha |
| Started | Datum + vreme pokretanja (YYYY-MM-DD HH:mm:ss) |
| Finished | Datum + vreme završetka (YYYY-MM-DD HH:mm:ss) |
| Duration | Koliko je trajao run (npr. "3m 42s") |
| Trades | Broj trgovina |
| Win Rate | % |
| Profit% | Total profit |
| Max DD | Max drawdown |
| Sharpe | Sharpe ratio |
| Sortino | Sortino ratio |
| Avg Trade Duration | Prosečno trajanje trade-a |

- Primer sa 3 testa: 3 × 6 = 18 redova u tabeli
- ★ Najbolji rezultat je automatski označen zvezdom
- Sortabilne i filterabilne kolone
- Filter po: test name, sampler, ili custom
- Klik na red → prikazuje detalje tog run-a

#### Winner Banner:
- Zeleni banner sa trofejem
- Prikazuje: ime testa + sampler, profit%, Sharpe, MaxDD
- Dugme "Promote ★" i "→ Verify" (prebacuje na Validation tab)
- Dugme "→ Analysis" (prebacuje na Analysis tab sa ovim rezultatom)

#### Optimized Parameters Display:
- Za izabrani/pobednički run
- Prikazuje: parametar, stara vrednost, nova vrednost, raspon pretrage
- Format: `buy_rsi: 28 (was 30, range 10-50)`

---

## OVERLAY: ANALIZA (dugme "📊 Analiza") — §30

**Svrha**: Dubinska analiza rezultata. Sa 416 testova (288 hyperopt + 128 FreqAI), ovo je ključno za razumevanje ZAŠTO neki rezultati rade bolje od drugih.

**Ovo je pomoćni overlay — NIJE korak u pipeline-u.** Otvara se klikom na dugme "📊 Analiza" u headeru ili klikom na "→ Analysis" dugme u proširenom redu testa.

### Source Selector (vrh taba):
Sa 288+ runova, source selector mora biti moćan:

- **Dropdown** sa pretraživom listom svih testova (backtest, hyperopt, FreqAI)
  - Svaki red prikazuje: ime + loss function + sampler + datum+vreme + profit%
  - Primer: "Signals Only · SharpeDaily · CmaEs · 2024-03-28 14:22:15 · +12.4%"
- **Multi-select mode**: izaberi VIŠE testova za uporednu analizu
  - Kad su izabrani 2+ testa, svaki sub-prikaz prikazuje uporedne podatke side-by-side
- **Quick filters**: filtriraj po space presetu, loss function, ili sampler
- **"Analyze ★"** dugme: brzo izaberi promovisani/označeni test

### Sub-navigacija (dugmad):
6 pod-prikaza, svaki radi za jedan ili više izabranih testova:
1. **Enter Tag Stats** (Group 0+1) — default aktivan
2. **Exit Reason Stats** (Group 5)
3. **Trading List** (Group 3)
4. **Rejected Signals** (Group 0 — rejected)
5. **Indicator Analysis** (Group 4)
6. **Signal Analysis** (Group 5 — raw signals)

### Sub-prikaz 1: Enter Tag Stats

| Kolona | FT polje | Format |
|--------|----------|--------|
| Enter Tag | enter_tag | Tekst |
| Trades | count | Broj |
| Win Rate | win_rate per tag | XX.X% |
| Avg Profit% | avg close_profit | +X.XX% |
| Total Profit | sum close_profit_abs | +$X.XX |
| Avg Duration | avg trade_duration | Xd Xh |
| Max DD | max drawdown per tag | -X.XX% |

- Insight box na dnu: automatski komentar o najboljem/najgorem tagu

### Sub-prikaz 2: Exit Reason Stats

| Kolona | FT polje |
|--------|----------|
| Exit Reason | exit_reason |
| Count | count per reason |
| Win Rate | win_rate per reason |
| Avg Profit% | avg close_profit |
| Total Profit | sum close_profit_abs |
| Avg Duration | avg trade_duration |

- exit_reason vrednosti: roi, trailing_stop_loss, stop_loss, exit_signal, force_exit

### Sub-prikaz 3: Trading List

Kompletna lista svih trgovina sa FT poljima:

| Kolona | FT polje |
|--------|----------|
| trade_id | trade_id |
| Pair | pair |
| is_short | is_short |
| stake_amount | stake_amount |
| open_rate | open_rate |
| close_rate | close_rate |
| fee_open | fee_open |
| fee_close | fee_close |
| close_profit_abs | close_profit_abs |
| enter_tag | enter_tag |
| exit_reason | exit_reason |

- Paginacija (20 po stranici)
- "Export CSV" dugme
- Sortabilne kolone

### Sub-prikaz 4: Rejected Signals

| Kolona | Opis |
|--------|------|
| Date | Datum + vreme signala (YYYY-MM-DD HH:mm:ss) |
| Pair | Par |
| Signal | Long/Short |
| Enter Tag | Koji signal je generisan |
| Rejection Reason | Zašto nije izvršen (max_open_trades, protection, cooldown) |

- Insight: koliko signala je propušteno i zašto

### Sub-prikaz 5: Indicator Analysis

Kartice (grid 2x2) sa indikatorskim vrednostima na ulaznim tačkama:
- Svaka kartica: ime indikatora, avg/min/max vrednost, vizuelna traka
- Primeri: RSI at Entry, BB Width, EMA Direction, Volume Relative
- Insight box sa komentarom

### Sub-prikaz 6: Signal Analysis

4 stat box-a na vrhu:
| Box | Vrednost |
|-----|----------|
| Total Signals | Ukupno generisanih signala |
| Executed | Koliko je postalo trade |
| Rejected | Koliko je odbijeno |
| No Action | Ostalo |

Tabela ispod:
| Kolona | Opis |
|--------|------|
| Signal Type | enter_long, enter_short, exit_long, exit_short |
| Generated | Broj generisanih |
| Executed | Broj izvršenih |
| Exec Rate | % izvršenih |
| Avg Profit | Prosečan profit izvršenih |

### Multi-select uporedna analiza:
Kad korisnik izabere 2+ testa u Source Selectoru, svi sub-prikazi prikazuju podatke UPOREDNO:
- Enter Tag Stats: ista tabela ali sa kolonama za svaki izabrani test (npr. "Win Rate (Test A)" vs "Win Rate (Test B)")
- Exit Reason Stats: isto uporedno
- Trading List: odvojene tabele jedna ispod druge, ili tab za svaki test
- Indicator Analysis: kartice za svaki test side-by-side
- Signal Analysis: stat boxovi za svaki test side-by-side

Ovo je korisno kad hoćeš da vidiš zašto "Signals Only + CmaEs" radi bolje od "Full + TPE" — uporediš enter_tag breakdown i odmah vidiš razliku.

---

## TAB 4: FREQAI

**Svrha**: ML optimizacija strategije koristeći FreqAI. Zaseban korak posle Hyperopt-a — koristi machine learning umesto klasične optimizacije parametara.

FreqAI trenira ML model na istorijskim podacima da predvidi tržišne uslove. Kad korisnik dođe do ovog taba, strategija je VEĆ IZABRANA (otvorena u workspace-u) i Hyperopt je završen. FreqAI radi na toj strategiji sa parametrima iz Hyperopt rezultata.

Isto kao Hyperopt — testiramo SVE modele × SVE opcije (full matrix). Rezultati se porede sa Hyperopt rezultatima.

### Input iz prethodnih koraka:
- **Strategija**: već izabrana u workspace-u
- **Hyperopt Source**: korisnik bira koji Hyperopt rezultat koristi kao osnovu (dropdown sa svim Hyperopt rezultatima, prikazuje ime + loss + sampler + profit)
- Optimizovani parametri iz izabranog Hyperopt rezultata se prikazuju readonly

### Forma (globalna polja za ceo batch):

| # | Polje | Tip | Default | FT config key |
|---|-------|-----|---------|---------------|
| 1 | Hyperopt Source | Select | Najbolji po Sharpe-u | — (bira koji Hyperopt rezultat koristiti) |
| 2 | Test Name Prefix | Text input | Auto: "[Strategy] freqai [date]" | — |
| 3 | Description | Text input (opcioni) | Prazno | — |
| 4 | Training Timerange | Date range | Isti kao Hyperopt | freqai.train_period_days |
| 5 | Backtest Timerange | Date range | Period posle treninga | freqai.backtest_period_days |
| 6 | Feature Period | Number | 20 | freqai.feature_parameters.include_timeframes |
| 7 | Label Period | Number | 24 | freqai.feature_parameters.label_period_candles |

### FULL MATRIX BATCH TESTING

Testiramo SVE kombinacije: modeli × outlier metode × PCA × noise injection.

#### Osa 1: Modeli (8)

| # | Model | Tip | Brzina | Tooltip opis |
|---|-------|-----|--------|------|
| 1 | LightGBMRegressor | Regression | Brz | Gradient boosting za regresiju — brz, efikasan na tabelarnim podacima, default izbor |
| 2 | LightGBMClassifier | Classification | Brz | Gradient boosting za klasifikaciju — predviđa smer (gore/dole) umesto tačne vrednosti |
| 3 | XGBoostRegressor | Regression | Srednji | Extreme Gradient Boosting regresija — alternativa LightGBM-u, ponekad bolji na manjim datasetovima |
| 4 | XGBoostClassifier | Classification | Srednji | XGBoost klasifikacija — predviđa smer sa drugačijim algoritmom od LightGBM |
| 5 | CatboostRegressor | Regression | Srednji | Yandex Catboost — posebno dobar sa kategoričkim podacima, robustan na default parametre |
| 6 | PyTorchMLPRegressor | Neural Net | Spor | Multi-layer perceptron (duboki learning) regresija — treba više podataka, može uhvatiti kompleksne nelinearne obrasce |
| 7 | PyTorchMLPClassifier | Neural Net | Spor | Multi-layer perceptron klasifikacija — duboki learning za predikciju smera |
| 8 | ReinforcementLearner | RL Agent | Spor | Reinforcement learning agent — potpuno drugačiji pristup, uči optimalno ponašanje kroz nagrade/kazne |

#### Osa 2: Outlier Detection (4 metode)

| # | Metoda | FT config key | Tooltip opis |
|---|--------|---------------|------|
| 1 | None | — (default) | Bez uklanjanja outlier-a — koristi sve podatke za trening |
| 2 | Dissimilarity Index (DI) | `feature_parameters.DI_threshold` | Meri koliko je novi podatak različit od trening podataka — DI > threshold = outlier, ne koristi se za predikciju |
| 3 | SVM | `feature_parameters.use_SVM_to_remove_outliers: true` | Support Vector Machine crta granicu oko "normalnih" podataka — sve van granice je outlier i uklanja se iz treninga |
| 4 | DBSCAN | `feature_parameters.use_DBSCAN_to_remove_outliers: true` | Density-Based Spatial Clustering — pronalazi grupe sličnih podataka, izolovane tačke su outlier-i. Ne zahteva unapred definisan broj klastera |

#### Osa 3: PCA (2 opcije)

| # | Opcija | FT config key | Tooltip opis |
|---|--------|---------------|------|
| 1 | PCA Off | `feature_parameters.principal_component_analysis: false` | Koristi sve originalne feature-e bez redukcije — više informacija ali sporiji trening |
| 2 | PCA On | `feature_parameters.principal_component_analysis: true` | Principal Component Analysis — smanjuje broj feature-a zadržavajući 99.9% varijanse. Brži trening, manje šanse za overfitting |

#### Osa 4: Noise Injection (2 opcije)

| # | Opcija | FT config key | Tooltip opis |
|---|--------|---------------|------|
| 1 | Noise Off | `feature_parameters.noise_standard_deviation: 0` | Bez šuma — model trenira na čistim podacima |
| 2 | Noise On | `feature_parameters.noise_standard_deviation: 0.1` | Dodaje Gaussian šum u trening podatke — anti-overfitting tehnika, model uči da bude robusniji na šum u realnim podacima |

#### Rezultujuća matrica:
```
8 modela × 4 outlier metode × 2 PCA × 2 noise = 128 FreqAI testova

Primer prvih redova:
  #1:  LightGBMRegressor  + None    + PCA Off + Noise Off
  #2:  LightGBMRegressor  + None    + PCA Off + Noise On
  #3:  LightGBMRegressor  + None    + PCA On  + Noise Off
  #4:  LightGBMRegressor  + None    + PCA On  + Noise On
  #5:  LightGBMRegressor  + DI      + PCA Off + Noise Off
  ...
  #128: ReinforcementLearner + DBSCAN + PCA On + Noise On
```

#### Batch Builder prikaz:

Tabela sa 128 redova (generisana automatski), svaki red = jedna kombinacija.
Korisnik može:
- **Uključiti/isključiti** pojedinačne redove (checkbox) — za preskakanje kombinacija koje ne želi
- **Select All / Deselect All** — za brzi izbor
- **Filter** po modelu, outlier metodi, PCA, noise — za pregled podgrupa
- **Sort** po bilo kojoj koloni

| ☑ | # | Model | Outlier | PCA | Noise | Status |
|---|---|-------|---------|-----|-------|--------|
| ☑ | 1 | LightGBMRegressor | None | Off | Off | ○ Pending |
| ☑ | 2 | LightGBMRegressor | None | Off | On | ○ Pending |
| ☑ | 3 | LightGBMRegressor | None | On | Off | ○ Pending |
| ... | ... | ... | ... | ... | ... | ... |
| ☑ | 128 | ReinforcementLearner | DBSCAN | On | On | ○ Pending |

#### Advanced Options (sklopivo, važi za ceo batch):

| # | Polje | Tip | Default | FT config key | Tooltip |
|---|-------|-----|---------|---------------|---------|
| 1 | DI Threshold | Slider 0-10 | 1.0 | `feature_parameters.DI_threshold` | Prag za Dissimilarity Index — niži = strožiji filter (više outlier-a), viši = blaži |
| 2 | SVM nu | Slider 0-1 | 0.1 | `feature_parameters.svm_params.nu` | Očekivani procenat outlier-a u podacima — 0.1 = 10% podataka se smatra outlier-ima |
| 3 | Weight Factor | Slider 0-10 | 1.0 | `feature_parameters.weight_factor` | Eksponencijalno težinsko ponderisanje — viši = noviji podaci imaju MNOGO veću težinu |
| 4 | Noise Std Dev | Number | 0.1 | `feature_parameters.noise_standard_deviation` | Jačina Gaussian šuma kad je noise uključen — viši = više šuma, agresivniji anti-overfitting |
| 5 | Outlier Protection % | Slider 0-100 | 30 | `feature_parameters.outlier_protection_percentage` | Maksimalni procenat podataka koji može biti označen kao outlier — zaštita od preteranog filtriranja |
| 6 | Shuffle After Split | Toggle | Off | `feature_parameters.shuffle_after_split` | Promeša podatke posle train/test podele — može pomoći ako su podaci hronološki biased |
| 7 | Buffer Train Data | Number | 0 | `feature_parameters.buffer_train_data_candles` | Uklanja N sveća sa ivica trening podataka — sprečava data leakage između perioda |
| 8 | Reverse Train/Test | Toggle | Off | `feature_parameters.reverse_train_test_order` | Koristi novije podatke za trening umesto starijih — korisno kad se tržište brzo menja |
| 9 | Include Corr Pairs | Toggle + Tag input | Off | `feature_parameters.include_corr_pairlist` | Dodaje korelisane parove kao feature-e — npr. ETH/USDT kao prediktor za BTC/USDT |
| 10 | Indicator Periods | Multi-select | [10, 20] | `feature_parameters.indicator_periods_candles` | Periodi indikatora za feature generation — svaki period generiše zaseban set feature-a |

#### Server zahtevi:
```
CCX43 (16 CPU, 64 GB RAM):
  128 runova: ~4-8 sati (zavisno od modela — PyTorch i RL sporiji)
  Paralelizacija: 4-8 modela istovremeno (zavisno od RAM-a)
  Preporuka: pustiti preko noći

CCX63 (48 CPU, 192 GB RAM):
  128 runova: ~1-3 sata
  Paralelizacija: 16-24 modela istovremeno
  Preporuka: može za vreme pauze
```

### Dugmad:

| Dugme | Akcija |
|-------|--------|
| **Run Full Matrix** (primary) | Pokreće SVE čekirane kombinacije (default: 128) |
| **Run Selected** | Pokreće samo ručno izabrane redove |
| **Stop All** | Zaustavlja sve running treninge |

### Progress prikaz:
```
FreqAI Batch: 47/128 completed (36%)
████████████████░░░░░░░░░░░░░░░░░░░░░░░░ 36%

Currently running (4 parallel):
  #48: XGBoostRegressor + DI + PCA On + Noise Off — training 73%
  #49: XGBoostRegressor + DI + PCA On + Noise On — training 45%
  #50: XGBoostRegressor + DI + PCA Off + Noise Off — training 31%
  #51: XGBoostRegressor + DI + PCA Off + Noise On — training 12%

Estimated time remaining: ~2h 15min
```

### Rezultati — Master Table:

| Kolona | Opis |
|--------|------|
| # | Redni broj |
| Model | Koji ML model (sa tooltip-om) |
| Outlier | None / DI / SVM / DBSCAN (sa tooltip-om) |
| PCA | On / Off |
| Noise | On / Off |
| Started | Datum + vreme (YYYY-MM-DD HH:mm:ss) |
| Finished | Datum + vreme |
| Training Duration | Koliko je trajao trening |
| Trades | Broj trgovina |
| Win Rate | % |
| Profit% | Total profit |
| Max DD | Max drawdown |
| Sharpe | Sharpe ratio |
| Sortino | Sortino ratio |
| Feature Importance | Top 3 najvažnija feature-a |
| Prediction Accuracy | % tačnosti predikcija |

- ★ Najbolji rezultat automatski označen (po Sharpe-u)
- Tabela sortabilna po SVIM kolonama
- Filter po modelu, outlier metodi, PCA, noise — za brzo pronalaženje podgrupa
- Svi rezultati uporedivi sa Hyperopt rezultatima u Experiments tabeli
- "Promote ★", "→ Verify", "→ Analysis", "Compare" dugmad za svaki red

### Ukupan broj testova (Hyperopt + FreqAI):
```
Hyperopt:  288 runova (4 spaces × 12 loss × 6 samplers)
FreqAI:    128 runova (8 modela × 4 outlier × 2 PCA × 2 noise)
                ────────
Ukupno:    416 runova po strategiji
Svi u istoj tabeli, svi uporedivi, iz svih se mogu lansirati Paper botovi
```

---

## TAB 5: NAŠ AI (AI REVIEW)

**Svrha**: AI analizira sve testove za strategiju i daje konkretan odgovor: DA ili NE za Paper trading, sa tačnim brojevima zašto. Bez eseja, bez filozofije — samo činjenice i brojevi.

Ovo je OPCIONI korak — preporučen ali ne blokira Paper trading.
Koristi OpenRouter API (Claude, GPT-4, Llama — korisnik bira model).

### Ključni princip promptovanja:
- AI dobija STRUKTURIRANI prompt sa tačnim pitanjima
- AI MORA odgovoriti u TAČNOM JSON formatu — parsiramo odgovor programski
- Nikad slobodan tekst — uvek tabela/broj/DA-NE
- Prompt sadrži SVE podatke iz testova (JSON dump svih 416 rezultata)
- AI ne sme izmišljati podatke — samo analizira ono što dobije

### Forma:

| # | Polje | Tip | Default |
|---|-------|-----|---------|
| 1 | Scope | Select | "Svi testovi" / Samo Hyperopt / Samo FreqAI / Specifičan test |
| 2 | AI Model | Select | Claude Sonnet (brz, jeftin) / Claude Opus (precizniji) / GPT-4o / Llama 3.1 405B |

Nema "Focus" niti "Detail Level" — AI uvek radi KOMPLETNU analizu u istom formatu.

### Dugme:
- **Run AI Analysis** (primary) — šalje podatke na OpenRouter, čeka odgovor
- Cena prikaz: "~$0.03 estimated cost" (zavisi od modela i količine podataka)

### Šta AI dobija (system prompt + data):

```
SYSTEM PROMPT (fiksni, korisnik ga ne menja):

Ti si trading strategy analyst. Dobijaš rezultate testova i odgovaraš SAMO u zadatom JSON formatu.

PRAVILA:
- Odgovaraj SAMO sa JSON objektom, ništa drugo
- Svaki broj mora biti iz podataka koje si dobio — NIKAD ne izmišljaj
- Ako nemaš dovoljno podataka za zaključak, verdict = "INSUFFICIENT_DATA"
- Budi strog — bolje reći NE nego pustiti lošu strategiju na Paper

PODACI:
{json_dump_svih_rezultata}

ODGOVORI U OVOM FORMATU:
{json_schema}
```

### Tačan JSON format odgovora koji AI mora vratiti:

```json
{
  "verdict": "READY | NEEDS_WORK | HIGH_RISK | INSUFFICIENT_DATA",
  "verdict_reason": "Max 15 reči zašto",

  "overfitting_check": {
    "score": 0-100,
    "training_vs_verification_profit_drop": "X%",
    "training_vs_verification_dd_increase": "X%",
    "training_vs_verification_winrate_drop": "Xpp",
    "is_overfitted": true/false,
    "evidence": "Max 20 reči"
  },

  "consistency_check": {
    "score": 0-100,
    "profit_std_across_samplers": "X%",
    "winrate_std_across_samplers": "Xpp",
    "best_worst_profit_gap": "X%",
    "is_consistent": true/false,
    "evidence": "Max 20 reči"
  },

  "risk_check": {
    "score": 0-100,
    "max_drawdown": "X%",
    "max_consecutive_losses": N,
    "worst_single_trade": "X%",
    "risk_reward_ratio": X.X,
    "is_acceptable": true/false,
    "evidence": "Max 20 reči"
  },

  "robustness_check": {
    "score": 0-100,
    "profitable_samplers": "N/6",
    "profitable_loss_functions": "N/12",
    "profitable_freqai_models": "N/8",
    "is_robust": true/false,
    "evidence": "Max 20 reči"
  },

  "top_3_concerns": [
    {"severity": "critical|warning|info", "metric": "ime metrike", "value": "vrednost", "threshold": "prag", "message": "Max 15 reči"},
    {"severity": "...", "metric": "...", "value": "...", "threshold": "...", "message": "..."},
    {"severity": "...", "metric": "...", "value": "...", "threshold": "...", "message": "..."}
  ],

  "recommended_config": {
    "best_hyperopt_run": "ime testa",
    "best_freqai_run": "ime testa ili null",
    "reason": "Max 20 reči zašto ovi"
  }
}
```

### Kako UI prikazuje rezultat (šta korisnik vidi):

Korisnik NE vidi JSON — vidi čist, razumljiv prikaz. Sve objašnjeno prostim jezikom.

#### 1. Verdict Banner (vrh stranice, veliko, jasno):

- 🟢 **SPREMNA** — zeleni banner: "Strategija je spremna za Paper Trading"
- 🟡 **POTREBNE KOREKCIJE** — žuti banner: "Ima problema koje treba rešiti pre Paper Trading-a"
- 🔴 **VISOK RIZIK** — crveni banner: "Ova strategija nije bezbedna za Paper Trading"
- ⚪ **NEDOVOLJNO PODATAKA** — sivi banner: "Nema dovoljno testova za procenu — pokreni još testova"

#### 2. Četiri kartice sa ocenama (ispod bannera):

Svaka kartica prikazuje ocenu 0-100 sa prostim objašnjenjem šta ta ocena znači.

**Kartica 1: Da li je preučena? (Overfitting)**
- Ocena: 0-100 (viša = bolja)
- Objašnjenje ispod ocene: "Poredi kako strategija radi na podacima na kojima je trenirana vs na novim podacima koje nikad nije videla"
- Tooltip: "Ako strategija radi odlično na starim podacima ali loše na novim — preučena je. Kao učenik koji nauči odgovore napamet ali ne razume gradivo."
- Kad se klikne, proširuje se sa detaljima:
  - Profit na trening podacima: X%
  - Profit na novim podacima: Y%
  - Razlika: Z% (zeleno ako <50%, crveno ako >50%)
  - Max Drawdown porast: W% (zeleno ako <30%, crveno ako >30%)
  - Win Rate pad: Vpp (zeleno ako <15pp, crveno ako >15pp)

**Kartica 2: Da li je konzistentna? (Consistency)**
- Ocena: 0-100
- Objašnjenje: "Proverava da li strategija daje slične rezultate bez obzira kako je testirana — sa različitim metodama i podešavanjima"
- Tooltip: "Ako strategija radi samo sa jednim podešavanjem a sa svim ostalim ne radi — to nije pouzdana strategija. Dobra strategija radi dobro sa većinom podešavanja."
- Detalji kad se klikne:
  - Koliko od 6 samplera je profitabilno: N/6
  - Koliko od 12 loss funkcija je profitabilno: N/12
  - Razlika između najboljeg i najgoreg profita: X%
  - Razlika u win rate-u između testova: ±Xpp

**Kartica 3: Koliki je rizik? (Risk)**
- Ocena: 0-100
- Objašnjenje: "Meri koliko možeš da izgubiš u najgorem slučaju — maksimalni pad, najgori trade, nizovi gubitaka"
- Tooltip: "Čak i profitabilna strategija može biti opasna ako ima velike padove. Ova ocena pokazuje da li je rizik pod kontrolom."
- Detalji kad se klikne:
  - Najveći pad portfolija (Max Drawdown): X%
  - Najgori pojedinačni trade: -X%
  - Najduži niz gubitaka zaredom: N trades
  - Odnos zarade i rizika (Risk/Reward): X:1

**Kartica 4: Koliko je otporna? (Robustness)**
- Ocena: 0-100
- Objašnjenje: "Proverava da li strategija zarađuje sa VEĆINOM podešavanja, ne samo sa jednim srećnim kombinacijom"
- Tooltip: "Ako od 288 Hyperopt testova samo 10 zarađuje — strategija zavisi od sreće. Ako 250 od 288 zarađuje — strategija je otporna."
- Detalji kad se klikne:
  - Profitabilnih Hyperopt testova: N/288 (X%)
  - Profitabilnih FreqAI testova: N/128 (X%)
  - Profitabilnih samplera: N/6
  - Profitabilnih ML modela: N/8

#### 3. Problemi na koje treba obratiti pažnju (Top 3):

Tabela sa max 3 najbitnija problema, svaki objašnjen prostim jezikom:

| | Problem | Izmeren | Treba biti | Šta to znači |
|--|---------|---------|------------|--------------|
| 🔴 | Prevelik pad | 35% | ispod 25% | Portfolijo je pao 35% u najgorem periodu — to je previše za Paper Trading |
| ⚠️ | Nekonzistentna win rate | razlika 8pp | ispod 5pp | Win rate varira previše između testova — rezultati nisu stabilni |
| ℹ️ | Malo trades-ova | 45 | više od 50 | Nedovoljno trades-ova za pouzdanu statistiku — rezultat može biti slučajan |

#### 4. Preporuka (dno):

Prosto napisano: "Na osnovu svih testova, najbolja kombinacija je:"
- **Hyperopt pobednik**: [ime testa] — klikabilno, otvara detalje tog testa
- **FreqAI pobednik**: [ime testa] ili "Nema — Hyperopt je bolji od svih ML modela"
- **Zašto**: jedna rečenica, npr. "CmaEs sampler sa SortinoDaily loss daje najbolji odnos profita i rizika"

Dugmad:
- **"Koristi ovu preporuku →"** — prebacuje preporučeni test u Validation tab za verifikaciju
- **"Ne slažem se, biram sam"** — korisnik se vraća na Experiments tab da sam izabere

### Pragovi za automatski verdict (hardkodirani, ne AI odlučuje):

AI daje ocene, ali VERDICT određuje naš kod po fiksnim pravilima:
```
SPREMNA:           sva 4 ocena ≥ 70 I nijedan 🔴 problem
POTREBNE KOREKCIJE: bilo koja ocena 40-69 ILI jedan 🔴 problem
VISOK RIZIK:       bilo koja ocena < 40 ILI dva+ 🔴 problema
NEDOVOLJNO PODATAKA: manje od 10 testova ukupno
```

Ovo znači da AI ne može sam proglasiti strategiju spremnom — naš kod proverava ocene.

### Istorija:
- Svaka AI analiza se čuva sa: datum+vreme, model korišćen, verdict, sve ocene, ceo odgovor
- Prikazuje se u Experiments tabeli kao tip "AI Review"
- Može se uporediti sa prethodnim AI analizama (npr. da li ocena raste kako dodaješ više testova)

### Cena po analizi (prikazana korisniku pre klika):
```
Claude Sonnet:  ~$0.02-0.05 (najbrži, dovoljno dobar za većinu)
Claude Opus:    ~$0.10-0.20 (najprecizniji, za važne odluke)
GPT-4o:         ~$0.03-0.08
Llama 3.1 405B: ~$0.01-0.03 (najjeftiniji)
```

---

## TAB 6: VALIDATION

**Svrha**: Poslednja provera pre Paper Trading-a. Ovo je KAPIJA — bez prolaska ovde, nema Paper Trading dugmeta nigde u aplikaciji.

**Šta je Verification Backtest?** Ovo NIJE novi hyperopt. Ovo je običan backtest ali sa ključnom razlikom:
- Uzima parametre iz pobedničkog testa (Hyperopt ili FreqAI)
- Pokreće ih na NOVIM podacima koje strategija nikad nije videla
- Ako rezultati budu slični → strategija radi, nije preučena
- Ako profit drastično padne → strategija je preučena (naučila podatke napamet umesto da razume tržište)

**Primer**: Hyperopt je treniran na podacima 2022-2024 i našao profit 15%. Verification pokreće iste parametre na 2024-2025. Ako i tu bude 10-15% → PASS. Ako padne na 2% → FAIL (overfitting).

Tri sekcije na ovom tabu.

### Sekcija 1: Verification Backtest

Korisnik bira BILO KOJI rezultat za verifikaciju — ne samo pobednika. Ako FAIL, može se vratiti i izabrati drugi test.

**Forma:**

| # | Polje | Tip | Opis |
|---|-------|-----|------|
| 1 | Source | Select | BILO KOJI eksperiment za verifikaciju — prikazuje ime + opis + profit svakog (npr. "CmaEs SortinoDaily — 15.2% profit") |
| 2 | Verification Name | Text input | Korisnik imenuje ovaj verification test (npr. "OOS 2025 verify CmaEs") |
| 3 | Description | Text input (opcioni) | Kratki opis (npr. "Provera na 2025 podacima pre paper tradinga") |
| 4 | Start Date | Date + Time | Početak OUT-OF-SAMPLE perioda (YYYY-MM-DD HH:mm:ss) |
| 5 | End Date | Date + Time | Kraj OUT-OF-SAMPLE perioda (YYYY-MM-DD HH:mm:ss) |

- ⚠️ WARNING box (žuti, uvek vidljiv): "Koristite DRUGI vremenski period od treninga! Training period za izabrani test: [auto-detected]. Preporučeni verification period: [auto-suggested]"
- Tooltip na WARNING: "Ako testirate na istim podacima na kojima je strategija trenirana, verification nema smisla — kao da pitaš učenika odgovore na isti test koji je već rešio"
- Readonly prikaz optimizovanih parametara koji će biti testirani (korisnik vidi šta se testira ali ne može menjati)
- Dugme: **"Run Verification Backtest"** (primary)

**Rezultati:**

VERDICT BANNER (veliko, jasno):
- ✅ **PROŠLA** (zeleni banner): "Strategija radi dobro i na novim podacima — spremna za Paper Trading"
- ❌ **PALA** (crveni banner): "Strategija radi značajno lošije na novim podacima — verovatno je preučena"

Kriterijumi za PASS/FAIL (prostim jezikom objašnjeni korisniku):
- Profit pad manji od 50% → ✅ (npr. trening 15%, verifikacija 8% = pad 47% → OK)
- Drawdown porast manji od 30% → ✅ (npr. trening DD 10%, verifikacija DD 12% = porast 20% → OK)
- Win rate pad manji od 15 procentnih poena → ✅ (npr. trening 65%, verifikacija 55% = pad 10pp → OK)
- Ako BILO KOJI kriterijum padne → ❌ FAIL

Side-by-side tabela (korisnik jasno vidi razliku):

| Metrika | Na trening podacima | Na novim podacima | Razlika | Ocena |
|---------|--------------------|--------------------|---------|-------|
| Broj trades-ova | X | Y | Δ | ✓/✗ |
| Win Rate | X% | Y% | Δpp | ✓/✗ |
| Profit% | X% | Y% | Δ% | ✓/✗ |
| Max Drawdown | X% | Y% | Δ% | ✓/✗ |
| Sharpe | X | Y | Δ | ✓/✗ |
| Sortino | X | Y | Δ | ✓/✗ |
| Prosečno trajanje trade-a | Xd | Yd | Δ | info |

Tooltip na "Na trening podacima": "Podaci na kojima je strategija trenirana i optimizovana"
Tooltip na "Na novim podacima": "Podaci koje strategija nikad nije videla — pravi test"

**Dugmad posle PASS:**
- **"Promote to Version ★"** → kreira novu verziju strategije sa ovim parametrima
- **"→ Paper Trading"** → prebacuje na Paper Trading setup stranicu

⚠️ NAPOMENA: "→ Paper Trading" dugme se pojavljuje JEDINO ovde, posle PASS verdikta. Ovo je jedini put ka Paper Trading-u u celoj aplikaciji. Korisnik može preskočiti AI Review (Tab 5) ali NE MOŽE preskočiti Verification.

**Dugmad posle FAIL:**
- **"← Izaberi drugi test"** → vraća na Experiments tab da korisnik izabere drugi test za verifikaciju
- **"Pokreni ponovo sa drugim periodom"** → ostaje na istom tabu, resetuje datume

### Sekcija 2: Lookahead Analysis (§21)

**Šta je ovo?** Proverava da li strategija "vara" — da li slučajno koristi buduće podatke za odluke. Ovo je tehnički bug u kodu strategije, ne problem sa parametrima.

**Prostim jezikom**: "Da li strategija gleda unapred? Npr. da li koristi sutrašnju cenu da odluči šta kupiti danas — što je nemoguće u pravom tradingu."

**Forma:**
- Strategija je već izabrana (iz workspace-a)
- Dugme: **"Run Lookahead Analysis"**

**Rezultati (prostim jezikom):**

| Šta proverava | Rezultat | Objašnjenje |
|---------------|----------|-------------|
| Da li gleda unapred? | ✅ NE / ❌ DA | Da li strategija koristi buduće podatke |
| Problematični ulazni signali | Lista ili "Nema" | Koji signali za kupovinu koriste buduće podatke |
| Problematični izlazni signali | Lista ili "Nema" | Koji signali za prodaju koriste buduće podatke |
| Problematični indikatori | Lista ili "Nema" | Koji indikatori koriste buduće podatke |

- ✅ PASS (zeleno): "Strategija ne koristi buduće podatke — sve čisto"
- ❌ FAIL (crveno): "Strategija koristi buduće podatke! Ovo MORA biti popravljeno u kodu strategije pre bilo kakvog tradinga"
  - Lista problematičnih signala/indikatora sa objašnjenjem

FT CLI komanda: `freqtrade lookahead-analysis`

### Sekcija 3: Recursive Analysis (§22)

**Šta je ovo?** Proverava da li indikatori u strategiji zavise jedni od drugih u krug — što može stvoriti nestabilne signale.

**Prostim jezikom**: "Da li indikator A zavisi od indikatora B koji zavisi od indikatora A? To stvara petlju koja daje nepouzdane rezultate."

**Forma:**
- Strategija je već izabrana (iz workspace-a)
- Dugme: **"Run Recursive Analysis"**

**Rezultati:**
- ✅ PASS (zeleno): "Nema rekurzivnih zavisnosti — indikatori su nezavisni"
- ❌ FAIL (crveno): "Pronađene rekurzivne zavisnosti!"
  - Lista parova: "Indikator X ↔ Indikator Y (međusobno zavise)"
  - Severity: koliko je ozbiljan problem (low/medium/high)
  - Objašnjenje: "Ovo može prouzrokovati različite rezultate svaki put kad se backtest pokrene"

FT CLI komanda: `freqtrade recursive-analysis`

### Preporučeni redosled na Validation tabu:

```
1. Lookahead Analysis  (brzo, proverava kod strategije)
2. Recursive Analysis  (brzo, proverava kod strategije)
3. Verification Backtest (sporije, proverava performanse na novim podacima)

Zašto ovaj redosled: Nema smisla raditi Verification Backtest ako
strategija ima lookahead ili recursive bug — prvo popravi kod, pa onda verifikuj.
```

---

## OVERLAY: SVI TESTOVI (dugme "📋 Svi testovi")

**Svrha**: Pregled svih testova za ovu strategiju na jednom mestu. Organizacija, filtriranje, prečice ka drugim tabovima.

**Ovo je pomoćni overlay — NIJE korak u pipeline-u.** Otvara se klikom na dugme "📋 Svi testovi (416)" u headeru workspace-a. Zatvara se sa X ili Escape — korisnik se vraća tačno gde je bio.

Svi testovi se automatski čuvaju iz pipeline tabova (Backtest, Hyperopt, FreqAI, Validation, AI Review). Ovaj overlay ih samo prikazuje sve zajedno. Korisnik može proći ceo pipeline bez da ikad otvori ovo.

**Prikazuje samo testove za TRENUTNU strategiju** — jer si već u workspace-u te strategije. Za drugu strategiju se vratiš na Experiment List (Stranica 1).

### Kontrole na vrhu:
- Sort: po datumu, profitu, Sharpe-u, tipu
- Filter: po tipu (Backtest / Hyperopt / FreqAI / Verification / AI Review)
- Search: pretraga po imenu testa

### Tabela svih eksperimenata:
SVI testovi su UVEK vidljivi — ništa se ne skriva i ne briše. Promovisani test ima ★ zvezdu i vizuelno je istaknut.

**Kolone tabele:**

| Kolona | Opis |
|--------|------|
| ★ | Zvezda — samo za promovisani/aktivni test |
| Ime | Ime koje je korisnik dao testu |
| Tip | Backtest / Hyperopt / FreqAI / Verification / AI Review |
| Datum i vreme | YYYY-MM-DD HH:mm:ss |
| Timerange | Period podataka korišćen za test |
| Trades | Broj trades-ova |
| Profit% | Ukupni profit |
| Max DD | Maksimalni drawdown |
| Sharpe | Sharpe ratio |
| Status | running / completed / promoted / failed |

**Sa 416 testova po strategiji, ova tabela može biti velika** — zato su Sort i Filter bitni. Korisnik može npr. filtrirati samo FreqAI testove i sortirati po profitu da brzo nađe najboljeg.

**Klik na red** → proširuje se sa svim detaljima tog testa
**Dugmad u proširenom redu:**
- **"→ Verify"** → prebacuje na Validation tab sa ovim testom kao source
- **"Promote ★"** → promovise u aktivnu verziju strategije
- **"Compare"** → dodaje u Compare tab za poređenje
- **"→ Analysis"** → prebacuje na Analysis tab sa ovim testom

### Active Version Panel (bočni panel, uvek vidljiv):
- Prikazuje trenutno aktivnu (promovisanu) verziju strategije
- Verzija broj, datum promovisanja, izvor (koji test je promovisan)
- Ključne metrike: profit, win rate, DD, Sharpe
- **"Version History"** toggle — prikazuje sve prethodne verzije (v1.0, v2.0, itd.)

### Pipeline Status (vizuelni prikaz gde se strategija nalazi):
```
Strategija "BollingerBreak"
├── Backtest: bazni test BTC/USDT 2022-2024 → 5.2% profit
├── Hyperopt: 288 testova (4 × 12 × 6)
│   ├── Najbolji: CmaEs + SortinoDaily → 15.2%, Sharpe 1.5 ★
│   ├── Drugi: TPE + Sharpe → 12.1%, Sharpe 1.2
│   └── ... (286 ostalih, svi vidljivi u tabeli)
├── FreqAI: 128 testova (8 × 4 × 2 × 2)
│   ├── Najbolji: LightGBMRegressor + DI + PCA → 13.8%, Sharpe 1.4
│   └── ... (127 ostalih)
├── AI Review: ocena 78/100 — SPREMNA
├── Verification: OOS 2024-2025 → PASS ✅ (profit 11.3%)
├── Promoted to v1.0
└── ACTIVE: v1.0 → Paper Trading (Dan 12/30)
```

---

## OVERLAY: UPOREDI (dugme "⚖️ Uporedi")

**Svrha**: Uporedi bilo koja dva testa jedan pored drugog da vidiš razlike.

**Ovo je pomoćni overlay — NIJE korak u pipeline-u.** Otvara se klikom na dugme "⚖️ Uporedi" u headeru ili klikom na "Compare" dugme u proširenom redu testa. Potpuno opciono.

### Kako se koristi:

1. Korisnik bira dva testa iz dropdown-ova (svi testovi za ovu strategiju su dostupni)
2. Klikne "Compare"
3. Vidi tabelu sa svim metrikama uporedo

Alternativno: iz Experiments taba (Tab 7), klik na "Compare" dugme u proširenom redu automatski popunjava Run A.

### Kontrole:
- **Test A** dropdown: lista svih testova za ovu strategiju (prikazuje ime + tip + profit)
- **Test B** dropdown: ista lista
- **"Compare"** dugme

### Comparison Table (prostim jezikom):

| Metrika | Test A | Test B | Razlika | Bolji |
|---------|--------|--------|---------|-------|
| Broj trades-ova | X | Y | Δ | → |
| Win Rate | X% | Y% | Δpp | → |
| Prosečan profit po trade-u | X% | Y% | Δ% | → |
| Ukupan profit | X% | Y% | Δ% | → |
| Max Drawdown | X% | Y% | Δ% | → |
| Sharpe | X | Y | Δ | → |
| Sortino | X | Y | Δ | → |
| Calmar | X | Y | Δ | → |
| Prosečno trajanje trade-a | Xd | Yd | Δ | — |
| Profit Factor | X | Y | Δ | → |

- **"→"** strelica uvek pokazuje ka boljem testu, obojena zeleno
- Tooltip na svakoj metrici objašnjava šta meri (npr. "Sharpe — odnos zarade i rizika, viši je bolji")

### Summary box (dno tabele):

Prostim jezikom: "Test A je bolji u 6 od 10 metrika. Najveća razlika je u Max Drawdown (Test B ima 12% manji pad)."

### Dugmad:
- **"→ Verify bolji"** → prebacuje bolji test na Validation tab
- **"Dodaj još jedan test"** → dodaje treću kolonu (Test C) za trostruko poređenje

---

## INTERAKCIJE IZMEĐU STRANICA, TABOVA I OVERLAY-A

### Navigacija između stranica:
| Akcija | Odakle | Gde vodi |
|--------|--------|----------|
| Klik na strategiju | Stranica 1 (Experiment List) | Stranica 2 (Workspace za tu strategiju) |
| Klik "New Experiment" | Stranica 1 | Stranica 2 sa novim draft-om od nule |
| Klik "← Nazad" | Stranica 2 (Workspace) | Stranica 1 (Experiment List) |

### Navigacija između pipeline tabova:
| Akcija | Odakle | Gde vodi |
|--------|--------|----------|
| Klik "→ Verify" na rezultat | Tab 2 (Hyperopt) ili Tab 3 (FreqAI) | Tab 5 (Validation), pre-popunjeni source |
| Klik "→ FreqAI" na rezultat | Tab 2 (Hyperopt) | Tab 3 (FreqAI), pre-popunjeni parametri |
| Klik "AI Review" | Tab 4 (Naš AI) ili Tab 5 (Validation) | Tab 4 (Naš AI), svi testovi |
| Klik "→ Paper Trading" | Tab 5 (Validation), posle PASS | Paper Trading setup (van Testing sekcije) |
| Klik "Promote ★" | Tab 5 (Validation), posle PASS | Kreira verziju, ostaje na istom tabu |

### Otvaranje overlay-a (iz bilo kog taba):
| Akcija | Dugme | Overlay |
|--------|-------|---------|
| Klik "📋 Svi testovi" | Header dugme | Overlay: Svi testovi (fullscreen tabela svih 416 testova) |
| Klik "⚖️ Uporedi" | Header dugme | Overlay: Uporedi (side-by-side dva testa) |
| Klik "📊 Analiza" | Header dugme | Overlay: Analiza (dubinska §30 analiza) |
| Klik "Compare" na test | Bilo koji tab sa rezultatima | Overlay: Uporedi, pre-popunjen Test A |
| Klik "→ Analysis" na test | Bilo koji tab sa rezultatima | Overlay: Analiza, source = taj test |
| Klik "→ Verify" u Svi testovi | Overlay: Svi testovi | Zatvara overlay → Tab 5 (Validation), pre-popunjen |

### Pravilo za overlay-e:
- Overlay se otvara PREKO trenutnog taba — ne menja tab
- Zatvara se sa X dugmetom ili Escape tipkom
- Korisnik se vraća tačno gde je bio pre otvaranja overlay-a
- Overlay može otvoriti pipeline tab (npr. "→ Verify" zatvara overlay i otvara Validation tab)

---

## FT API ENDPOINTS (koji se koriste)

| Endpoint | Method | Koristi se u |
|----------|--------|-------------|
| GET /api/v1/strategies | GET | Stranica 1 (Experiment List) |
| POST /api/v1/backtest | POST | Tab 1 (start backtest) |
| GET /api/v1/backtest | GET | Tab 1 (poll results) |
| GET /api/v1/backtest/history | GET | Tab 1 (history panel) |
| GET /api/v1/balance | GET | Header (portfolio) |
| GET /api/v1/ping | GET | Header (heartbeat) |
| POST /api/v1/stop | POST | Kill switch (soft) |
| POST /api/v1/forceexit | POST | Kill switch (hard) |

CLI komande (preko orchestratora):
- `freqtrade hyperopt` → Tab 2
- `freqtrade lookahead-analysis` → Tab 4
- `freqtrade recursive-analysis` → Tab 4
- `freqtrade backtesting --analysis-groups` → Tab 3

---

## SERVER ARHITEKTURA

### Setup: 2 servera (razdvojeni po tipu posla)

| Server | Uloga | Provider | Spec | Cena/mes |
|--------|-------|----------|------|----------|
| **Glavni server** | Orchestrator, UI, Paper Trading, Hyperopt batch (288 testova) | Hetzner CCX63 | 48 CPU AMD, 192 GB RAM, 960 GB SSD | ~€374 |
| **ML server** | FreqAI trening (128 testova), GPU-ubrzano | RunPod ili Vast.ai | RTX 4090, 24 GB VRAM (po satu) | ~€80-94 (10h/dan) |

**Ukupno: ~€454-468/mesec**

### Zašto ovako:
- **Hyperopt** je CPU posao — više jezgara = više paralelnih backtestova. GPU ne pomaže. CCX63 sa 48 CPU je idealan.
- **FreqAI** je ML trening — GPU ubrzava LightGBM/XGBoost 5-10x, PyTorch 10-50x. Plaćanje po satu umesto fiksno.
- **Orchestrator + UI + Paper Trading** rade na istom serveru kao Hyperopt — CCX63 je uvek upaljen za Paper botove, nema smisla plaćati zasebno.
- **ML server se pali po potrebi** — kad pokreneš FreqAI batch, podigneš RunPod instancu, kad završi — ugasiš. Platiš samo dok radi.

### Procena vremena za batch testove:

```
Hyperopt (288 testova) na CCX63 (48 CPU):
  Paralelno: 8-12 backtestova istovremeno
  Procena: ~2-4 sata za kompletnu matricu

FreqAI (128 testova) na RTX 4090:
  Paralelno: zavisno od VRAM-a, 1-4 modela istovremeno
  Procena: ~3-6 sati za kompletnu matricu

Ukupno po strategiji: ~5-10 sati za svih 416 testova
```

### Automatsko upravljanje ML serverom:
- Korisnik NIKAD ne pali/gasi RunPod ručno — orchestrator radi sve automatski
- Kad korisnik klikne "Run Full Matrix" na FreqAI tabu:
  1. Orchestrator poziva RunPod API → podiže GPU instancu (~30-60 sekundi)
  2. Šalje FreqAI batch na GPU instancu
  3. Prati progress i šalje update na frontend
  4. Kad svi testovi završe → automatski gasi instancu
  5. Naplata prestaje odmah po gašenju
- UI prikazuje status: "Starting GPU server...", "Training 47/128...", "Shutting down GPU..."
- Ako korisnik klikne "Stop All" → orchestrator odmah gasi instancu (štedi novac)
- RunPod API: https://docs.runpod.io/api — podržava programsko kreiranje/brisanje pod-ova

### Skaliranje:
- Ako CCX63 nije dovoljan za Hyperopt → upgrade na dedicated server (Hetzner AX162, 96 threads)
- Ako RTX 4090 nije dovoljan za FreqAI → upgrade na A100 80GB ($2/h na Vast.ai)
- Više strategija paralelno → više RunPod instanci istovremeno

---

## FT POLJA (NIKAD ne koristiti druge nazive)

| Tačno (FT) | NIKAD |
|------------|-------|
| open_rate | ~~entry_price~~ |
| close_rate | ~~exit_price~~ |
| close_profit_abs | ~~net_pnl~~ |
| stake_amount | ~~position_size~~ |
| enter_tag | ~~entry_signal~~ |
| exit_reason | ~~exit_signal~~ |
| current_profit | ~~unrealized_pnl~~ |
| is_short | ~~direction~~ |
| trade_id | ~~custom id~~ |
| open_date | ~~entry_time~~ |
| close_date | ~~exit_time~~ |
| fee_open | ~~entry_fee~~ |
| fee_close | ~~exit_fee~~ |
