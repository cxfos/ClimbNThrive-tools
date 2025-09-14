import Bottleneck from 'bottleneck';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

// Rate limiter for TSX GraphQL API (conservative approach)
const tsxLimiter = new Bottleneck({
  maxConcurrent: 3,
  minTime: 500, // 500ms between requests (120 requests/minute max)
});

// Zod schema for TSX GraphQL response validation
const TsxQuoteResponseSchema = z.object({
  data: z.object({
    getQuoteBySymbol: z.object({
      symbol: z.string(),
      name: z.string().nullable(),
      price: z.number().nullable(),
      priceChange: z.number().nullable(),
      percentChange: z.number().nullable(),
      exchangeName: z.string().nullable(),
      exShortName: z.string().nullable(),
      exchangeCode: z.string().nullable(),
      marketPlace: z.string().nullable(),
      sector: z.string().nullable(),
      industry: z.string().nullable(),
      volume: z.number().nullable(),
      openPrice: z.number().nullable(),
      dayHigh: z.number().nullable(),
      dayLow: z.number().nullable(),
      MarketCap: z.number().nullable(),
      MarketCapAllClasses: z.number().nullable(),
      peRatio: z.number().nullable(),
      prevClose: z.number().nullable(),
      dividendFrequency: z.string().nullable(),
      dividendYield: z.number().nullable(),
      dividendAmount: z.number().nullable(),
      dividendCurrency: z.string().nullable(),
      beta: z.number().nullable(),
      eps: z.number().nullable(),
      exDividendDate: z.string().nullable(),
      longDescription: z.string().nullable(),
      fulldescription: z.string().nullable(),
      website: z.string().nullable(),
      email: z.string().nullable(),
      phoneNumber: z.string().nullable(),
      fullAddress: z.string().nullable(),
      employees: z.union([z.number(), z.string()]).nullable(),
      shareOutStanding: z.number().nullable(),
      totalDebtToEquity: z.union([z.number(), z.string()]).nullable(),
      totalSharesOutStanding: z.number().nullable(),
      sharesESCROW: z.number().nullable(),
      vwap: z.number().nullable(),
      dividendPayDate: z.string().nullable(),
      weeks52high: z.number().nullable(),
      weeks52low: z.number().nullable(),
      alpha: z.number().nullable(),
      averageVolume10D: z.number().nullable(),
      averageVolume20D: z.number().nullable(),
      averageVolume30D: z.number().nullable(),
      averageVolume50D: z.number().nullable(),
      priceToBook: z.number().nullable(),
      priceToCashFlow: z.number().nullable(),
      returnOnEquity: z.union([z.number(), z.string()]).nullable(),
      returnOnAssets: z.union([z.number(), z.string()]).nullable(),
      day21MovingAvg: z.number().nullable(),
      day50MovingAvg: z.number().nullable(),
      day200MovingAvg: z.number().nullable(),
      dividend3Years: z.union([z.array(z.any()), z.string(), z.number()]).nullable(),
      dividend5Years: z.union([z.array(z.any()), z.string(), z.number()]).nullable(),
      datatype: z.string().nullable(),
      issueType: z.string().nullable(),
      secType: z.string().nullable(),
      close: z.number().nullable(),
      qmdescription: z.string().nullable(),
      __typename: z.string().optional(),
    }).nullable(),
  }),
  errors: z.array(z.any()).optional(),
});

export interface TsxQuoteData {
  symbol: string;
  name?: string;
  price?: number;
  priceChange?: number;
  percentChange?: number;
  exchangeName?: string;
  sector?: string;
  industry?: string;
  volume?: number;
  openPrice?: number;
  dayHigh?: number;
  dayLow?: number;
  marketCap?: number;
  marketCapAllClasses?: number;
  peRatio?: number;
  prevClose?: number;
  dividendFrequency?: string;
  dividendYield?: number;
  dividendAmount?: number;
  dividendCurrency?: string;
  beta?: number;
  eps?: number;
  exDividendDate?: string;
  longDescription?: string;
  website?: string;
  email?: string;
  phoneNumber?: string;
  fullAddress?: string;
  employees?: number | string;
  shareOutStanding?: number;
  totalDebtToEquity?: number;
  totalSharesOutStanding?: number;
  vwap?: number;
  dividendPayDate?: string;
  weeks52High?: number;
  weeks52Low?: number;
  alpha?: number;
  averageVolume10D?: number;
  averageVolume20D?: number;
  averageVolume30D?: number;
  averageVolume50D?: number;
  priceToBook?: number;
  priceToCashFlow?: number;
  returnOnEquity?: number;
  returnOnAssets?: number;
  day21MovingAvg?: number;
  day50MovingAvg?: number;
  day200MovingAvg?: number;
  dividend3Years?: any[] | string | number;
  dividend5Years?: any[] | string | number;
  datatype?: string;
  issueType?: string;
  secType?: string;
  close?: number;
  qmdescription?: string;
}

