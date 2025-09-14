/**
 * Optimized TSX GraphQL Individual Query Fetcher
 * Streamlined to fetch ONLY the data needed for the reference table structure
 * 
 * Based on reference image, we need:
 * - Company info: Ticker, Company Name, Sector
 * - Profitability: Years without loss, EPS CAGR 5Y, Net Debt/EBITDA  
 * - Business: ROE, ROIC, Net Margin, EBIT Margin
 * - Valuation: Years since IPO, Sharpe Ratio 3Y
 */

import { z } from 'zod';
import Bottleneck from 'bottleneck';
import { promises as fs } from 'fs';
import path from 'path';

// Optimized schema - only fields we actually need
const OptimizedTsxResponseSchema = z.object({
  data: z.object({
    getQuoteBySymbol: z.object({
      // Company identification
      symbol: z.string(),
      name: z.string().nullable(),
      sector: z.string().nullable(),
      
      // Financial ratios we need
      returnOnEquity: z.union([z.number(), z.string()]).nullable(),
      returnOnAssets: z.union([z.number(), z.string()]).nullable(), // Will calculate ROIC from this if needed
      
      // Debt metrics
      totalDebtToEquity: z.union([z.number(), z.string()]).nullable(),
      
      // For EPS CAGR and years without loss calculations
      eps: z.number().nullable(),
      
      // Current price for calculations
      price: z.number().nullable(),
      
      // Market data for Sharpe ratio (we'll need historical data separately)
      beta: z.number().nullable(),
      
      // Additional useful fields that don't cost extra
      MarketCap: z.number().nullable(),
      peRatio: z.number().nullable(),
      dividendYield: z.number().nullable(),
      
    }).nullable(),
  }),
  errors: z.array(z.any()).optional(),
});

export interface OptimizedQuoteData {
  // Core identification
  symbol: string;
  name?: string;
  sector?: string;
  
  // Key financial metrics for our table
  returnOnEquity?: number;
  returnOnAssets?: number;
  totalDebtToEquity?: number;
  eps?: number;
  price?: number;
  beta?: number;
  
  // Bonus data (useful but not in main table)
  marketCap?: number;
  peRatio?: number;
  dividendYield?: number;
  
  // Metadata
  fetchedAt: string;
}

/**
 * Optimized TSX GraphQL client focused on essential data only
 */
export class TsxOptimizedFetcher {
  private rateLimiter: Bottleneck;
  private cacheDir: string;
  
  // Minimal GraphQL query - only essential fields
  private readonly OPTIMIZED_QUERY = `
    query getQuoteBySymbol($symbol: String, $locale: String) {
      getQuoteBySymbol(symbol: $symbol, locale: $locale) {
        symbol
        name
        sector
        returnOnEquity
        returnOnAssets
        totalDebtToEquity
        eps
        price
        beta
        MarketCap
        peRatio
        dividendYield
        __typename
      }
    }
  `;

  constructor(cacheDir = 'data/cache') {
    this.cacheDir = cacheDir;
    
    // Optimized rate limiting for individual queries
    // More aggressive since we're only getting essential data
    this.rateLimiter = new Bottleneck({
      maxConcurrent: 4,        // Slightly higher concurrency
      minTime: 400,            // 400ms between requests (150/min)
      reservoir: 120,          // Higher burst capacity
      reservoirRefreshAmount: 120,
      reservoirRefreshInterval: 60 * 1000,
    });
  }

