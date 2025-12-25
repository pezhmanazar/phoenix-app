class StateError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'StateError';
    this.code = code;
  }
}

class ExecutorError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'ExecutorError';
    this.code = code;
  }
}

module.exports = {
  StateError,
  ExecutorError,
  StateErrorCodes: {
    NO_ACTIVE_STAGE: 'NO_ACTIVE_STAGE',
    INVALID_ACTIVE_DAY_COUNT: 'INVALID_ACTIVE_DAY_COUNT',
    DAY_STAGE_MISMATCH: 'DAY_STAGE_MISMATCH',
    STAGE_ORDER_VIOLATION: 'STAGE_ORDER_VIOLATION',
  },
  ExecutorErrorCodes: {
    TX_FAILED: 'TX_FAILED',
    POST_VALIDATE_FAILED: 'POST_VALIDATE_FAILED',
  },
};