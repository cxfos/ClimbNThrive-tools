/**
 * Main Data Processor
 * Integrates ticker discovery, data fetching, and metrics computation
 */

import { ProcessedTsxSymbol } from './sources/tsx-official';
import { TsxOptimizedFetcher, OptimizedQuoteData } from './sources/tsx-optimized';
import { FinancialMetrics, assessDataQuality, safeNumber } from './metrics/financial-metrics';

export interface ProcessingConfig {
  concurrency: number;
  riskFreeRate: number;
  progressCallback?: (progress: ProcessingProgress) => void;
}

export interface ProcessingProgress {
  completed: number;
  total: number;
  failed: number;
  currentSymbol?: string;
  eta?: number;
}

export interface ProcessingResult {
  metrics: FinancialMetrics[];
  summary: {
    total: number;
    successful: number;
    failed: number;
    dataQuality: {
      complete: number;
      partial: number;
      minimal: number;
    };
    processingTime: number;
  };
}

/**
 * Main data processor class
 */
export class DataProcessor {
  private tsxFetcher: TsxOptimizedFetcher;
  private config: ProcessingConfig;

  constructor(config: ProcessingConfig) {
    this.config = config;
    this.tsxFetcher = new TsxOptimizedFetcher();
  }

  /**
   * Process all symbols and compute financial metrics
   */
  async processSymbols(symbols: ProcessedTsxSymbol[]): Promise<ProcessingResult> {
    console.log(`🔄 Processing ${symbols.length} companies...`);
    console.log(`⚙️  Configuration: ${this.config.concurrency} concurrent, risk-free rate: ${(this.config.riskFreeRate * 100).toFixed(2)}%`);
    
    const startTime = Date.now();
    const results: FinancialMetrics[] = [];
    let successful = 0;
    let failed = 0;
    
    // Process symbols in batches to respect concurrency limits
    const batchSize = this.config.concurrency;
    const batches = this.createBatches(symbols, batchSize);
    
    console.log(`📊 Processing in ${batches.length} batches of ${batchSize} companies each`);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const batchStartTime = Date.now();
      
      // Process batch concurrently
      const batchPromises = batch.map(async (symbol, symbolIndex) => {
        const overallIndex = batchIndex * batchSize + symbolIndex;
        
        try {
          // Update progress
          if (this.config.progressCallback) {
            const eta = this.calculateETA(startTime, overallIndex, symbols.length);
            this.config.progressCallback({
              completed: overallIndex,
              total: symbols.length,
              failed,
              currentSymbol: symbol.symbol,
              eta
            });
          }
          
          // Fetch data from TSX GraphQL
          const quoteData = await this.tsxFetcher.fetchOptimizedQuote(symbol.yahooSymbol);
          
          if (quoteData) {
            // Convert to financial metrics
            const metrics = this.convertToFinancialMetrics(symbol, quoteData);
            return { success: true, metrics };
          } else {
            console.warn(`⚠️  No data available for ${symbol.symbol}`);
            return { success: false, symbol: symbol.symbol };
          }
          
        } catch (error) {
          console.error(`❌ Failed to process ${symbol.symbol}:`, error);
          return { success: false, symbol: symbol.symbol, error };
        }
      });
      
      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      
      // Process batch results
      for (const result of batchResults) {
        if (result.success && 'metrics' in result && result.metrics) {
          results.push(result.metrics);
          successful++;
        } else {
          failed++;
        }
      }
      
      // Progress logging
      const batchTime = (Date.now() - batchStartTime) / 1000;
      const overallProgress = ((batchIndex + 1) / batches.length * 100).toFixed(1);
      const eta = this.calculateETA(startTime, (batchIndex + 1) * batchSize, symbols.length);
      
      console.log(`  ✅ Batch ${batchIndex + 1}/${batches.length} complete (${overallProgress}%) - ${batch.length} companies in ${batchTime.toFixed(1)}s - ETA: ${eta}s`);
      console.log(`     Success: ${successful}, Failed: ${failed}, Rate: ${(successful / ((Date.now() - startTime) / 1000)).toFixed(2)}/sec`);
    }
    
