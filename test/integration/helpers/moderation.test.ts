import {
  loadModerationData,
  containsFlaggedLinks,
  setData,
  flaggedLinks,
  flaggedAddresses
} from '../../../src/helpers/moderation';

describe('moderation', () => {
  describe('loadModerationData()', () => {
    describe('on success', () => {
      it('loads moderation data from sidekick', async () => {
        const result = await loadModerationData();

        expect(result!.flaggedIps).not.toHaveLength(0);
        expect(result!.flaggedAddresses).not.toHaveLength(0);
        expect(result!.flaggedLinks).not.toHaveLength(0);
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
          await expect(loadModerationData(url)).resolves.toBe(undefined);
        },
        6e3
      );

      it('returns nothing on not-json response', async () => {
        await expect(loadModerationData('https://snapshot.org')).resolves.toBe(undefined);
      });
    });

    describe('containsFlaggedLinks()', () => {
      beforeAll(() => {
        setData({ flaggedLinks: ['https://a.com'] });
      });

      it('returns true if body contains flagged links', () => {
        expect(containsFlaggedLinks('this is a link https://a.com')).toBe(true);
      });

      it('returns false if body does not contain flagged links', () => {
        expect(containsFlaggedLinks('this is a link https://b.com')).toBe(false);
      });
    });

    describe('setData()', () => {
      it('removes invalid data from flaggedLink', () => {
        // @ts-ignore
        setData({ flaggedLinks: ['https://a.com', null, false, '', 0] });
        expect(flaggedLinks).toEqual(['https://a.com']);
      });

      it('lower cases the flaggedAddresses', () => {
        setData({ flaggedAddresses: ['0xAa'] });
        expect(flaggedAddresses).toEqual(['0xaa']);
      });
    });
  });
});
