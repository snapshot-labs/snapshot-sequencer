export const CB = {
  INELIGIBLE: -1,
  PENDING_SYNC: -10, // waiting for value from overlord
  PENDING_COMPUTE: -15, // value from overlord set, waiting for local computation or refresh
  PENDING_CLOSE: -20, // value from overlord set, waiting for proposal close for final computation
  CLOSED: 1
};
