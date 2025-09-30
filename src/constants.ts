export const CB = {
  INELIGIBLE: -1,
  SYNC_ERROR: -2, // Sync error from overlord
  PENDING_SYNC: -10, // waiting for value from overlord
  PENDING_COMPUTE: -15, // value from overlord set, waiting for local computation or refresh
  PENDING_CLOSE: -20, // value from overlord set, waiting for proposal close for final computation
  FINAL: 1
};
