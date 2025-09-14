# ClimbNThrive TSX Screener

A CLI tool for screening fundamentals of all publicly listed Canadian companies on TSX and TSXV exchanges.

## Features

- **Comprehensive Coverage**: Fetches all TSX and TSXV listed companies
- **Rich Fundamentals**: Valuation metrics, profitability ratios, growth indicators, and risk metrics
- **Export Formats**: Both XLSX and CSV output formats
- **Rate Limited**: Respects API rate limits with exponential backoff
- **Resumable**: Caches data and can resume interrupted runs
- **Type Safe**: Built with TypeScript for reliability

## Setup

### Prerequisites

- Node.js LTS (>=18 or 20)
- npm package manager

### Installation

1. Clone and navigate to the project:
```bash
cd climbnthrive-tsx-screener
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.example .env
direnv allow  # if using direnv
```

4. Edit `.env` and add your API keys:
   - `FMP_API_KEY`: Get a free API key from [Financial Modeling Prep](https://financialmodelingprep.com/developer/docs)
   - `RISK_FREE_RATE`: Set the risk-free rate for Sharpe ratio calculations (e.g., 0.02 for 2%)

## Usage

### Development Mode

Run a small sample to test the setup:
```bash
npm run dev -- --include-tsx --limit 25
```

### Production Mode

Build and run the full screener:
```bash
npm run build
npm start -- --include-tsx --include-tsxv --concurrency 5 --out out/tsx.xlsx
```

### CLI Options

- `--include-tsx`: Include TSX companies (default: true)
- `--include-tsxv`: Include TSXV companies (default: false)  
- `--limit <n>`: Limit to first N companies (for testing)
- `--concurrency <n>`: Number of concurrent API requests (default: 5)
- `--out <path>`: Output file path (default: out/tsx-fundamentals.xlsx)
- `--csv <path>`: CSV output path (default: out/tsx-fundamentals.csv)

## Data Sources

- **Symbol Lists**: Financial Modeling Prep API
- **Quotes & Fundamentals**: Yahoo Finance (via yahoo-finance2 npm package)
- **Fallback Data**: Financial Modeling Prep ratios endpoints

## Output Columns

The generated spreadsheet includes these columns:

**Basic Info**: Ticker, Company, Exchange, Sector, Industry, MarketCap, Price, DividendYield, PayoutRatio, Beta

**Valuation**: PE_TTM, PB, EV_EBITDA

**Profitability**: ROE_TTM, ROIC_TTM, GrossMargin, OperatingMargin, NetMargin

**Growth & Quality**: EPS_CAGR_5Y, ProfitabilityStreakYears, Sharpe_3Y, High_52W, Low_52W

## Development

### Scripts

- `npm run dev`: Run in development mode with ts-node
- `npm run build`: Compile TypeScript to JavaScript
- `npm start`: Run compiled JavaScript
- `npm run lint`: Run ESLint
- `npm run format`: Format code with Prettier
- `npm test`: Run Jest tests

### Testing

Run the test suite:
```bash
npm test
```

### Cache Management

The tool caches API responses in `data/cache/` to avoid redundant requests. To clear the cache:
```bash
rm -rf data/cache/*
```

## Rate Limits & API Usage

- Financial Modeling Prep: 250 requests/day (free tier)
- Yahoo Finance: No official limits, but we use conservative rate limiting
- The tool implements exponential backoff and retry logic for reliability

## Disclaimer

This tool is for educational and research purposes only. The data provided should not be used as the sole basis for investment decisions. Always verify data independently and consult with financial professionals.

## License

MIT License - see LICENSE file for details.
