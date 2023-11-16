import input from '../../fixtures/writer-payload/space.json';

function editedInput(payload = {}) {
  const result = { ...input, msg: JSON.parse(input.msg) };
  result.msg.payload = { ...result.msg.payload, ...payload };

  return { ...result, msg: JSON.stringify(result.msg) };
}

const DEFAULT_SPACE: any = {
  id: 'fabien.eth',
  network: '5',
  voting: { aliased: false, type: 'single-choice' },
  strategies: [],
  members: [],
  admins: ['0xF296178d553C8Ec21A2fBD2c5dDa8CA9ac905A00'],
  moderators: [],
  validation: { name: 'basic' }
};

const mockGetSpace = jest.fn((id: any): any => {
  return { ...DEFAULT_SPACE, id };
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
        mockGetSpace.mockResolvedValueOnce({ ...DEFAULT_SPACE, deleted: true });
        return expect(verify(input)).rejects.toContain('space deleted');
      });

      it('rejects if the network does not exist', async () => {
        return expect(verify(editedInput({ network: '1919191919' }))).rejects.toContain(
          'invalid network'
        );
      });

      it('rejects if the network is on the wrong realm', async () => {
        return expect(verify(editedInput({ network: '5' }))).rejects.toContain('wrong network');
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