    const processingTime = (Date.now() - startTime) / 1000;
    
    // Analyze data quality
    const dataQuality = {
      complete: results.filter(r => r.dataQuality === 'complete').length,
      partial: results.filter(r => r.dataQuality === 'partial').length,
      minimal: results.filter(r => r.dataQuality === 'minimal').length,
    };
    
    const summary = {
      total: symbols.length,
      successful,
      failed,
      dataQuality,
      processingTime
    };
    
    console.log('\n🎉 Data processing complete!');
    console.log(`📊 Results: ${successful}/${symbols.length} successful (${(successful/symbols.length*100).toFixed(1)}%)`);
    console.log(`⏱️  Total time: ${processingTime.toFixed(1)}s (${(successful/processingTime).toFixed(2)} companies/sec)`);
    console.log(`📈 Data quality: ${dataQuality.complete} complete, ${dataQuality.partial} partial, ${dataQuality.minimal} minimal`);
    
    return { metrics: results, summary };
  }

  /**
   * Convert TSX quote data to financial metrics
   */
  private convertToFinancialMetrics(
    symbol: ProcessedTsxSymbol, 
    quoteData: OptimizedQuoteData
  ): FinancialMetrics {
    // Basic company info
    const metrics: Partial<FinancialMetrics> = {
      ticker: symbol.symbol,
      company: quoteData.name || symbol.name,
      sector: quoteData.sector || symbol.sector || undefined,
      fetchedAt: new Date().toISOString(),
    };
    
    // Business metrics (available from TSX GraphQL)
    metrics.roe = safeNumber(quoteData.returnOnEquity) || undefined;
    
    // ROIC approximation: use ROA as proxy if no detailed balance sheet data
    // This is a simplified approach - ideally we'd calculate from detailed financials
    metrics.roic = safeNumber(quoteData.returnOnAssets) || undefined;
    
    // Note: The following metrics require additional data not available in our current TSX GraphQL query:
    // - yearsWithoutLoss: Needs historical EPS data
    // - epsCagr5Y: Needs 5 years of EPS history
    // - netDebtEbitdaRatio: Needs debt, cash, and EBITDA data
    // - netMargin: Needs revenue and net income data
    // - ebitMargin: Needs EBIT and revenue data  
    // - yearsSinceIPO: Needs IPO date data
    // - sharpeRatio3Y: Needs 3 years of daily price data
    
    // For now, we'll leave these as undefined and focus on available data
    // Future enhancement: integrate additional data sources for complete metrics
    
    // Assess data quality
    const completeMetrics: FinancialMetrics = {
      ticker: metrics.ticker!,
      company: metrics.company!,
      sector: metrics.sector,
      roe: metrics.roe,
      roic: metrics.roic,
      dataQuality: assessDataQuality(metrics),
      fetchedAt: metrics.fetchedAt!,
    };
    
    return completeMetrics;
  }

  /**
   * Create batches for concurrent processing
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Calculate estimated time remaining
   */
  private calculateETA(startTime: number, completed: number, total: number): number {
    if (completed === 0) return 0;
    
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = completed / elapsed;
    const remaining = total - completed;
    
    return Math.round(remaining / rate);
  }

  /**
   * Get rate limiter statistics
   */
  getRateLimiterStats() {
    return this.tsxFetcher.getRateLimiterStats();
  }
}

/**
 * Simple progress reporter for console output
 */
export class ConsoleProgressReporter {
  private lastUpdate = 0;
  private readonly updateInterval = 5000; // Update every 5 seconds
  
  report(progress: ProcessingProgress) {
    const now = Date.now();
    if (now - this.lastUpdate < this.updateInterval) return;
    
    const percentage = (progress.completed / progress.total * 100).toFixed(1);
    const eta = progress.eta ? `${progress.eta}s` : 'calculating...';
    
    console.log(`  📊 Progress: ${progress.completed}/${progress.total} (${percentage}%) - Current: ${progress.currentSymbol} - ETA: ${eta}`);
    
    this.lastUpdate = now;
  }
}
