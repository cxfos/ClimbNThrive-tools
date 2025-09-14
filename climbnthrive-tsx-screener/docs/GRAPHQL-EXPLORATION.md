# GraphQL API Exploration Journey

## Overview
During Step 3 development, we discovered TSX's GraphQL API and conducted extensive exploration to optimize data fetching. This document chronicles our investigation, findings, and final architectural decisions.

## Initial Discovery
**Date**: September 14, 2025  
**Trigger**: User discovered TSX GraphQL endpoint in browser network tab: `https://app-money.tmx.com/graphql`

**Sample Response Observed**:
```json
{
  "data": {
    "getQuoteBySymbol": {
      "symbol": "AW",
      "name": "A & W Food Services of Canada Inc.",
      "price": 38.15,
      "MarketCap": 915515346,
      "peRatio": 56.94,
      "returnOnEquity": 39.1,
      "sector": "Consumer Discretionary"
      // ... much more comprehensive data
    }
  }
}
```

**Key Insight**: TSX GraphQL provided much richer fundamental data than Yahoo Finance, making it an attractive primary data source.

## Exploration Phases

### Phase 1: Basic GraphQL Query Testing
**Goal**: Establish basic connectivity and understand query structure.

**Approach**: 
- Tested individual `getQuoteBySymbol` queries
- Discovered comprehensive fundamental data availability
- Confirmed 50+ fields available per company

**Result**: ✅ SUCCESS - Rich fundamental data confirmed

**Key Finding**: Individual queries provided complete screening data including:
- Financial ratios (P/E, ROE, ROA, debt ratios)
- Market data (market cap, sector, industry)
- Dividend information
- Technical indicators

### Phase 2: Batch Query Investigation
**Goal**: Discover if GraphQL supports batch queries for performance optimization.

**Hypothesis**: If we could batch multiple symbols per request, we could achieve 10-20x speed improvement.

**Investigation Methods**:
1. **HAR File Analysis** - User provided network traffic capture
2. **GraphQL Aliases** - Attempted multiple queries in single request
3. **Array Parameters** - Tested if queries accept symbol arrays
4. **Schema Introspection** - Attempted to discover available operations

**Key Discovery**: Found `getQuoteForSymbols` operation in HAR file that accepted arrays:
```json
{
  "operationName": "getQuoteForSymbols",
  "variables": {
    "symbols": ["AW", "SHOP", "RY"]
  }
}
```

### Phase 3: Batch Query Implementation Attempts
**Goal**: Implement working batch queries for 20x performance improvement.

**Attempts**:
1. **Direct Implementation** - Copied query structure from HAR
2. **Field Name Mapping** - Discovered batch vs individual used different field names
3. **Progressive Field Discovery** - Systematically tested field availability
4. **Schema Introspection** - Attempted to discover complete GraphQL schema

**Critical Finding**: Batch queries used different GraphQL types with limited field availability.

**Field Comparison**:
| Data Category | Individual Query | Batch Query | Available in Batch? |
|---------------|-----------------|-------------|-------------------|
| Price Data | ✅ Full | ✅ Full | ✅ YES |
| Technical Data | ✅ Full | ✅ Full | ✅ YES |
| **Fundamental Data** | ✅ Full | ❌ None | ❌ **NO** |
| Company Info | ✅ Full | ✅ Partial | ⚠️ LIMITED |

**Batch Query Limitations Discovered**:
- ❌ No P/E ratios, market cap, or financial ratios
- ❌ No ROE, ROA, or debt metrics  
- ❌ No sector/industry classification
- ❌ Only basic price and volume data available

**Result**: ❌ FAILED - Batch queries insufficient for screening requirements

### Phase 4: Hybrid Strategy Exploration
**Goal**: Combine batch queries for price data + individual queries for fundamentals.

**Architecture**: 
- Step 1: Batch fetch price data (20 symbols/request)
- Step 2: Individual fetch fundamental data (1 symbol/request)

**Performance Analysis**:
- Batch requests: 3,663 ÷ 20 = 184 requests
- Individual requests: 3,663 requests  
- **Total**: 3,847 requests vs 3,663 pure individual

**Result**: ❌ INEFFICIENT - Hybrid approach actually slower due to more total requests

### Phase 5: Schema Introspection Attempts
**Goal**: Discover complete GraphQL schema to find hidden batch capabilities.

**Methods Attempted**:
1. **Full Schema Introspection** - `__schema` query
2. **Type-Specific Introspection** - `__type(name: "Quote")` query  
3. **Alternative Type Names** - Tested Company, Stock, Security, etc.

**Result**: ❌ BLOCKED - Introspection disabled by Apollo Server
```json
{
  "errors": [{
    "message": "GraphQL introspection is not allowed by Apollo Server, but the query contained __schema or __type. To enable introspection, pass introspection: true to ApolloServer in production"
  }]
}
```

