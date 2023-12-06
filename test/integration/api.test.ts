describe('api', () => {
  describe('GET spaces/:key/poke', () => {
    it.todo(
      'returns an error when the domain does not have a snapshot TXT record ',
      async () => {}
    );
    it.todo('returns an error when the TXT record is not an url', async () => {});
    it.todo('returns an error when the content of the TXT record is a JSON file', async () => {});
    it.todo(
      'returns an error when the content of the TXT record is not a valid space schema',
      async () => {}
    );
    describe('when the space does not exist', () => {
      it.todo('creates a new space', async () => {});
    });
    describe('when the space exist', () => {
      it.todo('updates a new space', async () => {});
    });
  });
});
