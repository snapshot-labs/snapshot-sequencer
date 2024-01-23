import {
  loadModerationData,
  flaggedIps,
  flaggedAddresses,
  containsFlaggedLinks
} from '../../../src/helpers/moderation';

describe('moderation', () => {
  describe('loadModerationData()', () => {
    describe('on success', () => {
      it('loads moderation data from sidekick', async () => {
        await loadModerationData();

        expect(flaggedIps).not.toHaveLength(0);
        expect(flaggedAddresses).not.toHaveLength(0);
      });
    });

    describe('on error', () => {
      it.each([
        ['no response', 'http://localhost:9999'],
        ['empty url', ''],
        ['invalid hostname', 'test'],
        ['timeout', 'https://httpstat.us/200?sleep=10000']
      ])(
        'returns nothing on network error (%s)',
        async (title, url) => {
          await expect(loadModerationData(url)).resolves.toBe(false);
        },
        6e3
      );

      it('returns nothing on not-json response', async () => {
        await expect(loadModerationData('https://snapshot.org')).resolves.toBe(false);
      });
    });

    describe('containsFlaggedLinks()', () => {
      it('returns true if body contains flagged links', () => {
        expect(containsFlaggedLinks('this is a link https://a.com', ['https://a.com'])).toBe(true);
      });

      it('returns false if body does not contain flagged links', () => {
        expect(containsFlaggedLinks('this is a link https://b.com', ['https://a.com'])).toBe(false);
      });

      it('returns false if flagged links are empty', () => {
        expect(containsFlaggedLinks('this is a link https://a.com', [])).toBe(false);
      });

      it('returns false if flagged links contains empty values', () => {
        expect(containsFlaggedLinks('this is a link https://a.com', [''])).toBe(false);
      });
    });
  });
});
