# ClimbNThrive TSX Screener - Documentation

Complete documentation for the TSX fundamentals screening tool.

## 📋 Project Documents

### 🎯 [Project Status](project-status.md)
**Current progress tracker** - where we are and what's next.

- Progress overview table (Steps 1-7)
- Step 3 achievements (TSX GraphQL API discovery)
- Next steps (Step 4: Metrics Computation)
- Performance projections

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
│   ├── metrics/           # 🔄 Step 4 target - Metrics computation
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

**Status**: Step 3 Complete ✅ → Ready for Step 4  
**Goal**: Generate fundamentals table for all 3,663 TSX companies  
**Achievement**: TSX GraphQL API with 2.6 req/sec, 80%+ data completeness  

### Progress Summary
| Step | Status | Achievement |
|------|--------|-------------|
| 1 | ✅ Complete | Project scaffold & TypeScript setup |
| 2 | ✅ Complete | **3,663 TSX companies** via official API |
| 3 | ✅ Complete | **TSX GraphQL API** discovery & optimization |
| 4 | 🔄 Ready | Metrics computation for target table |
| 5-7 | ⏳ Pending | Export, testing, polish |

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
