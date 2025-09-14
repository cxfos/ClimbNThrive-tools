import Bottleneck from 'bottleneck';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

// Rate limiter for FMP API (more conservative than Yahoo)
const fmpLimiter = new Bottleneck({
  maxConcurrent: 3,
  minTime: 300, // 300ms between requests (200 requests/minute max)
});

// Zod schemas for FMP API validation
const FmpRatiosSchema = z.array(z.object({
  symbol: z.string(),
  date: z.string(),
  calendarYear: z.string(),
  period: z.string(),
  currentRatio: z.number().optional(),
  quickRatio: z.number().optional(),
  cashRatio: z.number().optional(),
  daysOfSalesOutstanding: z.number().optional(),
  daysOfInventoryOutstanding: z.number().optional(),
  operatingCycle: z.number().optional(),
  daysOfPayablesOutstanding: z.number().optional(),
  cashConversionCycle: z.number().optional(),
  grossProfitMargin: z.number().optional(),
  operatingProfitMargin: z.number().optional(),
  pretaxProfitMargin: z.number().optional(),
  netProfitMargin: z.number().optional(),
  effectiveTaxRate: z.number().optional(),
  returnOnAssets: z.number().optional(),
  returnOnEquity: z.number().optional(),
  returnOnCapitalEmployed: z.number().optional(),
  netIncomePerEBT: z.number().optional(),
  ebtPerEbit: z.number().optional(),
  ebitPerRevenue: z.number().optional(),
  debtRatio: z.number().optional(),
  debtEquityRatio: z.number().optional(),
  longTermDebtToCapitalization: z.number().optional(),
  totalDebtToCapitalization: z.number().optional(),
  interestCoverage: z.number().optional(),
  cashFlowToDebtRatio: z.number().optional(),
  companyEquityMultiplier: z.number().optional(),
  receivablesTurnover: z.number().optional(),
  payablesTurnover: z.number().optional(),
  inventoryTurnover: z.number().optional(),
  fixedAssetTurnover: z.number().optional(),
  assetTurnover: z.number().optional(),
  operatingCashFlowPerShare: z.number().optional(),
  freeCashFlowPerShare: z.number().optional(),
  cashPerShare: z.number().optional(),
  payoutRatio: z.number().optional(),
  operatingCashFlowSalesRatio: z.number().optional(),
  freeCashFlowOperatingCashFlowRatio: z.number().optional(),
  cashFlowCoverageRatios: z.number().optional(),
  shortTermCoverageRatios: z.number().optional(),
  capitalExpenditureCoverageRatio: z.number().optional(),
  dividendPaidAndCapexCoverageRatio: z.number().optional(),
  dividendPayoutRatio: z.number().optional(),
  priceBookValueRatio: z.number().optional(),
  priceToBookRatio: z.number().optional(),
  priceToSalesRatio: z.number().optional(),
  priceEarningsRatio: z.number().optional(),
  priceToFreeCashFlowsRatio: z.number().optional(),
  priceToOperatingCashFlowsRatio: z.number().optional(),
  priceCashFlowRatio: z.number().optional(),
  priceEarningsToGrowthRatio: z.number().optional(),
  priceSalesRatio: z.number().optional(),
  dividendYield: z.number().optional(),
  enterpriseValueMultiple: z.number().optional(),
  priceFairValue: z.number().optional(),
}).passthrough());

export interface FmpRatios {
  symbol: string;
  date: string;
  // Profitability
  grossProfitMargin?: number;
  operatingProfitMargin?: number;
  netProfitMargin?: number;
  returnOnAssets?: number;
  returnOnEquity?: number;
  returnOnCapitalEmployed?: number;
  // Valuation
  priceEarningsRatio?: number;
  priceToBookRatio?: number;
  priceToSalesRatio?: number;
  enterpriseValueMultiple?: number;
  dividendYield?: number;
  payoutRatio?: number;
  // Liquidity & Leverage
  currentRatio?: number;
  quickRatio?: number;
  debtEquityRatio?: number;
  debtRatio?: number;
  interestCoverage?: number;
  // Efficiency
  assetTurnover?: number;
  receivablesTurnover?: number;
  inventoryTurnover?: number;
  // Cash Flow
  operatingCashFlowPerShare?: number;
  freeCashFlowPerShare?: number;
  cashFlowToDebtRatio?: number;
}

/**
 * Cache helper for FMP data
 */
async function getFmpCacheDir(symbol: string): Promise<string> {
  const cacheDir = path.join('data', 'cache', symbol.replace(/[^a-zA-Z0-9.-]/g, '_'), 'fmp');
  await fs.mkdir(cacheDir, { recursive: true });
  return cacheDir;
}

