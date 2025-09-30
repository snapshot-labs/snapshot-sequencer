export const CB = {
  FINAL: 1,
  PENDING_SYNC: 0, // Default db value, waiting from value from overlord
  PENDING_COMPUTE: -1,
  PENDING_CLOSE: -2,
  INELIGIBLE: -10, // Payload format, can not compute
  ERROR_SYNC: -11 // Sync error from overlord, waiting for retry
};
