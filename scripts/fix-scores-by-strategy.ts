import 'dotenv/config';
import db from '../src/helpers/mysql';

interface ProposalRow {
  id: string;
  type: string;
  scores_by_strategy: string;
}

interface FixCandidate {
  id: string;
  type: string;
  original: any;
  fixed: any;
}

async function main() {
  if (process.argv.length < 3) {
    console.error(`Usage: yarn ts-node scripts/fix-scores-by-strategy.ts preview|run`);
    return process.exit(1);
  }

  const [, , action] = process.argv;

  if (!['preview', 'run'].includes(action)) {
    console.error(`First argument should be either "preview" or "run"`);
    return process.exit(1);
  }

  const isDryRun = action === 'preview';

  // Find proposals with potentially buggy scores_by_strategy data
  const query = `
    SELECT id, type, scores_by_strategy
    FROM proposals
    WHERE JSON_DEPTH(scores_by_strategy) > 3
  `;

  console.log('Fetching proposals with weighted or quadratic voting...');
  const proposals: ProposalRow[] = await db.queryAsync(query);
  console.log(`Found ${proposals.length.toLocaleString()} proposals to check`);

  const fixCandidates: FixCandidate[] = [];

  // Check each proposal for buggy data
  for (const proposal of proposals) {
    try {
      const scoresByStrategy = JSON.parse(proposal.scores_by_strategy);

      // Check if this looks like buggy data: [[[0.75],[0]],[[0.999...]]] instead of [[0.75,0],[0.999...]]
      // The pattern is: each element is an array containing arrays (instead of numbers directly)
      const isBuggy =
        Array.isArray(scoresByStrategy) &&
        scoresByStrategy.length > 0 &&
        scoresByStrategy.every(
          item =>
            Array.isArray(item) && item.length > 0 && item.every(subItem => Array.isArray(subItem))
        );

      if (isBuggy) {
        // Fix the data by flattening: [[[0.75],[0]]] becomes [[0.75,0]]
        const fixed = scoresByStrategy.map(item => item.flat());

        fixCandidates.push({
          id: proposal.id,
          type: proposal.type,
          original: scoresByStrategy,
          fixed: fixed
        });
      }
    } catch (error) {
      console.warn(
        `Warning: Could not parse scores_by_strategy for proposal ${proposal.id}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  console.log(
    `\nFound ${fixCandidates.length.toLocaleString()} proposals with buggy scores_by_strategy data`
  );

  if (fixCandidates.length === 0) {
    console.log('No buggy data found. Nothing to fix.');
    return;
  }

  if (isDryRun) {
    // Display preview in a table format
    console.log('\n=== PREVIEW MODE - No changes will be made ===\n');
    console.log('Buggy proposals found:');
    console.log(
      `┌─${'─'.repeat(66)}─┬─${'─'.repeat(10)}─┬─${'─'.repeat(40)}─┬─${'─'.repeat(40)}─┐`
    );
    console.log(
      `│ Proposal ID${' '.repeat(55)} │ Type${' '.repeat(6)} │ Original (buggy)${' '.repeat(
        24
      )} │ Fixed${' '.repeat(35)} │`
    );
    console.log(
      `├─${'─'.repeat(66)}─┼─${'─'.repeat(10)}─┼─${'─'.repeat(40)}─┼─${'─'.repeat(40)}─┤`
    );

    for (const candidate of fixCandidates) {
      const originalStr = JSON.stringify(candidate.original).substring(0, 39);
      const fixedStr = JSON.stringify(candidate.fixed).substring(0, 39);

      console.log(
        `│ ${candidate.id.padEnd(66)} │ ${candidate.type.padEnd(10)} │ ${originalStr.padEnd(
          40
        )} │ ${fixedStr.padEnd(40)} │`
      );
    }
    console.log(
      `└─${'─'.repeat(66)}─┴─${'─'.repeat(10)}─┴─${'─'.repeat(40)}─┴─${'─'.repeat(40)}─┘`
    );

    console.log(`\nSummary:`);
    console.log(`- Total proposals checked: ${proposals.length.toLocaleString()}`);
    console.log(`- Buggy proposals found: ${fixCandidates.length.toLocaleString()}`);
    console.log(
      `- Weighted type: ${fixCandidates.filter(c => c.type === 'weighted').length.toLocaleString()}`
    );
    console.log(
      `- Quadratic type: ${fixCandidates
        .filter(c => c.type === 'quadratic')
        .length.toLocaleString()}`
    );
    console.log(`\nTo apply fixes, run: yarn ts-node scripts/fix-scores-by-strategy.ts run`);
  } else {
    // Apply the fixes
    console.log('\n=== APPLYING FIXES ===\n');

    let fixedCount = 0;
    for (const candidate of fixCandidates) {
      try {
        const updateQuery = `
          UPDATE proposals
          SET scores_by_strategy = ?
          WHERE id = ?
          LIMIT 1
        `;

        await db.queryAsync(updateQuery, [JSON.stringify(candidate.fixed), candidate.id]);

        console.log(`✓ Fixed proposal ${candidate.id}`);
        fixedCount++;
      } catch (error) {
        console.error(
          `✗ Failed to fix proposal ${candidate.id}:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    console.log(`\nFixing completed:`);
    console.log(
      `- Successfully fixed: ${fixedCount.toLocaleString()}/${fixCandidates.length.toLocaleString()} proposals`
    );

    if (fixedCount < fixCandidates.length) {
      console.log(
        `- Failed to fix: ${(fixCandidates.length - fixedCount).toLocaleString()} proposals`
      );
    }
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
