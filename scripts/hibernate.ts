import 'dotenv/config';
import db from '../src/helpers/mysql';
import networks from '@snapshot-labs/snapshot.js/src/networks.json';

async function main() {
  if (process.argv.length < 2) {
    console.error(`Usage: yarn ts-node scripts/hibernate.ts run|run-all|preview|preview-all`);
    return process.exit(1);
  }

  const [, , action] = process.argv;

  const mainAction = action.split('-')[0];

  const commands = {
    preview: `SELECT COUNT(id) as count from toHibernate`,
    run: `UPDATE spaces SET hibernated = 1 where id IN (id)`
  };

  if (!commands[mainAction]) {
    console.error(`First argument should be either "run", "rnu-all", "preview" or "preview-all"`);
    return process.exit(1);
  }

  const liveNetworks = Object.values(networks)
    .filter((network: any) => !network.testnet)
    .map((network: any) => network.key);

  const isRunAll = action.endsWith('-all');

  const query = `
    WITH toHibernate AS (
      WITH data AS (
        SELECT
        id,
        created,
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(settings, '$.network')), '') AS network,
        settings->>'$.validation.name' as validationName,
        settings->>'$.strategies[*].name' as strategiesName,
        settings->>'$.filters.minScore' as filtersMinScore,
        settings->>'$.filters.onlyMembers' as filtersOnlyMembers,
        settings->>'$.voteValidation.name' as voteValidation,
        (SELECT MAX(end) FROM proposals WHERE space = spaces.id LIMIT 1) AS lastProposalEndDate
        FROM spaces
        WHERE hibernated = 0
      )

      SELECT
        id, network, validationName, filtersMinScore, filtersOnlyMembers, strategiesName, voteValidation, lastProposalEndDate
        FROM data
        WHERE
        # Filtering out spaces that never had any activities, and are older than 6 months
        (
          # Older than 2 months
          created < (UNIX_TIMESTAMP() - 180 * 24 * 60 * 60)
          # Without activities
          AND lastProposalEndDate IS NULL
        )
        # Filtering out spaces that have not been active in the last 6 months
        OR (
          # Last activity older than 6 months
          lastProposalEndDate < (UNIX_TIMESTAMP() - 180 * 24 * 60 * 60)
        )
        ${
          isRunAll
            ? `# Filtering out misconfigured spaces
              OR (
                # Filtering only spaces without activities in the past 6 months
                lastProposalEndDate < (UNIX_TIMESTAMP() - 180 * 24 * 60 * 60)
                AND (
                  # Filtering out spaces using unknown networks
                  network NOT IN ( ? )
                  # Without proposal validation
                  OR ((validationName IS NULL OR validationName = 'any') AND !(filtersMinScore > 0 OR filtersOnlyMembers IS TRUE))
                  # With ticket strategy and without vote validation
                  OR (JSON_OVERLAPS(strategiesName, JSON_ARRAY('ticket')) && (voteValidation IS NULL OR voteValidation = 'any'))
                )
              )`
            : ''
        }
    )

    ${commands[mainAction]};
  `;

  const results = await db.queryAsync(query, liveNetworks);

  if (mainAction === 'preview') {
    console.log(`Spaces eligible for hibernation: ${results[0].count}`);
  } else {
    console.log(`${results.message}`);
  }
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