async function loadFmpCache<T>(symbol: string, filename: string, maxAgeHours = 24): Promise<T | null> {
  try {
    const cacheDir = await getFmpCacheDir(symbol);
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

async function saveFmpCache<T>(symbol: string, filename: string, data: T): Promise<void> {
  try {
    const cacheDir = await getFmpCacheDir(symbol);
    const filePath = path.join(cacheDir, filename);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.warn(`Failed to cache FMP data for ${symbol}:`, error);
  }
}

/**
 * Convert TSX/TSXV symbols to FMP format (remove .TO/.V suffix)
 */
function toFmpSymbol(yahooSymbol: string): string {
  return yahooSymbol.replace(/\.(TO|V)$/, '');
}

/**
 * Fetch financial ratios from FMP API
 */
export async function getFmpRatios(yahooSymbol: string): Promise<FmpRatios | null> {
  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) {
    console.warn('⚠️  FMP_API_KEY not found, skipping FMP fallback');
    return null;
  }

  // Try cache first
  const cached = await loadFmpCache<FmpRatios>(yahooSymbol, 'ratios.json', 24);
  if (cached) {
    return cached;
  }

  const fmpSymbol = toFmpSymbol(yahooSymbol);

  return fmpLimiter.schedule(async () => {
    try {
      console.log(`🔢 Fetching FMP ratios for ${fmpSymbol}...`);
      
      const url = `https://financialmodelingprep.com/api/v3/ratios/${fmpSymbol}?apikey=${apiKey}&limit=1`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`FMP API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Validate with Zod
      const validated = FmpRatiosSchema.parse(data);
      
      if (validated.length === 0) {
        console.warn(`⚠️  No FMP ratios found for ${fmpSymbol}`);
        return null;
      }
      
      const ratios: FmpRatios = {
        symbol: yahooSymbol,
        date: validated[0].date,
        grossProfitMargin: validated[0].grossProfitMargin,
        operatingProfitMargin: validated[0].operatingProfitMargin,
        netProfitMargin: validated[0].netProfitMargin,
        returnOnAssets: validated[0].returnOnAssets,
        returnOnEquity: validated[0].returnOnEquity,
        returnOnCapitalEmployed: validated[0].returnOnCapitalEmployed,
        priceEarningsRatio: validated[0].priceEarningsRatio,
        priceToBookRatio: validated[0].priceToBookRatio,
        priceToSalesRatio: validated[0].priceToSalesRatio,
        enterpriseValueMultiple: validated[0].enterpriseValueMultiple,
        dividendYield: validated[0].dividendYield,
        payoutRatio: validated[0].payoutRatio,
        currentRatio: validated[0].currentRatio,
        quickRatio: validated[0].quickRatio,
        debtEquityRatio: validated[0].debtEquityRatio,
        debtRatio: validated[0].debtRatio,
        interestCoverage: validated[0].interestCoverage,
        assetTurnover: validated[0].assetTurnover,
        receivablesTurnover: validated[0].receivablesTurnover,
        inventoryTurnover: validated[0].inventoryTurnover,
        operatingCashFlowPerShare: validated[0].operatingCashFlowPerShare,
        freeCashFlowPerShare: validated[0].freeCashFlowPerShare,
        cashFlowToDebtRatio: validated[0].cashFlowToDebtRatio,
      };
      
      // Cache the result
      await saveFmpCache(yahooSymbol, 'ratios.json', ratios);
      
      return ratios;
      
    } catch (error) {
      console.error(`❌ Failed to fetch FMP ratios for ${fmpSymbol}:`, error);
      return null;
    }
  });
}

/**
 * Get comprehensive data with FMP fallback
 */
export async function getComprehensiveDataWithFallback(yahooSymbol: string) {
  // Import here to avoid circular dependency
  const { getComprehensiveData } = await import('./yahoo');
  
  const yahooData = await getComprehensiveData(yahooSymbol);
  const fmpRatios = await getFmpRatios(yahooSymbol);
  
  return {
    ...yahooData,
    fmpRatios,
  };
}

/**
 * Get FMP rate limiter stats
 */
export function getFmpRateLimiterStats() {
  return {
    running: fmpLimiter.running(),
    // pending and queued methods don't exist in this Bottleneck version
    pending: 0,
    queued: 0,
  };
}

/**
 * Wait for all FMP requests to complete
 */
export async function waitForFmpCompletion(): Promise<void> {
  await fmpLimiter.stop({ dropWaitingJobs: false });
}
