const SHORT_BLOCK_PERIODS = 12;
const SHORT_SCALE = 1;
/** Track confirm delays up to 48 blocks for medium horizon */
const MED_BLOCK_PERIODS = 24;
const MED_SCALE = 2;
/** Track confirm delays up to 1008 blocks for long horizon */
const LONG_BLOCK_PERIODS = 42;
const LONG_SCALE = 24;
/** Historical estimates that are older than this aren't valid */
const OLDEST_ESTIMATE_HISTORY = 6 * 1008;
/** Decay of .962 is a half-life of 18 blocks or about 3 hours */
const SHORT_DECAY = 0.962;
/** Decay of .998 is a half-life of 144 blocks or about 1 day */
const MED_DECAY = 0.9952;
/** Decay of .9995 is a half-life of 1008 blocks or about 1 week */
const LONG_DECAY = 0.99931;
/** Require greater than 60% of X feerate transactions to be confirmed within Y/2 blocks */
const HALF_SUCCESS_PCT = 0.6;
/** Require greater than 85% of X feerate transactions to be confirmed within Y blocks */
const SUCCESS_PCT = 0.85;
/** Require greater than 95% of X feerate transactions to be confirmed within 2 * Y blocks */
const DOUBLE_SUCCESS_PCT = 0.95;
/** Require an avg of 0.1 tx in the combined feerate bucket per block to have stat significance */
const SUFFICIENT_FEETXS = 0.1;
/** Require an avg of 0.5 tx when using short decay since there are fewer blocks considered */
const SUFFICIENT_TXS_SHORT = 0.5;
const MIN_BUCKET_FEERATE = 1000;
const MAX_BUCKET_FEERATE = 1e7;
/** Spacing of FeeRate buckets
 * We have to lump transactions into buckets based on feerate, but we want to be able
 * to give accurate estimates over a large range of potential feerates
 * Therefore it makes sense to exponentially space the buckets
 */
const FEE_SPACING = 1.05;
const INF_FEERATE = 1e99;

const FeeReason = {
  HALF_ESTIMATE: 'Half Target 60% Threshold',
  FULL_ESTIMATE: 'Target 85% Threshold',
  DOUBLE_ESTIMATE: 'Double Target 95% Threshold',
  CONSERVATIVE: 'Conservative Double Target longer horizon',
  NONE: 'None',
};

module.exports = {
  SHORT_BLOCK_PERIODS,
  SHORT_SCALE,
  SHORT_DECAY,
  MED_BLOCK_PERIODS,
  MED_SCALE,
  MED_DECAY,
  LONG_BLOCK_PERIODS,
  LONG_SCALE,
  LONG_DECAY,
  HALF_SUCCESS_PCT,
  SUCCESS_PCT,
  DOUBLE_SUCCESS_PCT,
  SUFFICIENT_FEETXS,
  SUFFICIENT_TXS_SHORT,
  MIN_BUCKET_FEERATE,
  MAX_BUCKET_FEERATE,
  FEE_SPACING,
  INF_FEERATE,
  OLDEST_ESTIMATE_HISTORY,
  FeeReason,
};
