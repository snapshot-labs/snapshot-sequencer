import poke from '../../../src/helpers/poke';

describe('poke', () => {
  it.todo('returns an error when the domain does not have a snapshot TXT record ');
  it.todo('returns an error when the TXT record is not an url');
  it.todo('returns an error when the content of the TXT record is a JSON file');
  it.todo('returns an error when the content of the TXT record is not a valid space schema');
  describe('when the space does not exist', () => {
    it.todo('creates a new space');
  });
  describe('when the space exist', () => {
    it.todo('updates a new space');
  });
});
