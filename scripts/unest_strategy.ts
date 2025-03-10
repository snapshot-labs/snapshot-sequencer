import 'dotenv/config';
import db from '../src/helpers/mysql';

const STRATEGY_NAME = 'multichain';

// Usage: yarn ts-node scripts/unest_strategy.ts
async function main() {
  const spaces = await db.queryAsync(
    `SELECT settings->'$.strategies[*].name', id, settings
    FROM spaces
    WHERE JSON_CONTAINS(settings->'$.strategies[*].name', ?)
  `,
    JSON.stringify([STRATEGY_NAME])
  );

  console.log('Retrieved spaces count:', spaces.length);

  for (const space of spaces) {
    const strategies = JSON.parse(space.settings).strategies;
    let strategiesWithoutNesting = strategies.filter((s: any) => s.name !== STRATEGY_NAME);
    const nestedStrategies = strategies.filter((s: any) => s.name === STRATEGY_NAME);

    nestedStrategies.forEach((strategy: any) => {
      strategiesWithoutNesting = strategiesWithoutNesting.concat(strategy.params?.strategies ?? []);
    });

    await db.queryAsync(
      `UPDATE spaces SET settings = JSON_SET(settings, '$.strategies', ?) WHERE id = ?`,
      [JSON.stringify(strategiesWithoutNesting), space.id]
    );
  }

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
