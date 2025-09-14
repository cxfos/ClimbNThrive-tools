import { z } from 'zod';

// Note: FMP endpoints for symbol discovery are deprecated as of 2024
// This file is kept for potential future use as a fallback for fundamental data
// when Yahoo Finance doesn't provide certain metrics

// Zod schemas for FMP fundamental data (for future fallback use)
const FmpRatiosSchema = z.object({
  symbol: z.string(),
  date: z.string(),
  period: z.string(),
  returnOnEquityTTM: z.number().nullable(),
  returnOnAssetsTTM: z.number().nullable(),
  returnOnCapitalEmployedTTM: z.number().nullable(),
  grossProfitMarginTTM: z.number().nullable(),
  operatingProfitMarginTTM: z.number().nullable(),
  netProfitMarginTTM: z.number().nullable(),
  debtToEquityRatio: z.number().nullable(),
  currentRatio: z.number().nullable(),
  quickRatio: z.number().nullable(),
  // Add more ratio fields as needed
}).passthrough();

export type FmpRatios = z.infer<typeof FmpRatiosSchema>;

/**
 * FMP client for fundamental data fallback (when Yahoo Finance lacks certain metrics)
 * Note: Most endpoints now require paid subscription
 */
export class FmpRatiosClient {
  private apiKey: string;
  private baseUrl = 'https://financialmodelingprep.com/api/v3';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('FMP_API_KEY is required');
    }
    this.apiKey = apiKey;
  }

  /**
   * Get financial ratios for a symbol (potential future fallback for Yahoo Finance)
   * Note: This endpoint may require paid subscription
   */
  async getRatios(symbol: string): Promise<FmpRatios | null> {
    const url = `${this.baseUrl}/ratios-ttm/${symbol}?apikey=${this.apiKey}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        console.warn(`⚠️  FMP ratios failed for ${symbol}: ${response.status}`);
        return null;
      }

      const data = await response.json() as unknown;
      
      // FMP returns an array, take the first item
      const dataArray = Array.isArray(data) ? data : [data];
      if (dataArray.length === 0) {
        return null;
      }
      
      const ratios = FmpRatiosSchema.parse(dataArray[0]);
      return ratios;
    } catch (error) {
      console.warn(`⚠️  FMP ratios error for ${symbol}:`, error);
      return null;
    }
  }

  // TODO: Add other potential fallback methods for fundamental data
  // - getIncomeStatement(symbol: string)
  // - getBalanceSheet(symbol: string)
  // - getKeyMetrics(symbol: string)
}
