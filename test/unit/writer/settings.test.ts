import { verify } from '../../../src/writer/settings';
import { spacesGetSpaceFixtures } from '../../fixtures/space';
import input from '../../fixtures/writer-payload/space.json';
import SpaceSchema from '@snapshot-labs/snapshot.js/src/schemas/space.json';

function editedInput(payload = {}) {
  const result = { ...input, msg: JSON.parse(input.msg) };
  result.msg.payload = { ...result.msg.payload, ...payload };

  return { ...result, msg: JSON.stringify(result.msg) };
}

function randomStrategies(count = 1) {
  return Array(count)
    .fill(0)
    .map(() => ({
      name: `strategy-${Math.floor(Math.random() * 1000)}`
    }));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockGetSpace = jest.fn((_): any => {
  return spacesGetSpaceFixtures;
});
jest.mock('../../../src/helpers/actions', () => {
  const originalModule = jest.requireActual('../../../src/helpers/actions');

  return {
    __esModule: true,
    ...originalModule,
    getSpace: (id: string) => mockGetSpace(id)
  };
});

const mockGetSpaceController = jest.fn((): any => {
  return '0xF296178d553C8Ec21A2fBD2c5dDa8CA9ac905A00';
});
jest.mock('@snapshot-labs/snapshot.js', () => {
  const originalModule = jest.requireActual('@snapshot-labs/snapshot.js');

  return {
    ...originalModule,
    utils: {
      ...originalModule.utils,
      getSpaceController: () => mockGetSpaceController()
    }
  };
});

describe('writer/settings', () => {
  describe('verify()', () => {
    describe('on invalid input', () => {
      it.todo('rejects if the schema is invalid');
      it('rejects if the space was deleted', async () => {
        mockGetSpace.mockResolvedValueOnce({ ...spacesGetSpaceFixtures, deleted: true });
        return expect(verify(input)).rejects.toContain('space deleted');
      });

      it('rejects if the network does not exist', async () => {
        return expect(verify(editedInput({ network: '1919191919' }))).rejects.toContain(
          'network not allowed'
        );
      });

      it('rejects if using testnet on production', async () => {
        return expect(verify(editedInput({ network: '5' }))).rejects.toContain(
          'network not allowed'
        );
      });

      it('rejects if missing proposal validation', () => {
        return expect(verify(editedInput({ validation: { name: 'any' } }))).rejects.toContain(
          'space missing proposal validation'
        );
      });

      it('rejects if missing vote validation with ticket strategy', async () => {
        return expect(
          verify(editedInput({ validation: { name: 'any' }, strategies: [{ name: 'ticket' }] }))
        ).rejects.toContain('space with ticket requires voting validation');
      });
      it.todo('rejects if the submitter does not have permission');
      it.todo('rejects if the submitter does not have permission to change admin');
      const maxStrategiesWithSpaceType =
        SpaceSchema.definitions.Space.properties.strategies.maxItemsWithSpaceType;
      const maxStrategiesForNormalSpace = maxStrategiesWithSpaceType['default'];
      const maxStrategiesForTurboSpace = maxStrategiesWithSpaceType['turbo'];
      it(`rejects if passing more than ${maxStrategiesForNormalSpace} strategies for normal space`, async () => {
        return expect(
          verify(
            editedInput({
              strategies: randomStrategies(maxStrategiesForNormalSpace + 2)
            })
          )
        ).rejects.toContain('wrong space format');
      });

      it(`rejects if passing more than ${maxStrategiesForTurboSpace} strategies for turbo space`, async () => {
        mockGetSpace.mockResolvedValueOnce({ ...spacesGetSpaceFixtures, turbo: true });
        return expect(
          verify(
            editedInput({
              strategies: randomStrategies(maxStrategiesForTurboSpace + 2)
            })
          )
        ).rejects.toContain('wrong space format');
      });
    });

    describe('on valid data', () => {
      describe('with ticket strategy but with voting validation', () => {
        it('returns a Promise resolve', async () => {
          return expect(
            verify(
              editedInput({ strategies: [{ name: 'ticket' }], voteValidation: { name: 'basic' } })
            )
          ).resolves.toBe(undefined);
        });
      });

      describe('with not ANY validation', () => {
        it('returns a Promise resolve', async () => {
          return expect(verify(editedInput({ validation: { name: 'basic' } }))).resolves.toBe(
            undefined
          );
        });
      });

      describe('with ANY validation but with minScores filters', () => {
        it('returns a Promise resolve', async () => {
          return expect(
            verify(editedInput({ validation: { name: 'any' }, filters: { minScore: 1 } }))
          ).resolves.toBe(undefined);
        });
      });

      describe('with ANY validation but with onlyMembers filters', () => {
        it('returns a Promise resolve', async () => {
          return expect(
            verify(editedInput({ validation: { name: 'any' }, filters: { onlyMembers: true } }))
          ).resolves.toBe(undefined);
        });
      });

      describe('with correct number of strategies for normal spaces', () => {
        it('returns a Promise resolve', async () => {
          return expect(
            verify(
              editedInput({
                strategies: randomStrategies(8)
              })
            )
          ).resolves.toBe(undefined);
        });
      });

      describe('with correct number of strategies for turbo spaces', () => {
        it('returns a Promise resolve', async () => {
          mockGetSpace.mockResolvedValueOnce({ ...spacesGetSpaceFixtures, turbo: true });
          return expect(
            verify(
              editedInput({
                strategies: randomStrategies(10)
              })
            )
          ).resolves.toBe(undefined);
        });
      });
    });
  });

  describe('action()', () => {
    describe('when the space already exist', () => {
      it.todo('updates the space');
    });

    describe('when the space does not exist', () => {
      it.todo('creates the space');
    });
  });
});
