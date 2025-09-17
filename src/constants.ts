export const CB = {
  INELIGIBLE: -1,
  PENDING_SYNC: -10
};

export const CURRENT_CB = parseInt(process.env.LAST_CB ?? '1');