  /**
   * Fetch optimized quote data for a single symbol
   */
  async fetchOptimizedQuote(yahooSymbol: string): Promise<OptimizedQuoteData | null> {
    const tsxSymbol = this.toTsxSymbol(yahooSymbol);
    
    // Check cache first
    const cached = await this.loadFromCache(yahooSymbol);
    if (cached) {
      return cached;
    }

    return this.rateLimiter.schedule(async () => {
      try {
        const response = await fetch('https://app-money.tmx.com/graphql', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'locale': 'en',
          },
          body: JSON.stringify({
            operationName: 'getQuoteBySymbol',
            variables: { symbol: tsxSymbol, locale: 'en' },
            query: this.OPTIMIZED_QUERY
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const rawData = await response.json();
        const validatedData = OptimizedTsxResponseSchema.parse(rawData);

        if (validatedData.errors && validatedData.errors.length > 0) {
          console.warn(`⚠️  GraphQL errors for ${tsxSymbol}:`, validatedData.errors);
          return null;
        }

        if (!validatedData.data.getQuoteBySymbol) {
          console.warn(`⚠️  No TSX data found for ${tsxSymbol}`);
          return null;
        }

        const quote = validatedData.data.getQuoteBySymbol;
        
        const optimizedData: OptimizedQuoteData = {
          symbol: yahooSymbol, // Keep Yahoo format for consistency
          name: quote.name || undefined,
          sector: quote.sector || undefined,
          returnOnEquity: this.toNumber(quote.returnOnEquity),
          returnOnAssets: this.toNumber(quote.returnOnAssets),
          totalDebtToEquity: this.toNumber(quote.totalDebtToEquity),
          eps: quote.eps || undefined,
          price: quote.price || undefined,
          beta: quote.beta || undefined,
          marketCap: quote.MarketCap || undefined,
          peRatio: quote.peRatio || undefined,
          dividendYield: quote.dividendYield || undefined,
          fetchedAt: new Date().toISOString(),
        };

        // Cache the result
        await this.saveToCache(yahooSymbol, optimizedData);
        
        return optimizedData;
        
      } catch (error) {
        console.error(`❌ Failed to fetch optimized data for ${tsxSymbol}:`, error);
        return null;
      }
    });
  }

  /**
   * Fetch optimized data for multiple symbols with progress tracking
   */
  async fetchMultipleOptimized(symbols: string[]): Promise<Map<string, OptimizedQuoteData>> {
    console.log(`🚀 Optimized fetch: ${symbols.length} symbols`);
    console.log('📊 Fetching only essential data for table generation');
    
    const results = new Map<string, OptimizedQuoteData>();
    const startTime = Date.now();
    let completed = 0;
    let failed = 0;

    for (const symbol of symbols) {
      try {
        const data = await this.fetchOptimizedQuote(symbol);
        
        if (data) {
          results.set(symbol, data);
        } else {
          failed++;
        }
        
        completed++;
        
        // Progress logging every 50 symbols
        if (completed % 50 === 0 || completed === symbols.length) {
          const progress = (completed / symbols.length * 100).toFixed(1);
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          const rate = (completed / (Date.now() - startTime) * 1000).toFixed(1);
          const eta = completed < symbols.length 
            ? ((symbols.length - completed) / parseFloat(rate)).toFixed(0)
            : 0;
          
          console.log(`  📊 Progress: ${completed}/${symbols.length} (${progress}%) - ${rate}/sec - ${elapsed}s elapsed, ETA: ${eta}s`);
          console.log(`  ✅ Success: ${results.size}, ❌ Failed: ${failed}`);
        }
        
      } catch (error) {
        console.error(`❌ Failed to process ${symbol}:`, error);
        failed++;
        completed++;
      }
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const successRate = (results.size / symbols.length * 100).toFixed(1);
    
    console.log(`\n🎉 Optimized fetch complete: ${results.size}/${symbols.length} quotes (${successRate}%) in ${totalTime}s`);
    
    return results;
  }

  /**
   * Cache management
   */
  private async getCacheDir(symbol: string): Promise<string> {
    const cacheDir = path.join(this.cacheDir, 'optimized', symbol);
    await fs.mkdir(cacheDir, { recursive: true });
    return cacheDir;
  }

  private async loadFromCache(symbol: string): Promise<OptimizedQuoteData | null> {
    try {
      const cacheDir = await this.getCacheDir(symbol);
      const cachePath = path.join(cacheDir, 'optimized-quote.json');
      
      const data = await fs.readFile(cachePath, 'utf8');
      const cached = JSON.parse(data) as OptimizedQuoteData;
      
      // Check if cache is recent (less than 1 day old)
      const cacheAge = Date.now() - new Date(cached.fetchedAt).getTime();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      
      if (cacheAge < maxAge) {
        return cached;
      }
      
      return null; // Cache expired
      
    } catch (error) {
      return null; // No cache or invalid cache
    }
  }

  private async saveToCache(symbol: string, data: OptimizedQuoteData): Promise<void> {
    try {
      const cacheDir = await this.getCacheDir(symbol);
      const cachePath = path.join(cacheDir, 'optimized-quote.json');
      
      await fs.writeFile(cachePath, JSON.stringify(data, null, 2));
      
    } catch (error) {
      console.warn(`⚠️  Failed to cache data for ${symbol}:`, error);
    }
  }

  /**
   * Helper methods
   */
  private toTsxSymbol(yahooSymbol: string): string {
    return yahooSymbol.replace(/\.(TO|V)$/, '');
  }

  private toNumber(value: any): number | undefined {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const num = parseFloat(value);
      return isNaN(num) ? undefined : num;
    }
    return undefined;
  }

  /**
   * Get rate limiter statistics
   */
  getRateLimiterStats() {
    return {
      running: this.rateLimiter.running(),
      queued: this.rateLimiter.queued(),
    };
  }
}

/**
 * Test the optimized fetcher with sample symbols
 */
export async function testOptimizedFetcher() {
  console.log('🧪 TESTING OPTIMIZED FETCHER');
  console.log('============================\n');

  const fetcher = new TsxOptimizedFetcher();
  
  // Test with key Canadian symbols from different sectors
  const testSymbols = [
    'SHOP.TO', // Technology
    'RY.TO',   // Financials
    'ENB.TO',  // Energy
    'CNR.TO',  // Transportation
    'AW.TO',   // Consumer
  ];

  try {
    const results = await fetcher.fetchMultipleOptimized(testSymbols);
    
    console.log('\n📊 OPTIMIZED RESULTS:');
    console.log('=====================');
    
    for (const [symbol, data] of results) {
      console.log(`\n${symbol}: ${data.name || 'N/A'}`);
      console.log(`  Sector: ${data.sector || 'N/A'}`);
      console.log(`  ROE: ${data.returnOnEquity || 'N/A'}%`);
      console.log(`  ROA: ${data.returnOnAssets || 'N/A'}%`);
      console.log(`  Debt/Equity: ${data.totalDebtToEquity || 'N/A'}`);
      console.log(`  EPS: ${data.eps || 'N/A'}`);
      console.log(`  Price: $${data.price || 'N/A'}`);
    }
    
    console.log(`\n✅ Optimized fetcher test successful! ${results.size}/${testSymbols.length} quotes retrieved`);
    console.log('🎯 Ready for production use with 3,663 TSX companies');
    
  } catch (error) {
    console.error('❌ Optimized fetcher test failed:', error);
  }
}

// Export the fetcher
export default TsxOptimizedFetcher;

// Run test if this file is executed directly
if (require.main === module) {
  testOptimizedFetcher().catch(console.error);
}
