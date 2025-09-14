# ClimbNThrive TSX Screener

A CLI tool that generates comprehensive fundamentals tables for **all 3,663 publicly listed Canadian companies** on TSX and TSXV exchanges.

## 🚀 Quick Start

### Prerequisites
- Node.js LTS (>=18 or 20)
- npm package manager

### Installation & Setup
```bash
# 1. Install dependencies
npm install

# 2. Set up environment (optional - TSX GraphQL API doesn't require keys)
cp env.example .env

# 3. Test with a small sample
npm run dev -- --limit 10

# 4. Current functionality: Ticker discovery (Step 2 complete)
npm run build && npm start

# Note: Full screener (Steps 4-7) coming soon!
```

## 📊 Planned Output

Will generate Excel and CSV files with these metrics for each company:

| Category | Metrics | Status |
|----------|---------|--------|
| **Company** | Ticker, Name, Sector | ✅ Available |
| **Profitability** | Years without loss, EPS CAGR 5Y, Net Debt/EBITDA | 🔄 Step 4 |
| **Business** | ROE, ROIC, Net Margin, EBIT Margin | 🔄 Step 4 |
| **Valuation** | Years since IPO, Sharpe Ratio 3Y | 🔄 Step 4 |

## 🎯 Key Features

- ✅ **Complete Coverage**: All 3,663 TSX companies via official TSX API
- ⚡ **High Performance**: TSX GraphQL API with 2.6 requests/sec
- 💾 **Smart Caching**: 24-hour cache reduces repeat API calls
- 📈 **Rich Data**: 80%+ fundamental data completeness
- 🛡️ **Reliable**: Rate limiting, retries, progress tracking

## 📋 CLI Options

```bash
npm start -- [options]

Current Options (Step 3 Complete):
  --include-tsx        Include TSX companies (default: true)
  --include-tsxv       Include TSXV companies (default: false)
  --limit <n>          Test with first N companies

Future Options (Step 4-5):
  --out <path>         Output XLSX path (default: out/tsx-fundamentals.xlsx)
  --csv <path>         Output CSV path (default: out/tsx-fundamentals.csv)  
  --concurrency <n>    Concurrent requests (default: 5)
```

## 🔧 Development

```bash
npm run dev      # Development mode with ts-node
npm run build    # Compile TypeScript
npm test         # Run tests
npm run lint     # ESLint
npm run format   # Prettier
```

## 📚 Documentation

- **[Project Status](docs/project-status.md)** - Current progress and next steps
- **[Technical Deep-dive](docs/graphql-exploration.md)** - TSX GraphQL API exploration
- **[Project Specification](docs/project-specification.md)** - Original requirements
- **[All Documentation](docs/)** - Complete documentation index

## ⚡ Current Status

- **Completed**: Ticker discovery for all 3,663 TSX companies (Step 2)
- **Data Source**: Official TSX API + TSX GraphQL API ready
- **Performance**: 2.6 req/sec for data fetching (tested)
- **Next**: Step 4 - Metrics computation implementation

## ⚠️ Disclaimer

Educational and research purposes only. Not financial advice. Always verify data independently and consult financial professionals.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.
