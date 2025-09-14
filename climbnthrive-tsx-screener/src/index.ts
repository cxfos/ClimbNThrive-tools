#!/usr/bin/env node

import 'dotenv/config';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

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

  // TODO: Implement the main screening logic
  console.log('📊 Implementation coming soon...');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
}

export default main;
