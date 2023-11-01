import 'dotenv/config';
import db from '../src/helpers/mysql';

async function main() {
  if (process.argv.length < 2) {
    console.error(`Usage: yarn ts-node scripts/hibernate.ts run|preview`);
    return process.exit(1);
  }

  const [, , action] = process.argv;

  const commands = {
    preview: `SELECT COUNT(id) as count from toHibernate`,
    run: `UPDATE spaces SET hibernated = 1 where id IN (id)`
  };

  if (!commands[action]) {
    console.error(`First argument should be either "run" or "preview"`);
    return process.exit(1);
  }

  const query = `
    WITH toHibernate AS (
      WITH data AS (
        SELECT
        id,
        created_at,
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
        # Filtering out misconfigured spaces
        (
          # Filtering only spaces without activities in the past 2 months
          lastProposalEndDate < (UNIX_TIMESTAMP() - 60 * 60 * 24 * 60)
          AND (
            # Filtering out spaces using unknown networks
            network NOT IN ( '1','7','8','10','14','19','20','25','30','36','44','46','50','51','56','58','61','66','70','74','80','82','87','99','100','106','108','119','122','128','137','144','148','188','246','250','269','288','321','324','336','361','369','416','499','534','592','813','841','888','940','941','1001','1002','1088','1116','1234','1284','1285','1319','1559','1663','1701','1818','2000','2020','2109','2152','2400','2611','4689','5000','5551','5555','5851','7332','7341','7363','7700','8217','8453','9001','9052','10000','16718','29548','32659','42161','42170','42220','42262','43114','43288','47805','53935','60001','70001','70002','70103','71402','333999','666666','888888','900000','278611351','1313161554','1666600000','11297108109' )
            # Without proposal validation
            OR ((validationName IS NULL OR validationName = 'any') AND !(filtersMinScore > 0 OR filtersOnlyMembers IS TRUE))
            # With ticket strategy and without vote validation
            OR (JSON_OVERLAPS(strategiesName, JSON_ARRAY('ticket')) && (voteValidation IS NULL OR voteValidation = 'any'))
          )
        )
        # Filtering out spaces that never had any activities, and are older than 2 months
        OR (
          # Older than 2 months
          created_at < (UNIX_TIMESTAMP() - 60 * 60 * 24 * 60)
          # Without activities
          AND lastProposalEndDate IS NULL
        )
        # Filtering out spaces that have not been active in the last 6 months
        OR (
          # Last activity older than 6 months
          lastProposalEndDate < (UNIX_TIMESTAMP() - 150 * 60 * 24 * 60)
        )
    )

    ${commands[action]};
  `;

  const results = await db.queryAsync(query);

  if (action === 'preview') {
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
