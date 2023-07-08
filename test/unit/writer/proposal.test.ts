describe('writer/proposal', () => {
  describe('verify()', () => {
    it.todo('rejects if the schema is invalid');
    it.todo('rejects if the basic vote choices are not valid');
    it.todo('rejects if the space ticket is missing validation');
    it.todo('rejects if the voting delay is invalid');
    it.todo('rejects if the voting period is invalid');
    it.todo('rejects if the voting type is invalid');
    it.todo('rejects if the submitter is flagged');
    it.todo('rejects if it fails <snapshot utils validation>');
    it.todo('rejects if the snapshot is in the future');
    it.todo('rejects if the space has exceeded the proposal post limit');
    it.todo('rejects if the space limit checker fails');

    describe('when only members can propose', () => {
      it.todo('rejects if the submitter is not a member');
    });
  });
});
