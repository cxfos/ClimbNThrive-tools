You are a senior TypeScript/Node engineer. Build a CLI tool that compiles a fundamentals table for **all publicly listed Canadian companies** on **TSX** (and optionally **TSXV**) similar to my reference screenshot. The project will live in my public repo **ClimbNThrive-tools** (subfolder is fine). Follow these rules:

GOALS
1) Fetch a complete, programmatic list of TSX (and optionally TSXV) tickers.
2) For each ticker, fetch fundamentals and historical data, compute derived metrics, and export a spreadsheet (XLSX + CSV) with columns matching the reference image:
   
   **REFERENCE TABLE STRUCTURE** (from provided screenshot):
   - **Empresa** (Company info): Ticker, Empresa (Company Name), Tipo de Ativo (Stock Type), Setor (Sector)
   - **Lucro** (Profitability): Anos sem prejuízo (Years without loss), CAGR do LPA em 5 anos (EPS CAGR 5Y), Dívida Líquida/EBITDA (Net Debt/EBITDA)
   - **Negócio** (Business metrics): ROE, ROIC, Margem Líquida (Net Margin), Margem EBIT (EBIT Margin)  
   - **Sociedade** (Valuation): Anos desde o IPO (Years since IPO), Índice Sharpe (Sharpe Ratio)
   
   **MAPPED TO TSX/CANADIAN CONTEXT**:
   - Ticker, Company, Exchange (TSX/TSXV), Sector
   - Years_Without_Loss, EPS_CAGR_5Y, Net_Debt_EBITDA_Ratio  
   - ROE, ROIC, Net_Margin, EBIT_Margin
   - Years_Since_IPO, Sharpe_Ratio_3Y
3) Make it **repeatable**, **rate-limited**, **resumable**, and safe to run in a public repo (no secrets committed).
4) Ask me for confirmation after each major step before proceeding.

TECH CONSTRAINTS
- Language: **TypeScript** on Node **LTS (>=18 or 20)**.
- Package manager: **npm**.
- Data sources:
  - Use **Financial Modeling Prep (FMP)** to obtain the *full symbol list*: `GET /api/v3/stock/list?apikey=...` then filter by `exchangeShortName IN ("TSX","TSXV")`.
  - Use **yahoo-finance2** (npm) for quotes, fundamentals, and historical prices. Map symbols to Yahoo format:
    - TSX → `SYMBOL.TO`
    - TSXV → `SYMBOL.V`
  - If a metric isn’t available via Yahoo, optionally fall back to **FMP** ratios endpoints. Keep all API keys in env vars.
- Do NOT scrape websites.
- Respect rate limits (use **bottleneck** or **p-limit**) and implement exponential backoff retries.
- Keep an on-disk JSON cache to avoid refetching unchanged data (e.g., `data/cache/`).

SECURITY & ENV
- Use **dotenv** and **direnv**. 
- Create `.env.example` with placeholders: 
  - `FMP_API_KEY=`
  - `RISK_FREE_RATE=0.02`  # annualized, for Sharpe calc
- Create `.envrc`:


```
dotenv
```

- Add `.gitignore`: `node_modules/`, `.env`, `.envrc`, `data/`, `*.log`, `dist/`.
- Never commit secrets. Ship `.env.example` only.