/**
 * Cache helpers for TSX GraphQL data
 */
async function getTsxCacheDir(symbol: string): Promise<string> {
  const cacheDir = path.join('data', 'cache', symbol.replace(/[^a-zA-Z0-9.-]/g, '_'), 'tsx');
  await fs.mkdir(cacheDir, { recursive: true });
  return cacheDir;
}

async function loadTsxCache<T>(symbol: string, filename: string, maxAgeHours = 4): Promise<T | null> {
  try {
    const cacheDir = await getTsxCacheDir(symbol);
    const filePath = path.join(cacheDir, filename);
    const stat = await fs.stat(filePath);
    
    const ageHours = (Date.now() - stat.mtime.getTime()) / (1000 * 60 * 60);
    if (ageHours > maxAgeHours) {
      return null;
    }
    
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function saveTsxCache<T>(symbol: string, filename: string, data: T): Promise<void> {
  try {
    const cacheDir = await getTsxCacheDir(symbol);
    const filePath = path.join(cacheDir, filename);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.warn(`Failed to cache TSX data for ${symbol}:`, error);
  }
}

/**
 * Convert Yahoo symbols (.TO/.V) to TSX format (remove suffix)
 */
function toTsxSymbol(yahooSymbol: string): string {
  return yahooSymbol.replace(/\.(TO|V)$/, '');
}

/**
 * GraphQL query for TSX quote data
 */
const GET_QUOTE_QUERY = `
query getQuoteBySymbol($symbol: String, $locale: String) {
  getQuoteBySymbol(symbol: $symbol, locale: $locale) {
    symbol
    name
    price
    priceChange
    percentChange
    exchangeName
    exShortName
    exchangeCode
    marketPlace
    sector
    industry
    volume
    openPrice
    dayHigh
    dayLow
    MarketCap
    MarketCapAllClasses
    peRatio
    prevClose
    dividendFrequency
    dividendYield
    dividendAmount
    dividendCurrency
    beta
    eps
    exDividendDate
    longDescription
    fulldescription
    website
    email
    phoneNumber
    fullAddress
    employees
    shareOutStanding
    totalDebtToEquity
    totalSharesOutStanding
    sharesESCROW
    vwap
    dividendPayDate
    weeks52high
    weeks52low
    alpha
    averageVolume10D
    averageVolume20D
    averageVolume30D
    averageVolume50D
    priceToBook
    priceToCashFlow
    returnOnEquity
    returnOnAssets
    day21MovingAvg
    day50MovingAvg
    day200MovingAvg
    dividend3Years
    dividend5Years
    datatype
    issueType
    secType
    close
    qmdescription
    __typename
  }
}`;

/**
 * Fetch comprehensive quote data from TSX GraphQL API
 */
export async function getTsxQuote(yahooSymbol: string): Promise<TsxQuoteData | null> {
  // Try cache first
  const cached = await loadTsxCache<TsxQuoteData>(yahooSymbol, 'quote.json', 4); // 4 hour cache
  if (cached) {
    return cached;
  }

  const tsxSymbol = toTsxSymbol(yahooSymbol);

  return tsxLimiter.schedule(async () => {
    try {
      console.log(`🏢 Fetching TSX GraphQL data for ${tsxSymbol} (from Yahoo symbol: ${yahooSymbol})...`);
      
      const response = await fetch('https://app-money.tmx.com/graphql', {
        method: 'POST',
        headers: {
          'accept': '*/*',
          'accept-language': 'en-US,en;q=0.9',
          'authorization': '',
          'content-type': 'application/json',
          'locale': 'en',
          'sec-ch-ua': '"Chromium";v="140", "Not=A?Brand";v="24"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-site',
          'x-session-id': '',
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
        },
        body: JSON.stringify({
          operationName: 'getQuoteBySymbol',
          variables: {
            symbol: tsxSymbol,
            locale: 'en'
          },
          query: GET_QUOTE_QUERY
        }),
      });

      if (!response.ok) {
        throw new Error(`TSX GraphQL API error: ${response.status} ${response.statusText}`);
      }

      const rawData = await response.json();
      
      // Validate with Zod
      const validatedData = TsxQuoteResponseSchema.parse(rawData);
      
      if (validatedData.errors && validatedData.errors.length > 0) {
        console.warn(`⚠️  TSX GraphQL errors for ${tsxSymbol}:`, validatedData.errors);
        return null;
      }

      if (!validatedData.data.getQuoteBySymbol) {
        console.warn(`⚠️  No TSX data found for ${tsxSymbol}`);
        console.warn(`📄 Raw response:`, JSON.stringify(rawData).substring(0, 500) + '...');
        return null;
      }

      const quote = validatedData.data.getQuoteBySymbol;
      
      // Helper function to convert string numbers to numbers
      const toNumber = (value: any): number | undefined => {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
          const num = parseFloat(value);
          return isNaN(num) ? undefined : num;
        }
        return undefined;
      };
      
      const tsxQuoteData: TsxQuoteData = {
        symbol: yahooSymbol, // Keep the Yahoo format for consistency
        name: quote.name || undefined,
        price: quote.price || undefined,
        priceChange: quote.priceChange || undefined,
        percentChange: quote.percentChange || undefined,
        exchangeName: quote.exchangeName || undefined,
        sector: quote.sector || undefined,
        industry: quote.industry || undefined,
        volume: quote.volume || undefined,
        openPrice: quote.openPrice || undefined,
        dayHigh: quote.dayHigh || undefined,
        dayLow: quote.dayLow || undefined,
        marketCap: quote.MarketCap || undefined,
        marketCapAllClasses: quote.MarketCapAllClasses || undefined,
        peRatio: quote.peRatio || undefined,
        prevClose: quote.prevClose || undefined,
        dividendFrequency: quote.dividendFrequency || undefined,
        dividendYield: quote.dividendYield || undefined,
        dividendAmount: quote.dividendAmount || undefined,
        dividendCurrency: quote.dividendCurrency || undefined,
        beta: quote.beta || undefined,
        eps: quote.eps || undefined,
        exDividendDate: quote.exDividendDate || undefined,
        longDescription: quote.longDescription || undefined,
        website: quote.website || undefined,
        email: quote.email || undefined,
        phoneNumber: quote.phoneNumber || undefined,
        fullAddress: quote.fullAddress || undefined,
        employees: quote.employees || undefined,
        shareOutStanding: quote.shareOutStanding || undefined,
        totalDebtToEquity: toNumber(quote.totalDebtToEquity),
        totalSharesOutStanding: quote.totalSharesOutStanding || undefined,
        vwap: quote.vwap || undefined,
        dividendPayDate: quote.dividendPayDate || undefined,
        weeks52High: quote.weeks52high || undefined,
        weeks52Low: quote.weeks52low || undefined,
        alpha: quote.alpha || undefined,
        averageVolume10D: quote.averageVolume10D || undefined,
        averageVolume20D: quote.averageVolume20D || undefined,
        averageVolume30D: quote.averageVolume30D || undefined,
        averageVolume50D: quote.averageVolume50D || undefined,
        priceToBook: quote.priceToBook || undefined,
        priceToCashFlow: quote.priceToCashFlow || undefined,
        returnOnEquity: toNumber(quote.returnOnEquity),
        returnOnAssets: toNumber(quote.returnOnAssets),
        day21MovingAvg: quote.day21MovingAvg || undefined,
        day50MovingAvg: quote.day50MovingAvg || undefined,
        day200MovingAvg: quote.day200MovingAvg || undefined,
        dividend3Years: quote.dividend3Years || undefined,
        dividend5Years: quote.dividend5Years || undefined,
        datatype: quote.datatype || undefined,
        issueType: quote.issueType || undefined,
        secType: quote.secType || undefined,
        close: quote.close || undefined,
        qmdescription: quote.qmdescription || undefined,
      };

      // Cache the result
      await saveTsxCache(yahooSymbol, 'quote.json', tsxQuoteData);
      
      return tsxQuoteData;
      
    } catch (error) {
      console.error(`❌ Failed to fetch TSX GraphQL data for ${tsxSymbol}:`, error);
      return null;
    }
  });
}

/**
 * Get comprehensive data with TSX GraphQL as primary source
 */
export async function getComprehensiveDataWithTsx(yahooSymbol: string) {
  // Try TSX GraphQL first (most comprehensive)
  const tsxData = await getTsxQuote(yahooSymbol);
  
  // If TSX doesn't have the data, fall back to Yahoo + FMP
  if (!tsxData) {
    const { getComprehensiveDataWithFallback } = await import('./fmp-ratios');
    return await getComprehensiveDataWithFallback(yahooSymbol);
  }
  
  // For historical data, we still need Yahoo (TSX GraphQL doesn't provide historical)
  const { getHistoricalDaily } = await import('./yahoo');
  const historical = await getHistoricalDaily(yahooSymbol, 3);
  
  return {
    tsxQuote: tsxData,
    historical,
    // TSX GraphQL provides most of what we need, so we might not need Yahoo quote or FMP
  };
}

/**
 * Get TSX rate limiter stats
 */
export function getTsxRateLimiterStats() {
  return {
    running: tsxLimiter.running(),
    // pending and queued methods don't exist in this Bottleneck version
    pending: 0,
    queued: 0,
  };
}

/**
 * Wait for all TSX requests to complete
 */
export async function waitForTsxCompletion(): Promise<void> {
  await tsxLimiter.stop({ dropWaitingJobs: false });
}
