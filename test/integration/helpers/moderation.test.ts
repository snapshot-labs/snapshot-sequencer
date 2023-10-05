import {
  loadModerationData,
  flaggedSpaces,
  flaggedIps,
  flaggedAddresses,
  flaggedProposalTitleKeywords,
  flaggedProposalBodyKeywords,
  verifiedSpaces
} from '../../../src/helpers/moderation';

describe('moderation', () => {
  describe('loadModerationData()', () => {
    describe('on success', () => {
      it('loads moderation data from sidekick', async () => {
        await loadModerationData();

        expect(flaggedSpaces).not.toHaveLength(0);
        expect(flaggedIps).not.toHaveLength(0);
        expect(flaggedAddresses).not.toHaveLength(0);
        expect(flaggedProposalTitleKeywords).not.toHaveLength(0);
        expect(flaggedProposalBodyKeywords).not.toHaveLength(0);
        expect(verifiedSpaces).not.toHaveLength(0);
      });
    });

    describe('on error', () => {
      it.each([
        ['no response', 'http://localhost:9999'],
        ['empty url', ''],
        ['invalid hostname', 'test'],
        ['timeout', 'https://httpstat.us/200?sleep=10000']
      ])('returns nothing on network error (%s)', (title, url) => {
        expect(loadModerationData(url)).resolves.toBeUndefined();
      });

      it('returns nothing on not-json response', () => {
        expect(loadModerationData('https://snapshot.org')).resolves.toBeUndefined();
      });
    });
  });
});
