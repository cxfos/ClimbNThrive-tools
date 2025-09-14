# ClimbNThrive TSX Screener - Documentation

Complete documentation for the TSX fundamentals screening tool.

## 📋 Project Documents

### 🎯 [Project Status](project-status.md)
**Current progress tracker** - where we are and what's next.

- Progress overview table (Steps 1-7)
- Step 3 achievements (TSX GraphQL API discovery)
- Step 4 achievements (Data processing pipeline)
- Next steps (Step 5: Export System)
- Performance metrics (9.43 req/sec, 100% success)

### 📝 [Project Specification](project-specification.md)
**Original requirements document** - the complete project specification.

- Goals and requirements
- Technical constraints
- Implementation plan (7 steps)
- Acceptance criteria
- Quick status summary

### 🔬 [GraphQL Exploration](graphql-exploration.md)
**Technical deep-dive** - comprehensive TSX GraphQL API exploration journey.

- 6-phase exploration process
- Batch vs individual query analysis
- Performance optimization decisions
- Complete technical learnings

---

## 🗂️ Project Structure

### 📁 Key Directories
```
climbnthrive-tsx-screener/
├── src/                    # TypeScript source code
│   ├── sources/           # Data fetching (TSX API, Yahoo Finance)
│   ├── metrics/           # ✅ Step 4 complete - Metrics computation
│   └── utils/             # Utility functions
├── docs/                  # 📚 This documentation
├── data/cache/           # API response caching
└── out/                  # Generated XLSX/CSV files
```

### 🔧 Development Files
- **[../README.md](../README.md)** - Main project README (setup & usage)
- **[../package.json](../package.json)** - Dependencies and scripts
- **[../tsconfig.json](../tsconfig.json)** - TypeScript configuration

---

## 📊 Current Status

**Status**: Step 4 Complete ✅ → Ready for Step 5  
**Goal**: Generate fundamentals table for all 3,663 TSX companies  
**Achievement**: Data processing pipeline with 9.43 req/sec, 100% success rate  

### Progress Summary
| Step | Status | Achievement |
|------|--------|-------------|
| 1 | ✅ Complete | Project scaffold & TypeScript setup |
| 2 | ✅ Complete | **3,663 TSX companies** via official API |
| 3 | ✅ Complete | **TSX GraphQL API** discovery & optimization |
| 4 | ✅ Complete | **Data processing pipeline** with metrics computation |
| 5 | 🔄 Ready | XLSX/CSV export system |
| 6-7 | ⏳ Pending | Testing, validation, polish |

---

## 🚀 Quick Links

### For Users
- **[Setup & Usage](../README.md)** - Get started quickly
- **[Current Status](project-status.md)** - Project progress

### For Developers  
- **[Project Specification](project-specification.md)** - Complete requirements
- **[GraphQL Exploration](graphql-exploration.md)** - Technical deep-dive
- **[Source Code](../src/)** - TypeScript implementation

### For Researchers
- **[GraphQL API Analysis](graphql-exploration.md)** - Comprehensive API exploration
- **[Performance Data](project-status.md#performance-metrics)** - Benchmarks and projections
