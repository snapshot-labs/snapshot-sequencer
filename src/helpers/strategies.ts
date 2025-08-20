import { URL } from 'url';
import { capture } from '@snapshot-labs/snapshot-sentry';
import snapshot from '@snapshot-labs/snapshot.js';
import log from './log';

type Strategy = {
  id: string;
  override: boolean;
  disabled: boolean;
};

const RUN_INTERVAL = 60e3 * 5; // 5 minutes
const MAX_CONSECUTIVE_FAILS = 3;
const URI = new URL(
  '/api/strategies',
  process.env.SCORE_API_URL ?? 'https://score.snapshot.org'
).toString();

let consecutiveFailsCount = 0;
let shouldStop = false;
export let strategies: Record<Strategy['id'], Strategy> = {};

async function loadStrategies() {
  const res = await snapshot.utils.getJSON(URI);

  if (res.hasOwnProperty('error')) {
    capture(new Error('Failed to load strategies'), {
      contexts: { input: { uri: URI }, res }
    });
    return true;
  }

  const strat = Object.values(res).map((strategy: any) => {
    strategy.id = strategy.key;
    strategy.override = strategy.dependOnOtherAddress || false;
    strategy.disabled = strategy.disabled || false;
    return strategy;
  });

  strategies = Object.fromEntries(strat.map(strategy => [strategy.id, strategy]));
}

export async function initialize() {
  log.info('[strategies] Initial strategies load');
  await loadStrategies();
  log.info('[strategies] Initial strategies load complete');
}

export async function run() {
  while (!shouldStop) {
    try {
      log.info('[strategies] Start strategies refresh');
      await loadStrategies();
      consecutiveFailsCount = 0;
      log.info('[strategies] End strategies refresh');
    } catch (e: any) {
      consecutiveFailsCount++;

      if (consecutiveFailsCount >= MAX_CONSECUTIVE_FAILS) {
        capture(e);
      }
      log.error(`[strategies] failed to load ${JSON.stringify(e)}`);
    }

    // if stop() has been called after sleep started,
    // the loop will exit only after the sleep has completed
    await snapshot.utils.sleep(RUN_INTERVAL);
  }
}

export function stop() {
  log.info('[strategies] Stopping strategies refresh');
  shouldStop = true;
}
