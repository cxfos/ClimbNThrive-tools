#!/usr/bin/env node

import 'dotenv/config';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as path from 'path';
import { TsxOfficialClient, ProcessedTsxSymbol } from './sources/tsx-official';
import { DataProcessor, ConsoleProgressReporter } from './data-processor';

interface CliArgs {
  includeTsx: boolean;
  includeTsxv: boolean;
  limit?: number;
  concurrency: number;
  out: string;
  csv: string;
}

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('include-tsx', {
      type: 'boolean',
      default: true,
      description: 'Include TSX companies',
    })
    .option('include-tsxv', {
      type: 'boolean',
      default: false,
      description: 'Include TSXV companies',
    })
    .option('limit', {
      type: 'number',
      description: 'Limit number of companies to process (for testing)',
    })
    .option('concurrency', {
      type: 'number',
      default: 5,
      description: 'Number of concurrent API requests',
    })
    .option('out', {
      type: 'string',
      default: 'out/tsx-fundamentals.xlsx',
      description: 'Output XLSX file path',
    })
    .option('csv', {
      type: 'string',
      default: 'out/tsx-fundamentals.csv',
      description: 'Output CSV file path',
    })
    .help()
    .parseAsync() as CliArgs;

  console.log('🚀 ClimbNThrive TSX Screener starting...');
  console.log('Configuration:', {
    includeTsx: argv.includeTsx,
    includeTsxv: argv.includeTsxv,
    limit: argv.limit || 'unlimited',
    concurrency: argv.concurrency,
    outputXlsx: argv.out,
    outputCsv: argv.csv,
  });

  // Validate environment (FMP key is optional now, we'll try Yahoo first)
  const fmpApiKey = process.env.FMP_API_KEY;
  const riskFreeRate = parseFloat(process.env.RISK_FREE_RATE || '0.02');
  console.log(`📊 Risk-free rate: ${(riskFreeRate * 100).toFixed(2)}%`);
  
  if (fmpApiKey) {
    const maskedKey = fmpApiKey.length > 8 
      ? `${fmpApiKey.substring(0, 4)}...${fmpApiKey.substring(fmpApiKey.length - 4)}`
      : '***';
    console.log(`🔑 FMP API key available: ${maskedKey} (length: ${fmpApiKey.length})`);
  } else {
    console.log('💡 No FMP API key found, will use Yahoo Finance for symbol discovery');
  }

  try {
    // Step 1: Fetch ticker symbols using Official TSX API
    console.log('\n📋 Step 1: Fetching ticker symbols via Official TSX API...');
    const tsxClient = new TsxOfficialClient();
    const cacheDir = path.join(process.cwd(), 'data', 'cache');
    
    const symbols = await tsxClient.getCanadianSymbols(
      argv.includeTsx,
      argv.includeTsxv,
      cacheDir
    );

    // Apply limit if specified
    const limitedSymbols = argv.limit ? symbols.slice(0, argv.limit) : symbols;

    console.log(`\n✅ Found ${limitedSymbols.length} companies to process`);
    
    // Show sample of first 10 symbols
    console.log('\n📊 Sample of companies:');
    console.log('┌─────────┬──────────────────────────────────────┬──────────┬─────────────────┬────────────────────┐');
    console.log('│ Ticker  │ Company Name                         │ Exchange │ Yahoo Symbol    │ Sector             │');
    console.log('├─────────┼──────────────────────────────────────┼──────────┼─────────────────┼────────────────────┤');
    
    limitedSymbols.slice(0, 10).forEach(symbol => {
      const ticker = symbol.symbol.padEnd(7);
      const name = (symbol.name.length > 36 ? symbol.name.substring(0, 33) + '...' : symbol.name).padEnd(36);
      const exchange = symbol.exchangeShortName.padEnd(8);
      const yahooSymbol = symbol.yahooSymbol.padEnd(15);
      const sector = (symbol.sector || 'N/A').padEnd(18);
      console.log(`│ ${ticker} │ ${name} │ ${exchange} │ ${yahooSymbol} │ ${sector} │`);
    });
    
    console.log('└─────────┴──────────────────────────────────────┴──────────┴─────────────────┴────────────────────┘');

    if (limitedSymbols.length > 10) {
      console.log(`\n... and ${limitedSymbols.length - 10} more companies`);
    }

    // Summary by exchange
    const tsxCount = limitedSymbols.filter(s => s.exchangeShortName === 'TSX').length;
    const tsxvCount = limitedSymbols.filter(s => s.exchangeShortName === 'TSXV').length;
    console.log(`\n📈 Exchange breakdown: TSX: ${tsxCount}, TSXV: ${tsxvCount}`);

    console.log('\n🎯 Ticker discovery completed successfully!');
    
    // Step 2: Data fetching and metrics computation
    console.log('\n📊 Step 2: Fetching fundamental data and computing metrics...');
    
    const processor = new DataProcessor({
      concurrency: argv.concurrency,
      riskFreeRate: riskFreeRate,
      progressCallback: (progress) => {
        // Simple progress reporting every few seconds
        const reporter = new ConsoleProgressReporter();
        reporter.report(progress);
      }
    });
    
    const processingResult = await processor.processSymbols(limitedSymbols);
    
    // Step 3: Display results summary
    console.log('\n📈 Step 3: Results Summary');
    console.log('==========================');
    
    console.log(`\n📊 Processing Summary:`);
    console.log(`  Total companies: ${processingResult.summary.total}`);
    console.log(`  Successful: ${processingResult.summary.successful} (${(processingResult.summary.successful/processingResult.summary.total*100).toFixed(1)}%)`);
    console.log(`  Failed: ${processingResult.summary.failed}`);
    console.log(`  Processing time: ${processingResult.summary.processingTime.toFixed(1)}s`);
    console.log(`  Average rate: ${(processingResult.summary.successful/processingResult.summary.processingTime).toFixed(2)} companies/sec`);
    
    console.log(`\n📈 Data Quality:`);
    console.log(`  Complete data: ${processingResult.summary.dataQuality.complete}`);
    console.log(`  Partial data: ${processingResult.summary.dataQuality.partial}`);
    console.log(`  Minimal data: ${processingResult.summary.dataQuality.minimal}`);
    
    // Show sample results
    if (processingResult.metrics.length > 0) {
      console.log('\n📋 Sample Results:');
      console.log('┌─────────┬──────────────────────────────────────┬─────────────┬─────────┬─────────┐');
      console.log('│ Ticker  │ Company Name                         │ Sector      │ ROE     │ ROIC    │');
      console.log('├─────────┼──────────────────────────────────────┼─────────────┼─────────┼─────────┤');
      
      processingResult.metrics.slice(0, 10).forEach(metric => {
        const ticker = metric.ticker.padEnd(7);
        const name = (metric.company.length > 36 ? metric.company.substring(0, 33) + '...' : metric.company).padEnd(36);
        const sector = ((metric.sector || 'N/A').length > 11 ? (metric.sector || 'N/A').substring(0, 8) + '...' : (metric.sector || 'N/A')).padEnd(11);
        const roe = (metric.roe ? `${metric.roe.toFixed(1)}%` : 'N/A').padEnd(7);
        const roic = (metric.roic ? `${metric.roic.toFixed(1)}%` : 'N/A').padEnd(7);
        console.log(`│ ${ticker} │ ${name} │ ${sector} │ ${roe} │ ${roic} │`);
      });
      
      console.log('└─────────┴──────────────────────────────────────┴─────────────┴─────────┴─────────┘');
      
      if (processingResult.metrics.length > 10) {
        console.log(`\n... and ${processingResult.metrics.length - 10} more companies with data`);
      }
    }
    
    console.log('\n🎉 Data processing completed successfully!');
    console.log('📋 Next: Export to XLSX/CSV (Step 4-5)');
    console.log('\n💡 Note: Full metrics computation (EPS CAGR, Sharpe ratio, etc.) requires additional data sources.');
    console.log('    Current implementation focuses on available TSX GraphQL data (ROE, ROIC, sector info).');
    
  } catch (error) {
    console.error('❌ Error during processing:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  });
}

export default main;
