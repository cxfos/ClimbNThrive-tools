/**
 * Financial Metrics Computation
 * Implements calculations for the target table structure based on reference image
 */

export interface FinancialMetrics {
  // Company info (from TSX GraphQL)
  ticker: string;
  company: string;
  sector?: string;
  
  // Profitability metrics
  yearsWithoutLoss?: number;        // Anos sem prejuízo
  epsCagr5Y?: number;              // CAGR do LPA em 5 anos
  netDebtEbitdaRatio?: number;     // Dívida Líquida/EBITDA
  
  // Business metrics  
  roe?: number;                    // ROE
  roic?: number;                   // ROIC
  netMargin?: number;              // Margem Líquida
  ebitMargin?: number;             // Margem EBIT
  
  // Valuation metrics
  yearsSinceIPO?: number;          // Anos desde o IPO
  sharpeRatio3Y?: number;          // Índice Sharpe
  
  // Metadata
  dataQuality: 'complete' | 'partial' | 'minimal';
  fetchedAt: string;
}

/**
 * Historical EPS data for CAGR calculations
 */
export interface EpsHistory {
  year: number;
  eps: number;
}

/**
 * Historical price data for Sharpe ratio calculations
 */
export interface PriceHistory {
  date: string;
  price: number;
}

/**
 * Compute EPS CAGR over 5 years
 * Formula: CAGR = (Ending Value / Beginning Value)^(1/years) - 1
 */
export function computeEpsCagr5Y(epsHistory: EpsHistory[]): number | null {
  if (epsHistory.length < 5) {
    return null; // Need at least 5 years of data
  }
  
  // Sort by year and get first and last values
  const sortedEps = epsHistory.sort((a, b) => a.year - b.year);
  const startEps = sortedEps[0].eps;
  const endEps = sortedEps[sortedEps.length - 1].eps;
  const years = sortedEps[sortedEps.length - 1].year - sortedEps[0].year;
  
  // Handle edge cases
  if (startEps <= 0 || endEps <= 0 || years === 0) {
    return null;
  }
  
  // Calculate CAGR
  const cagr = Math.pow(endEps / startEps, 1 / years) - 1;
  return Math.round(cagr * 10000) / 100; // Return as percentage with 2 decimal places
}

/**
 * Compute years without loss (consecutive profitable years)
 * Count consecutive years from most recent where EPS > 0
 */
export function computeYearsWithoutLoss(epsHistory: EpsHistory[]): number {
  if (epsHistory.length === 0) return 0;
  
  // Sort by year descending (most recent first)
  const sortedEps = epsHistory.sort((a, b) => b.year - a.year);
  
  let consecutiveYears = 0;
  for (const epsData of sortedEps) {
    if (epsData.eps > 0) {
      consecutiveYears++;
    } else {
      break; // Stop at first loss
    }
  }
  
  return consecutiveYears;
}

/**
 * Compute Net Debt/EBITDA ratio
 * Net Debt = Total Debt - Cash
 * This requires balance sheet data
 */
export function computeNetDebtEbitdaRatio(
  totalDebt: number,
  cash: number,
  ebitda: number
): number | null {
  if (ebitda <= 0) return null; // Avoid division by zero or negative EBITDA
  
  const netDebt = totalDebt - cash;
  return Math.round((netDebt / ebitda) * 100) / 100; // 2 decimal places
}

/**
 * Compute EBIT Margin
 * EBIT Margin = EBIT / Revenue
 */
export function computeEbitMargin(ebit: number, revenue: number): number | null {
  if (revenue <= 0) return null;
  
  const margin = (ebit / revenue) * 100;
  return Math.round(margin * 100) / 100; // 2 decimal places
}

/**
 * Compute Net Margin
 * Net Margin = Net Income / Revenue  
 */
export function computeNetMargin(netIncome: number, revenue: number): number | null {
  if (revenue <= 0) return null;
  
  const margin = (netIncome / revenue) * 100;
  return Math.round(margin * 100) / 100; // 2 decimal places
}

/**
 * Compute ROIC (Return on Invested Capital)
 * ROIC = NOPAT / Invested Capital
 * Simplified: ROIC ≈ EBIT * (1 - Tax Rate) / (Total Assets - Cash - Current Liabilities)
 */
export function computeROIC(
  ebit: number,
  taxRate: number,
  totalAssets: number,
  cash: number,
  currentLiabilities: number
): number | null {
  const investedCapital = totalAssets - cash - currentLiabilities;
  if (investedCapital <= 0) return null;
  
  const nopat = ebit * (1 - taxRate);
  const roic = (nopat / investedCapital) * 100;
  
  return Math.round(roic * 100) / 100; // 2 decimal places
}

/**
 * Compute Sharpe Ratio over 3 years
 * Sharpe Ratio = (Portfolio Return - Risk Free Rate) / Portfolio Standard Deviation
 */
export function computeSharpeRatio3Y(
  priceHistory: PriceHistory[],
  riskFreeRate: number = 0.02 // Default 2% annual
): number | null {
  if (priceHistory.length < 252 * 3) { // Need ~3 years of daily data
    return null;
  }
  
  // Sort by date
  const sortedPrices = priceHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // Calculate daily returns
  const dailyReturns: number[] = [];
  for (let i = 1; i < sortedPrices.length; i++) {
    const return_ = (sortedPrices[i].price - sortedPrices[i-1].price) / sortedPrices[i-1].price;
    dailyReturns.push(return_);
  }
  
  if (dailyReturns.length === 0) return null;
  
  // Calculate annualized return
  const totalReturn = sortedPrices[sortedPrices.length - 1].price / sortedPrices[0].price - 1;
  const years = (new Date(sortedPrices[sortedPrices.length - 1].date).getTime() - 
                 new Date(sortedPrices[0].date).getTime()) / (365 * 24 * 60 * 60 * 1000);
  const annualizedReturn = Math.pow(1 + totalReturn, 1 / years) - 1;
  
  // Calculate annualized volatility
  const avgDailyReturn = dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - avgDailyReturn, 2), 0) / dailyReturns.length;
  const dailyVolatility = Math.sqrt(variance);
  const annualizedVolatility = dailyVolatility * Math.sqrt(252); // 252 trading days per year
  
  // Calculate Sharpe ratio
  if (annualizedVolatility === 0) return null;
  const sharpeRatio = (annualizedReturn - riskFreeRate) / annualizedVolatility;
  
  return Math.round(sharpeRatio * 100) / 100; // 2 decimal places
}

/**
 * Compute years since IPO
 * Requires IPO date information
 */
export function computeYearsSinceIPO(ipoDate: string): number | null {
  try {
    const ipo = new Date(ipoDate);
    const now = new Date();
    const yearsDiff = (now.getTime() - ipo.getTime()) / (365 * 24 * 60 * 60 * 1000);
    
    return Math.floor(yearsDiff);
  } catch (error) {
    return null; // Invalid date
  }
}

/**
 * Assess data quality based on available metrics
 */
export function assessDataQuality(metrics: Partial<FinancialMetrics>): 'complete' | 'partial' | 'minimal' {
  const criticalFields = [
    metrics.roe,
    metrics.roic, 
    metrics.epsCagr5Y,
    metrics.yearsWithoutLoss,
    metrics.netMargin
  ];
  
  const availableFields = criticalFields.filter(field => field !== null && field !== undefined).length;
  
  if (availableFields >= 4) return 'complete';
  if (availableFields >= 2) return 'partial';
  return 'minimal';
}

/**
 * Helper function to safely convert values to numbers
 */
export function safeNumber(value: any): number | null {
  if (typeof value === 'number' && !isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}
