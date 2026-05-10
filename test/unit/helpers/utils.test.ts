import { capture } from '@snapshot-labs/snapshot-sentry';
import { captureError, captureException, isExpectedClientError } from '../../../src/helpers/utils';

jest.mock('@snapshot-labs/snapshot-sentry', () => ({
  capture: jest.fn()
}));

const mockedCapture = capture as jest.Mock;

describe('utils.ts', () => {
  describe('isExpectedClientError', () => {
    it.each([
      ['Error("unauthorized")', new Error('unauthorized')],
      ['plain string "unauthorized"', 'unauthorized']
    ])('returns true for %s', (_label, value) => {
      expect(isExpectedClientError(value)).toBe(true);
    });

    it.each([
      ['random Error', new Error('something went wrong')],
      ['unrelated string', 'failed'],
      ['undefined', undefined],
      ['null', null],
      ['number', 42]
    ])('returns false for %s', (_label, value) => {
      expect(isExpectedClientError(value)).toBe(false);
    });
  });

  describe('captureException', () => {
    beforeEach(() => mockedCapture.mockClear());

    it('skips capture for expected client errors', () => {
      captureException(new Error('unauthorized'));
      captureException('unauthorized');
      expect(mockedCapture).not.toHaveBeenCalled();
    });

    it('forwards unexpected errors to capture', () => {
      const err = new Error('boom');
      captureException(err, { ctx: 1 });
      expect(mockedCapture).toHaveBeenCalledWith(err, { ctx: 1 });
    });
  });

  describe('captureError', () => {
    beforeEach(() => mockedCapture.mockClear());

    it('skips capture when error code is in the ignored list', () => {
      captureError({ code: 504, message: 'gateway timeout' }, undefined, [504]);
      expect(mockedCapture).not.toHaveBeenCalled();
    });

    it('skips capture for expected client errors', () => {
      captureError(new Error('unauthorized'));
      expect(mockedCapture).not.toHaveBeenCalled();
    });

    it('forwards everything else to capture', () => {
      const err = new Error('boom');
      captureError(err, { ctx: 1 }, [504]);
      expect(mockedCapture).toHaveBeenCalledWith(err, { ctx: 1 });
    });
  });
});
