import { z } from 'zod';
import { format } from 'date-fns';
import * as fs from 'fs/promises';
import * as path from 'path';

// Zod schema for TSX API response validation based on actual response format
const TsxInstrumentSchema = z.object({
  symbol: z.string(),
  name: z.string(),
});

const TsxCompanySchema = z.object({
  symbol: z.string(),
  name: z.string(),
  instruments: z.array(TsxInstrumentSchema),
});

const TsxApiResponseSchema = z.object({
  last_updated: z.number(),
  length: z.number(),
  results: z.array(TsxCompanySchema),
  isHttpError: z.boolean(),
});

export type TsxCompany = z.infer<typeof TsxCompanySchema>;

export interface ProcessedTsxSymbol {
  symbol: string;
  name: string;
  exchangeShortName: 'TSX' | 'TSXV';
  sector: string | null;
  industry: string | null;
  yahooSymbol: string;
}

export class TsxOfficialClient {
  private baseUrl = 'https://www.tsx.com/json/company-directory/search';

  /**
   * Fetch companies for a specific letter from TSX official API
   */
  async fetchCompaniesByLetter(exchange: 'tsx' | 'tsxv', letter: string): Promise<TsxCompany[]> {
    const url = `${this.baseUrl}/${exchange}/${letter.toUpperCase()}`;
    
    console.log(`🔍 Fetching ${exchange.toUpperCase()} companies starting with "${letter.toUpperCase()}"...`);
    
    try {
      const response = await fetch(url, {
        headers: {
          'accept': 'application/json, text/javascript, */*; q=0.01',
          'accept-language': 'en-US,en;q=0.9',
          'referer': 'https://www.tsx.com/en/listings/listing-with-us/listed-company-directory',
          'sec-ch-ua': '"Chromium";v="140", "Not=A?Brand";v="24"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
          'x-requested-with': 'XMLHttpRequest'
        }
      });

      if (!response.ok) {
        throw new Error(`TSX API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as unknown;
      
      // Validate response with Zod
      try {
        const apiResponse = TsxApiResponseSchema.parse(data);
        
        if (apiResponse.isHttpError) {
          throw new Error(`TSX API returned HTTP error for letter ${letter}`);
        }
        
        console.log(`✅ Found ${apiResponse.results.length} companies for letter "${letter.toUpperCase()}" (${apiResponse.length} total in response)`);
        return apiResponse.results;
      } catch (zodError) {
        console.warn(`⚠️  Response validation failed for ${letter}:`, zodError);
        console.warn(`📄 Raw response:`, JSON.stringify(data).substring(0, 500) + '...');
        // Return empty array if validation fails, but don't crash
        return [];
      }
    } catch (error) {
      console.error(`❌ Failed to fetch companies for letter "${letter}":`, error);
      throw error;
    }
  }

  /**
   * Fetch all companies from TSX by iterating through all letters
   */
  async fetchAllCompanies(exchange: 'tsx' | 'tsxv'): Promise<TsxCompany[]> {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const allCompanies: TsxCompany[] = [];

    console.log(`🔍 Fetching all ${exchange.toUpperCase()} companies from official API...`);

    for (const letter of letters) {
      try {
        const companies = await this.fetchCompaniesByLetter(exchange, letter);
        allCompanies.push(...companies);
        
        // Small delay to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.warn(`⚠️  Failed to fetch companies for letter "${letter}", continuing...`);
      }
    }

    console.log(`✅ Total ${exchange.toUpperCase()} companies fetched: ${allCompanies.length}`);
    return allCompanies;
  }

  /**
   * Convert TSX API response to our standard format
   */
  mapToProcessedSymbols(companies: TsxCompany[], exchange: 'TSX' | 'TSXV'): ProcessedTsxSymbol[] {
    const processedSymbols: ProcessedTsxSymbol[] = [];
    
    companies.forEach(company => {
      // Process each instrument for this company
      company.instruments.forEach(instrument => {
        // Map to Yahoo Finance format
        const suffix = exchange === 'TSX' ? '.TO' : '.V';
        const yahooSymbol = `${instrument.symbol}${suffix}`;

        processedSymbols.push({
          symbol: instrument.symbol,
          name: company.name, // Use the full company name from the parent
          exchangeShortName: exchange,
          sector: null, // TSX API doesn't seem to provide sector in this format
          industry: null, // TSX API doesn't seem to provide industry in this format
          yahooSymbol,
        });
      });
    });

    return processedSymbols;
  }

  /**
   * Cache symbols to disk
   */
  async cacheSymbols(symbols: ProcessedTsxSymbol[], cacheDir: string, exchange: string): Promise<string> {
    await fs.mkdir(cacheDir, { recursive: true });
    
    const today = format(new Date(), 'yyyyMMdd');
    const filename = `tsx-official-${exchange.toLowerCase()}-${today}.json`;
    const filepath = path.join(cacheDir, filename);

    const cacheData = {
      fetchDate: new Date().toISOString(),
      source: 'TSX Official API',
      exchange: exchange,
      count: symbols.length,
      symbols,
    };

    await fs.writeFile(filepath, JSON.stringify(cacheData, null, 2));
    console.log(`💾 Cached ${symbols.length} ${exchange} symbols to ${filepath}`);
    
    return filepath;
  }

  /**
   * Load symbols from cache if available and recent
   */
  async loadCachedSymbols(cacheDir: string, exchange: string, maxAgeHours = 24): Promise<ProcessedTsxSymbol[] | null> {
    try {
      const today = format(new Date(), 'yyyyMMdd');
      const filename = `tsx-official-${exchange.toLowerCase()}-${today}.json`;
      const filepath = path.join(cacheDir, filename);

      const data = await fs.readFile(filepath, 'utf-8');
      const cached = JSON.parse(data);

      const fetchDate = new Date(cached.fetchDate);
      const ageHours = (Date.now() - fetchDate.getTime()) / (1000 * 60 * 60);

      if (ageHours <= maxAgeHours) {
        console.log(`📥 Loaded ${cached.count} ${exchange} symbols from TSX cache (${ageHours.toFixed(1)}h old)`);
        return cached.symbols;
      } else {
        console.log(`⏰ TSX cache is ${ageHours.toFixed(1)}h old, will refresh`);
        return null;
      }
    } catch (error) {
      console.log(`📭 No valid TSX ${exchange} cache found, will fetch fresh data`);
      return null;
    }
  }

  /**
   * Main method to get Canadian symbols from official TSX API
   */
  async getCanadianSymbols(
    includeTsx: boolean,
    includeTsxv: boolean,
    cacheDir: string,
    useCache = true
  ): Promise<ProcessedTsxSymbol[]> {
    let allSymbols: ProcessedTsxSymbol[] = [];

    if (includeTsx) {
      // Try to load from cache first
      if (useCache) {
        const cached = await this.loadCachedSymbols(cacheDir, 'TSX');
        if (cached) {
          allSymbols.push(...cached);
        } else {
          // Fetch fresh TSX data
          const tsxCompanies = await this.fetchAllCompanies('tsx');
          const processedTsx = this.mapToProcessedSymbols(tsxCompanies, 'TSX');
          allSymbols.push(...processedTsx);
          
          // Cache the results
          await this.cacheSymbols(processedTsx, cacheDir, 'TSX');
        }
      } else {
        // Fetch fresh TSX data
        const tsxCompanies = await this.fetchAllCompanies('tsx');
        const processedTsx = this.mapToProcessedSymbols(tsxCompanies, 'TSX');
        allSymbols.push(...processedTsx);
        
        // Cache the results
        await this.cacheSymbols(processedTsx, cacheDir, 'TSX');
      }
    }

    if (includeTsxv) {
      // Try to load from cache first
      if (useCache) {
        const cached = await this.loadCachedSymbols(cacheDir, 'TSXV');
        if (cached) {
          allSymbols.push(...cached);
        } else {
          // Fetch fresh TSXV data
          const tsxvCompanies = await this.fetchAllCompanies('tsxv');
          const processedTsxv = this.mapToProcessedSymbols(tsxvCompanies, 'TSXV');
          allSymbols.push(...processedTsxv);
          
          // Cache the results
          await this.cacheSymbols(processedTsxv, cacheDir, 'TSXV');
        }
      } else {
        // Fetch fresh TSXV data
        const tsxvCompanies = await this.fetchAllCompanies('tsxv');
        const processedTsxv = this.mapToProcessedSymbols(tsxvCompanies, 'TSXV');
        allSymbols.push(...processedTsxv);
        
        // Cache the results
        await this.cacheSymbols(processedTsxv, cacheDir, 'TSXV');
      }
    }

    return allSymbols;
  }
}