PROJECT SCaffold (ask me to confirm before continuing)
1) Initialize a new Node + TS project in `climbnthrive-tsx-screener/`:
 - `package.json` with scripts:
   - `"dev": "ts-node src/index.ts"`
   - `"build": "tsc"`
   - `"start": "node dist/index.js"`
   - `"lint": "eslint ."`
   - `"format": "prettier --write ."`
 - Dependencies: 
   - runtime: `yahoo-finance2`, `node-fetch` (if needed), `xlsx`, `dotenv`, `bottleneck` (or `p-limit`), `yargs`, `zod`, `date-fns`
   - dev: `typescript`, `ts-node`, `@types/node`, `eslint`, `prettier`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`
 - `tsconfig.json`: outDir `dist/`, ES2020 target/module, `resolveJsonModule: true`.
 - ESLint + Prettier basic configs.
 - `README.md` with setup/run instructions, data-source notes, and disclaimer.
 - MIT `LICENSE`.
 - Create folders: `src/`, `src/sources/`, `src/metrics/`, `src/utils/`, `data/cache/`, `out/`.

IMPLEMENTATION PLAN (confirm after each numbered step)
2) **Ticker discovery (FMP)**
 - `src/sources/fmp.ts`:
   - `fetchAllSymbols()`: calls `/api/v3/stock/list?apikey=...`.
   - Filter by `exchangeShortName` in {`TSX`, `TSXV`} and `type` contains "Common Stock"/stocks only.
   - Return array of `{ symbol, name, exchangeShortName, sector?, industry? }`.
   - Persist raw list to `data/cache/symbols-YYYYMMDD.json`.
 - CLI flags (via `yargs`):
   - `--include-tsx` (default true), `--include-tsxv` (default false)
   - `--limit <n>` for dev runs
 - Map to Yahoo symbols:
   - If `exchangeShortName === "TSX"` → `${symbol}.TO`
   - If `exchangeShortName === "TSXV"` → `${symbol}.V`
   - Add a small mapping guard in case the input symbol already has a suffix (avoid double suffixing).
 - Show me a count of tickers selected and example sample (first 10). Ask to proceed.

3) **Data fetchers (Yahoo first, FMP fallback)**
 - `src/sources/yahoo.ts`:
   - `getQuote(symbolYahoo)`
   - `getHistoricalDaily(symbolYahoo, lookbackYears = 3)`
   - `getFinancials(symbolYahoo)` → income statement & balance sheet history if available via yahoo-finance2 `quoteSummary` modules (or equivalent methods).
 - `src/sources/fmp-ratios.ts` (optional fallback):
   - `getRatios(symbolFmp)` → ROE, ROIC, margins, Debt/Equity, etc.
   - `getIncomeStatements(symbolFmp)` → for EPS history if Yahoo lacks it.
 - Use **Bottleneck** to limit concurrency (e.g., 5 requests in-flight) and add retries with exponential backoff.
 - Cache each raw response under `data/cache/${symbol}/`.

4) **Metrics computation (`src/metrics/*`)**
 - `computeEpscagr5y(epsByYear: number[])`: CAGR over last 5 full fiscal years. If fewer than 5, return `null`.
 - `computeProfitabilityStreakYears(epsByYear: number[])`: count of consecutive most-recent years with EPS > 0.
 - `computeSharpe3y(dailyCloses: number[], riskFreeAnnual: number)`: 
   - Convert daily closes to daily returns.
   - Annualized return = (final/initial)^(365/tradingDays) - 1.
   - Annualized volatility = stdev(daily returns) * sqrt(252).
   - Sharpe = (annualReturn - riskFreeAnnual) / annualVol.
   - If insufficient data, `null`.
 - Extract ROE/ROIC/Gross/Op/Net margins from Yahoo; if missing, fallback to FMP ratios.
 - Provide robust null-safety and unit conversions.

5) **Assembler & Export**
 - `src/index.ts`:
   - Parse CLI flags: `--include-tsx`, `--include-tsxv`, `--limit`, `--out out/tsx-fundamentals.xlsx`, `--csv out/tsx-fundamentals.csv`, `--concurrency 5`.
   - Load symbols list (cache if present and recent).
   - For each symbol (respecting `--limit`), map to Yahoo symbol; run fetchers; compute metrics.
   - Write rows incrementally to an in-memory array and periodic checkpoint JSON (`data/cache/progress.json`) so a crash can resume.
   - Export **XLSX** (`xlsx` package) with a single sheet "TSX Fundamentals".
   - Also export **CSV** for lightweight use.
 - Columns (exact order):
   - `Ticker` (Yahoo format), `Company`, `Exchange` (TSX/TSXV), `Sector`, `Industry`, `MarketCap`, `Price`, `DividendYield`, `PayoutRatio`, `Beta`, 
   - `PE_TTM`, `PB`, `EV_EBITDA`,
   - `ROE_TTM`, `ROIC_TTM`, `GrossMargin`, `OperatingMargin`, `NetMargin`,
   - `EPS_CAGR_5Y`, `ProfitabilityStreakYears`, `Sharpe_3Y`, `High_52W`, `Low_52W`
 - After generating a small sample (e.g., `--limit 25`), show me a preview of the first 5 rows in the console and ask to run full.

6) **DX & Reliability**
 - Add a simple progress bar or log every N symbols to show progress.
 - Add `src/utils/retry.ts` for a generic retry function with jitter.
 - Add Zod schema validation for external responses to fail fast and log clearly.
 - Add basic tests for metric functions in `src/metrics/__tests__/metrics.test.ts` (Jest or vitest).
 - README: include setup, env vars, examples:
   - `cp .env.example .env && direnv allow`
   - `npm run dev -- --include-tsx --limit 25`
   - `npm start -- --include-tsx --include-tsxv --concurrency 5 --out out/tsx.xlsx`

7) **Final polish**
 - Ensure `.env`, `.envrc`, `data/`, and any cache artifacts are ignored by Git.
 - Add a `scripts/` helper (optional) to purge cache.
 - Verify Node LTS in README and add note about provider rate limits.
 - Print a short summary on completion: totals fetched, failures retried, rows exported, output paths.

INTERACTION STYLE
- After each numbered step above, STOP and ask me to review/confirm before proceeding.
- When you need a decision (e.g., concurrency limits, whether to include TSXV by default), ask me.
- If an endpoint doesn’t provide a metric, propose alternatives and clearly mark any metric as `null` when unavailable.

ACCEPTANCE CRITERIA
- `npm run dev -- --limit 20` runs end-to-end and creates both CSV and XLSX in `/out`.
- Full run handles thousands of symbols with rate limiting and resumes after interruption.
- No secrets are committed; `.env.example` is provided.
- Code is clean, typed, and documented in README.

Start with Step 1 (scaffold). Show me the file tree and key files' contents, then wait for my confirmation.

---

## PROJECT STATUS

**Current Status**: Step 4 Complete ✅  
**Last Updated**: September 14, 2025  

For detailed progress tracking, see: [`project-status.md`](project-status.md)

### Quick Status Summary:
- ✅ **Step 1**: Project Scaffold - Complete
- ✅ **Step 2**: Ticker Discovery (3,663 TSX companies) - Complete  
- ✅ **Step 3**: Data Fetchers (TSX GraphQL API) - Complete
- ✅ **Step 4**: Metrics Computation (Data Processing Pipeline) - Complete
- 🔄 **Step 5**: Assembler & Export - Ready to Start
- ⏳ **Step 6**: DX & Reliability - Pending
- ⏳ **Step 7**: Final Polish - Pending

### Key Achievements:
- **Complete TSX directory** via official API (not FMP as originally planned)
- **TSX GraphQL API discovery** and optimization (see [`graphql-exploration.md`](graphql-exploration.md))
- **Production-ready data fetcher** with 9.43 req/sec performance (4x improvement)
- **Integrated data processing pipeline** with 100% success rate
- **Clean codebase** with experimental files removed

### Next Step:
Implement Step 5: XLSX/CSV Export System for the processed data.
