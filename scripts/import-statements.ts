import 'dotenv/config';
import run from '../src/lib/importer/statement';
import { ProviderType } from '../src/lib/importer/statement/provider';

// Usage: yarn ts-node scripts/import-statements.ts --providers tally,agora --spaces s:hop.eth
async function main() {
  let providers: ProviderType[] | undefined = undefined;
  let spaces: string[] | undefined = undefined;

  process.argv.forEach((arg, index) => {
    if (arg === '--providers') {
      if (!process.argv[index + 1]) throw new Error('Providers value is missing');
      providers = process.argv[index + 1].trim().split(',') as ProviderType[];
    }

    if (arg === '--spaces') {
      if (!process.argv[index + 1]) throw new Error('Spaces value is missing');
      spaces = process.argv[index + 1].trim().split(',');
    }
  });

  await run(providers, spaces);
  console.log('Done! ✅');
}

(async () => {
  try {
    await main();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
