import fetch from 'node-fetch';
import proposalInput from '../fixtures/ingestor-payload/proposal.json';
import redis from '../../src/helpers/redis';
import spacesFixtures from '../fixtures/space';
import proposalsFixtures from '../fixtures/proposal';
import db from '../../src/helpers/mysql';

const HOST = `http://localhost:${process.env.PORT || 3003}`;
const SPACE_PREFIX = 'e2e-';

async function getFlaggedSpacesCount() {
  return (await db.queryAsync('SELECT COUNT(id) as count FROM spaces WHERE flagged = 1'))[0].count;
}

async function flagSpace(space: string, action = 'flag') {
  return await fetch(`${HOST}/flag`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', secret: '0' },
    body: JSON.stringify({ type: 'space', value: `${SPACE_PREFIX}${space}`, action })
  });
}

function successRequest() {
  return fetch(`${HOST}`);
}

function failRequest() {
  return fetch(HOST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(proposalInput)
  });
}

describe('POST /', () => {
  beforeEach(async () => {
    const keyPrefix = process.env.RATE_LIMIT_KEYS_PREFIX || 'snapshot-sequencer:';
    await redis.del(`${keyPrefix}rl:3e48ef9`);
    await redis.del(`${keyPrefix}rl-s:3e48ef9`);
  });

  afterAll(async () => {
    await redis.quit();
  });

  describe('on invalid client input', () => {
    it('returns a 400 error', async () => {
      const response = await failRequest();
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.error).toBe('client_error');
      expect(body.error_description).toBe('wrong timestamp');
    });
  });

  describe('rate limit', () => {
    describe('on a mix of success and failed requests', () => {
      it('should return a 429 errors only after 100 requests / min', async () => {
        for (let i = 1; i <= 100; i++) {
          // 2% of failing requests
          const response = await (Math.random() < 0.02 ? failRequest() : successRequest());
          expect(response.status).not.toEqual(429);
        }

        const response = await fetch(HOST, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(proposalInput)
        });
        expect(response.status).toBe(429);
      });
    });

    describe('on multiple failed requests', () => {
      it('should return a 429 errors after 15 requests / 15s', async () => {
        for (let i = 1; i <= 15; i++) {
          const response = await failRequest();
          expect(response.status).toBe(400);
        }

        const response = await fetch(`${HOST}/scores/proposal-id`);
        expect(response.status).toBe(429);
      });
    });
  });
});

describe('POST /flag', () => {
  afterAll(() => {
    db.endAsync();
  });

  beforeEach(async () => {
    await db.queryAsync(
      `
      DELETE FROM snapshot_sequencer_test.spaces WHERE id LIKE ?;
      TRUNCATE TABLE snapshot_sequencer_test.proposals
    `,
      [`${SPACE_PREFIX}%`]
    );

    await Promise.all(
      spacesFixtures
        .map(space => ({
          ...space,
          id: `${SPACE_PREFIX}${space.id}`,
          settings: JSON.stringify(space.settings)
        }))
        .map(async space => {
          db.queryAsync('INSERT INTO snapshot_sequencer_test.spaces SET ?', space);
        })
    );

    await Promise.all(
      proposalsFixtures
        .map(proposal => ({
          ...proposal,
          strategies: JSON.stringify(proposal.strategies),
          validation: JSON.stringify(proposal.validation),
          plugins: JSON.stringify(proposal.plugins),
          choices: JSON.stringify(proposal.choices),
          scores: JSON.stringify(proposal.scores),
          scores_by_strategy: JSON.stringify(proposal.scores_by_strategy)
        }))
        .map(async proposal => {
          db.queryAsync('INSERT INTO snapshot_sequencer_test.proposals SET ?', proposal);
        })
    );
  });

  it('returns a 401 error when not authorized', async () => {
    const response = await fetch(`${HOST}/flag`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    expect(response.status).toBe(401);
  });

  describe('when flagging a space', () => {
    it('does nothing when the space does not exist', async () => {
      const beforeFlaggedSpacesCount = await getFlaggedSpacesCount();
      const response = await flagSpace('test-not-exist.eth');
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(false);
      expect(await getFlaggedSpacesCount()).toBe(beforeFlaggedSpacesCount);
    });

    it('return true when the space is already flagged', async () => {
      await db.queryAsync('UPDATE spaces SET flagged = 1 WHERE id = ?', `${SPACE_PREFIX}test.eth`);

      const response = await flagSpace('test.eth');
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(await getFlaggedSpacesCount()).toBe(1);
    });

    it('flags the space when it exists', async () => {
      const response = await flagSpace('test.eth');
      const body = await response.json();

      expect(body).toEqual({ success: true });
      expect(
        (await db.queryAsync('SELECT id FROM spaces WHERE flagged = 1')).map(r => r.id)
      ).toEqual([`${SPACE_PREFIX}test.eth`]);
    });
  });

  describe('when un-flagging a space', () => {
    it('does nothing when the space does not exist', async () => {
      const beforeFlaggedSpacesCount = await getFlaggedSpacesCount();

      const response = await flagSpace('test-not-exist.eth', 'unflag');
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(false);
      expect(await getFlaggedSpacesCount()).toBe(beforeFlaggedSpacesCount);
    });

    it('returns true when the space is not flagged', async () => {
      const beforeFlaggedSpacesCount = await getFlaggedSpacesCount();
      const response = await flagSpace('test.eth', 'unflag');
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(await getFlaggedSpacesCount()).toBe(beforeFlaggedSpacesCount);
    });

    it('un-flags the space when it is flagged', async () => {
      await db.queryAsync('UPDATE spaces SET flagged = 1 WHERE id = ?', `${SPACE_PREFIX}test.eth`);

      const response = await flagSpace('test.eth', 'unflag');
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(await getFlaggedSpacesCount()).toBe(0);
    });
  });
});
