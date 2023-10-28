import {
  loadModerationData,
  flaggedIps,
  flaggedAddresses,
  flaggedProposalTitleKeywords,
  flaggedProposalBodyKeywords
} from '../../../src/helpers/moderation';

describe('moderation', () => {
  describe('loadModerationData()', () => {
    describe('on success', () => {
      it('loads moderation data from sidekick', async () => {
        await loadModerationData();

        expect(flaggedIps).not.toHaveLength(0);
        expect(flaggedAddresses).not.toHaveLength(0);
        expect(flaggedProposalTitleKeywords).not.toHaveLength(0);
        expect(flaggedProposalBodyKeywords).not.toHaveLength(0);
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
  });
});
