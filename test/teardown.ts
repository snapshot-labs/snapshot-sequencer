import db, { sequencerDB } from '../src/helpers/mysql';

const teardown = async () => {
  await db.endAsync();
  await sequencerDB.endAsync();
};

export default teardown;
