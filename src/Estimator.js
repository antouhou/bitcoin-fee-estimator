const TransactionStats = require('./TransactionStats');
const EstimationResult = require('./EstimationResult');
const {
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
  FeeReason,
} = require('./constants');

class Estimator {
  constructor() {
    this.buckets = [];
    this.bucketMap = {};
    // : nBestSeenHeight(0), firstRecordedHeight(0), historicalFirst(0), historicalBest(0), trackedTxs(0), untrackedTxs(0)
    let bucketIndex = 0;
    for (let bucketBoundary = MIN_BUCKET_FEERATE; bucketBoundary <= MAX_BUCKET_FEERATE; bucketBoundary *= FEE_SPACING, bucketIndex++) {
      this.buckets.push(bucketBoundary);
      this.bucketMap[bucketBoundary] = bucketIndex;
    }
    this.buckets.push(INF_FEERATE);
    this.bucketMap[INF_FEERATE] = bucketIndex;

    this.feeStats = new TransactionStats(this.buckets, this.bucketMap, MED_BLOCK_PERIODS, MED_DECAY, MED_SCALE);
    this.shortStats = new TransactionStats(this.buckets, this.bucketMap, SHORT_BLOCK_PERIODS, SHORT_DECAY, SHORT_SCALE);
    this.longStats = new TransactionStats(this.buckets, this.bucketMap, LONG_BLOCK_PERIODS, LONG_DECAY, LONG_SCALE);
  }

  estimateSmartFee(confirmationTarget, feeCalc, isConservative) {
    let target = confirmationTarget;
    const feeCalculation = feeCalc;
    if (feeCalculation) {
      feeCalculation.desiredTarget = target;
      feeCalculation.returnedTarget = target;
    }

    let median;
    let halfEst = -1;
    let actualEst = -1;
    let doubleEst = -1;
    let estimationResult = new EstimationResult();

    // Return failure if trying to analyze a target we're not tracking
    if (target <= 0 || target > this.longStats.getMaxConfirms()) {
      return CFeeRate(0); // error condition
    }

    // It's not possible to get reasonable estimates for confTarget of 1
    if (target === 1) { target = 2; }

    const maxUsableEstimate = MaxUsableEstimate();
    if (target > maxUsableEstimate) {
      target = maxUsableEstimate;
    }
    if (feeCalculation) feeCalculation.returnedTarget = target;

    if (target <= 1) return CFeeRate(0); // error condition
    /** true is passed to estimateCombined fee for target/2 and target so
     * that we check the max confirms for shorter time horizons as well.
     * This is necessary to preserve monotonically increasing estimates.
     * For non-conservative estimates we do the same thing for 2*target, but
     * for conservative estimates we want to skip these shorter horizons
     * checks for 2*target because we are taking the max over all time
     * horizons so we already have monotonically increasing estimates and
     * the purpose of conservative estimates is not to let short term
     * fluctuations lower our estimates by too much.
     */
    [halfEst, estimationResult] = this.estimateCombinedFee(target / 2, HALF_SUCCESS_PCT, true, estimationResult);
    if (feeCalculation) {
      feeCalculation.est = estimationResult;
      feeCalculation.reason = FeeReason.HALF_ESTIMATE;
    }
    median = halfEst;
    [actualEst, estimationResult] = this.estimateCombinedFee(target, SUCCESS_PCT, true, estimationResult);
    if (actualEst > median) {
      median = actualEst;
      if (feeCalculation) {
        feeCalculation.est = estimationResult;
        feeCalculation.reason = FeeReason.FULL_ESTIMATE;
      }
    }
    [doubleEst, estimationResult] = this.estimateCombinedFee(2 * target, DOUBLE_SUCCESS_PCT, !isConservative, estimationResult);
    if (doubleEst > median) {
      median = doubleEst;
      if (feeCalculation) {
        feeCalculation.est = estimationResult;
        feeCalculation.reason = FeeReason.DOUBLE_ESTIMATE;
      }
    }

    if (isConservative || median === -1) {
      const consEst = estimateConservativeFee(2 * target, estimationResult);
      if (consEst > median) {
        median = consEst;
        if (feeCalculation) {
          feeCalculation.est = estimationResult;
          feeCalculation.reason = FeeReason.CONSERVATIVE;
        }
      }
    }

    if (median < 0) return CFeeRate(0); // error condition

    return CFeeRate(median);
  }

  /** Return a fee estimate at the required successThreshold from the shortest
   * time horizon which tracks confirmations up to the desired target.  If
   * checkShorterHorizon is requested, also allow short time horizon estimates
   * for a lower target to reduce the given answer */
  estimateCombinedFee(confirmationTarget, successThreshold, checkShorterHorizon) {
    const { shortStats, feeStats, longStats } = this;
    let estimate = -1;
    let result = new EstimationResult();

    if (confirmationTarget >= 1 && confirmationTarget <= longStats.getMaxConfirms()) {
      // Find estimate from shortest time horizon possible
      if (confirmationTarget <= shortStats.getMaxConfirms()) { // short horizon
        [estimate, result] = shortStats.estimateMedianVal(confirmationTarget, SUFFICIENT_TXS_SHORT, successThreshold, true, nBestSeenHeight);
      } else if (confirmationTarget <= feeStats.getMaxConfirms()) { // medium horizon
        [estimate, result] = feeStats.estimateMedianVal(confirmationTarget, SUFFICIENT_FEETXS, successThreshold, true, nBestSeenHeight);
      } else { // long horizon
        [estimate, result] = longStats.estimateMedianVal(confirmationTarget, SUFFICIENT_FEETXS, successThreshold, true, nBestSeenHeight);
      }

      if (checkShorterHorizon) {
        // If a lower confTarget from a more recent horizon returns a lower answer use it.
        if (confirmationTarget > feeStats.getMaxConfirms()) {
          const [medMax, tempResult] = feeStats.estimateMedianVal(feeStats.getMaxConfirms(), SUFFICIENT_FEETXS, successThreshold, true, nBestSeenHeight);
          if (medMax > 0 && (estimate === -1 || medMax < estimate)) {
            estimate = medMax;
            if (result) {
              result = tempResult;
            }
          }
        }
        if (confirmationTarget > shortStats.getMaxConfirms()) {
          const [shortMax, tempResult] = shortStats.estimateMedianVal(shortStats.getMaxConfirms(), SUFFICIENT_TXS_SHORT, successThreshold, true, nBestSeenHeight);
          if (shortMax > 0 && (estimate === -1 || shortMax < estimate)) {
            estimate = shortMax;
            if (result) {
              result = tempResult;
            }
          }
        }
      }
    }
    return [estimate, result];
  }
}

module.exports = Estimator;
