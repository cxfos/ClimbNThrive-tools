import yahooFinance from 'yahoo-finance2';
import Bottleneck from 'bottleneck';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import { subYears } from 'date-fns';

// Rate limiter: 5 concurrent requests, minimum 200ms between requests
const limiter = new Bottleneck({
  maxConcurrent: 5,
  minTime: 200, // 200ms between requests (300 requests/minute max)
});

// Zod schemas for validation
const QuoteDataSchema = z.object({
  symbol: z.string(),
  regularMarketPrice: z.number().optional(),
  marketCap: z.number().optional(),
  beta: z.number().optional(),
  dividendYield: z.number().optional(),
  payoutRatio: z.number().optional(),
  trailingPE: z.number().optional(),
  priceToBook: z.number().optional(),
  enterpriseToEbitda: z.number().optional(),
  fiftyTwoWeekHigh: z.number().optional(),
  fiftyTwoWeekLow: z.number().optional(),
}).passthrough(); // Allow additional fields

const HistoricalDataSchema = z.array(z.object({
  date: z.date(),
  close: z.number(),
  adjClose: z.number().optional(),
}));

const FinancialDataSchema = z.object({
  incomeStatementHistory: z.array(z.object({
    endDate: z.date(),
    totalRevenue: z.number().optional(),
    grossProfit: z.number().optional(),
    operatingIncome: z.number().optional(),
    netIncome: z.number().optional(),
    dilutedEPS: z.number().optional(),
  })).optional(),
  balanceSheetHistory: z.array(z.object({
    endDate: z.date(),
    totalStockholderEquity: z.number().optional(),
    totalAssets: z.number().optional(),
    totalDebt: z.number().optional(),
  })).optional(),
  cashflowStatementHistory: z.array(z.object({
    endDate: z.date(),
    operatingCashflow: z.number().optional(),
    freeCashflow: z.number().optional(),
  })).optional(),
}).passthrough();

export interface QuoteData {
  symbol: string;
  price?: number;
  marketCap?: number;
  beta?: number;
  dividendYield?: number;
  payoutRatio?: number;
  trailingPE?: number;
  priceToBook?: number;
  enterpriseToEbitda?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  sector?: string;
  industry?: string;
}

export interface HistoricalPrice {
  date: Date;
  close: number;
  adjClose?: number;
}

export interface FinancialData {
  incomeStatements?: Array<{
    endDate: Date;
    totalRevenue?: number;
    grossProfit?: number;
    operatingIncome?: number;
    netIncome?: number;
    dilutedEPS?: number;
  }>;
  balanceSheets?: Array<{
    endDate: Date;
    totalStockholderEquity?: number;
    totalAssets?: number;
    totalDebt?: number;
  }>;
  cashflows?: Array<{
    endDate: Date;
    operatingCashflow?: number;
    freeCashflow?: number;
  }>;
}

/**
 * Cache helper functions
 */
async function getCacheDir(symbol: string): Promise<string> {
  const cacheDir = path.join('data', 'cache', symbol.replace(/[^a-zA-Z0-9.-]/g, '_'));
  await fs.mkdir(cacheDir, { recursive: true });
  return cacheDir;
}

async function loadFromCache<T>(symbol: string, filename: string, maxAgeHours = 24): Promise<T | null> {
  try {
    const cacheDir = await getCacheDir(symbol);
    const filePath = path.join(cacheDir, filename);
    const stat = await fs.stat(filePath);
    
    // Check if cache is still fresh
    const ageHours = (Date.now() - stat.mtime.getTime()) / (1000 * 60 * 60);
    if (ageHours > maxAgeHours) {
      return null;
    }
    
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data, (key, value) => {
      // Revive Date objects
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        return new Date(value);
      }
      return value;
    });
  } catch {
    return null;
  }
}

async function saveToCache<T>(symbol: string, filename: string, data: T): Promise<void> {
  try {
    const cacheDir = await getCacheDir(symbol);
    const filePath = path.join(cacheDir, filename);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.warn(`Failed to cache data for ${symbol}:`, error);
  }
}

/**
 * Fetches basic quote data including price, market cap, ratios, etc.
 */