### Phase 6: Systematic Field Discovery
**Goal**: Use error messages as documentation to discover all available batch fields.

**Strategy**: Test individual query fields systematically in batch queries, using GraphQL error suggestions as field name mappings.

**Process**:
1. Test each field from individual query in batch context
2. Parse error messages for field name suggestions
3. Test suggested alternatives
4. Build comprehensive field mapping

**Results**: 
- ✅ 12 working fields discovered in batch queries
- ❌ 20+ fundamental fields confirmed unavailable  
- ✅ Complete field mapping documented

**Final Batch Capability Assessment**:
- **Price/Technical Data**: Excellent (12 fields)
- **Fundamental Data**: None (0 critical fields)
- **Screening Capability**: Insufficient for project requirements

## Final Architecture Decision

### Chosen Approach: Optimized Individual Queries
**Rationale**: 
1. **Complete Data**: All fundamental metrics needed for screening
2. **Optimal Efficiency**: Single request per company gets all required data
3. **Proven Performance**: 2.6 requests/second with 100% success rate
4. **Smart Caching**: 24-hour cache reduces repeat requests

### Performance Projections:
- **3,663 companies** at 2.6 req/sec = **~24 minutes total**
- **150 requests/minute** sustained rate with burst capacity
- **24-hour caching** for subsequent runs
- **80%+ data completeness** expected

### Key Optimizations Implemented:
1. **Streamlined Query** - Only essential fields for target table
2. **Aggressive Rate Limiting** - 4 concurrent, 400ms intervals  
3. **Smart Caching** - Per-symbol caching with expiration
4. **Progress Tracking** - Real-time progress with ETA calculations

## Files Created During Exploration

### Experimental Files (To Be Cleaned Up):
- `src/test-batch-discovered.ts` - Initial batch query test
- `src/test-batch-graphql.ts` - GraphQL batch exploration
- `src/test-corrected-batch.ts` - Field name correction attempts
- `src/test-exact-fields-batch.ts` - Field parity testing
- `src/test-har-patterns.ts` - HAR file pattern testing
- `src/test-batch-comprehensive.ts` - Comprehensive field testing
- `src/discover-batch-schema.ts` - Schema discovery tool
- `src/introspect-tsx-schema.ts` - Introspection attempts
- `src/systematic-field-discovery.ts` - Systematic field mapping
- `src/analyze-tsx-queries.ts` - Query analysis utility
- `src/analyze-har-file.ts` - HAR file analyzer

### Documentation Files:
- `NETWORK-ANALYSIS-GUIDE.md` - HAR capture instructions
- `data/analysis/har-analysis-*.json` - HAR analysis results

### Final Production Files:
- `src/sources/tsx-graphql.ts` - Individual GraphQL client (comprehensive)
- `src/sources/tsx-optimized.ts` - **PRODUCTION** - Optimized individual fetcher
- `src/sources/tsx-batch-graphql.ts` - Batch client (limited utility)
- `src/sources/tsx-hybrid-fetcher.ts` - Hybrid approach (not used)

## Key Learnings

### Technical Insights:
1. **GraphQL Type Differences**: Batch vs individual queries may use different GraphQL types with different field availability
2. **Introspection Blocking**: Production GraphQL APIs often disable introspection for security
3. **Error Message Documentation**: GraphQL error messages can serve as informal schema documentation
4. **Performance vs Completeness**: More requests with complete data can be more efficient than fewer requests with incomplete data

### Strategic Insights:
1. **Premature Optimization**: Batch queries seemed faster but lacked required data
2. **Requirements First**: Data completeness requirements should drive architecture decisions
3. **Incremental Optimization**: Optimizing individual queries proved more effective than architectural changes
4. **User Feedback Value**: User's network discovery was the key breakthrough

### Project Management Insights:
1. **Exploration vs Production**: Clearly separate experimental code from production code
2. **Documentation Importance**: Complex exploration requires thorough documentation
3. **Cleanup Necessity**: Experimental files can clutter and confuse the codebase

## Conclusion

The GraphQL exploration was valuable for understanding the TSX API capabilities and limitations. While batch queries initially appeared promising for performance optimization, the fundamental data limitations made them unsuitable for our screening requirements.

The final optimized individual query approach provides the best balance of:
- ✅ **Data Completeness** - All required fundamental metrics
- ✅ **Performance** - 2.6 req/sec with smart caching  
- ✅ **Reliability** - 100% success rate in testing
- ✅ **Maintainability** - Simple, focused architecture

**Next Steps**: Clean up experimental files and proceed with Step 4: Metrics Computation.
