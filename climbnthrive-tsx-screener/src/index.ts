#!/usr/bin/env node

import 'dotenv/config';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import * as path from 'path';
import { TsxOfficialClient, ProcessedTsxSymbol } from './sources/tsx-official';

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
    console.log('📋 Next: Data fetching and metrics computation (Step 2-4)');
    
  } catch (error) {
    console.error('❌ Error during ticker discovery:', error instanceof Error ? error.message : error);
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
