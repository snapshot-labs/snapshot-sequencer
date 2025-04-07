import snapshot from '@snapshot-labs/snapshot.js';
import fetch from 'node-fetch';
import db from './mysql';

const SCHNAPS_API_URL = process.env.SCHNAPS_API_URL;

const RUN_INTERVAL = 10 * 1e3; // 10 seconds

// Periodically sync the turbo status of spaces with the schnaps-api
export async function trackTurboStatuses() {
  if (!SCHNAPS_API_URL) return;

  while (true) {
    // Step 1: Query all the spaces from the schnaps-api
    const spaces = await getSpacesExpirationDates();

    // Step 2: Update the turbo status of the spaces in the database
    updateTurboStatuses(spaces);

    // Sleep for a while before running the loop again
    await snapshot.utils.sleep(RUN_INTERVAL);
  }
}

async function updateTurboStatuses(spaces: { id: string; turbo_expiration: number }[]) {
  if (spaces.length === 0) return;

  const now = Math.floor(Date.now() / 1000); // Current timestamp in seconds

  // Sync `turbo_expiration` and `turbo` status for each space
  const query = `
    UPDATE spaces
    SET
      turbo_expiration = CASE id
        ${spaces.map(() => `WHEN ? THEN ?`).join(' ')}
      END,
      turbo = CASE
        WHEN turbo_expiration < ? THEN 0
        ELSE 1
      END
    WHERE id IN (${spaces.map(() => '?').join(', ')});
  `;

  // Flatten `spaces` array: [id1, expiration1, id2, expiration2, ..., now, id1, id2, ...]
  const params = spaces.flatMap(({ id, turbo_expiration }) => [id, turbo_expiration]);

  // Add `now` for the `CASE` condition
  params.push(now);

  // Append `id`s again for the `WHERE IN (...)` clause
  params.push(...spaces.map(space => space.id));

  await db.query(query, params);
}

async function getSpacesExpirationDates() {
  const query = `
    query GetSpaces {
      spaces {
        id
        turbo_expiration
      }
    }
  `;

  try {
    const response = await fetch(SCHNAPS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    const data = await response.json();

    if (data.errors) {
      console.error('GraphQL Errors:', data.errors);
      return [];
    }

    return data.data.spaces;
  } catch (error) {
    console.error('Error fetching payments:', error);
    return [];
  }
}