export async function getQuote(yahooSymbol: string): Promise<QuoteData | null> {
  // Try cache first
  const cached = await loadFromCache<QuoteData>(yahooSymbol, 'quote.json', 4); // 4 hour cache
  if (cached) {
    return cached;
  }

  return limiter.schedule(async () => {
    try {
      console.log(`📊 Fetching quote for ${yahooSymbol}...`);
      
      const quote = await yahooFinance.quote(yahooSymbol);

      const quoteData: QuoteData = {
        symbol: yahooSymbol,
        price: quote.regularMarketPrice,
        marketCap: quote.marketCap,
        beta: quote.beta,
        dividendYield: undefined, // Not available in basic Yahoo Finance quote
        payoutRatio: undefined, // Not available in basic Yahoo Finance quote
        trailingPE: quote.trailingPE,
        priceToBook: quote.priceToBook,
        enterpriseToEbitda: undefined, // Not available in basic Yahoo Finance quote
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
        fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
        sector: undefined, // Yahoo Finance v2 doesn't provide sector in basic quote
        industry: undefined, // Yahoo Finance v2 doesn't provide industry in basic quote
      };

      // Validate and cache
      const validated = QuoteDataSchema.parse(quoteData);
      await saveToCache(yahooSymbol, 'quote.json', validated);
      
      return validated;
      
    } catch (error) {
      console.error(`❌ Failed to fetch quote for ${yahooSymbol}:`, error);
      return null;
    }
  });
}

/**
 * Fetches historical daily prices for Sharpe ratio calculation
 */
export async function getHistoricalDaily(yahooSymbol: string, lookbackYears = 3): Promise<HistoricalPrice[]> {
  // Try cache first
  const cacheKey = `historical_${lookbackYears}y.json`;
  const cached = await loadFromCache<HistoricalPrice[]>(yahooSymbol, cacheKey, 24); // 24 hour cache
  if (cached) {
    return cached;
  }

  return limiter.schedule(async () => {
    try {
      console.log(`📈 Fetching ${lookbackYears}y historical data for ${yahooSymbol}...`);
      
      const endDate = new Date();
      const startDate = subYears(endDate, lookbackYears);
      
      const historical = await yahooFinance.historical(yahooSymbol, {
        period1: startDate,
        period2: endDate,
        interval: '1d',
      });

      const prices: HistoricalPrice[] = historical.map(item => ({
        date: item.date,
        close: item.close,
        adjClose: item.adjClose,
      }));

      // Validate and cache
      const validated = HistoricalDataSchema.parse(prices);
      await saveToCache(yahooSymbol, cacheKey, validated);
      
      return validated;
      
    } catch (error) {
      console.error(`❌ Failed to fetch historical data for ${yahooSymbol}:`, error);
      return [];
    }
  });
}

/**
 * Fetches financial statements (income, balance sheet, cashflow)
 */
export async function getFinancials(yahooSymbol: string): Promise<FinancialData | null> {
  // Try cache first
  const cached = await loadFromCache<FinancialData>(yahooSymbol, 'financials.json', 24); // 24 hour cache
  if (cached) {
    return cached;
  }

  return limiter.schedule(async () => {
    try {
      console.log(`💰 Fetching financials for ${yahooSymbol}...`);
      
      // Yahoo Finance v2 doesn't provide financial statements via quote
      // We'll return null and rely on other sources for financial data
      console.log(`⚠️  Financial statements not available via Yahoo Finance v2 for ${yahooSymbol}`);
      return null;

      
    } catch (error) {
      console.error(`❌ Failed to fetch financials for ${yahooSymbol}:`, error);
      return null;
    }
  });
}

/**
 * Comprehensive data fetch for a single symbol
 */
export async function getComprehensiveData(yahooSymbol: string) {
  const [quote, historical, financials] = await Promise.all([
    getQuote(yahooSymbol),
    getHistoricalDaily(yahooSymbol),
    getFinancials(yahooSymbol),
  ]);

  return {
    quote,
    historical,
    financials,
  };
}

/**
 * Get current rate limiter statistics
 */
export function getRateLimiterStats() {
  return {
    running: limiter.running(),
    // pending and queued methods don't exist in this Bottleneck version
    pending: 0,
    queued: 0,
  };
}

/**
 * Wait for all pending requests to complete
 */
export async function waitForCompletion(): Promise<void> {
  await limiter.stop({ dropWaitingJobs: false });
}
