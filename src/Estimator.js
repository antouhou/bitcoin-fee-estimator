const TransactionStats = require('./TransactionStats');
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
  constructor(transactionsInMempool = []) {
    this.transactionsInMempool = transactionsInMempool;
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

  setTransactionsMempolData(transactionsInMempool) {
    this.transactionsInMempool = Object.assign({}, transactionsInMempool);
  }

  estimateSmartFee(confirmationTarget, feeCalculation, isConservative) {
    if (feeCalculation) {
      feeCalculation.desiredTarget = confirmationTarget;
      feeCalculation.returnedTarget = confirmationTarget;
    }

    let median;
    let tempResult; // todo add class EstimationResult

    // Return failure if trying to analyze a target we're not tracking
    if (confirmationTarget <= 0 || confirmationTarget > this.longStats.getMaxConfirms()) {
      return CFeeRate(0); // error condition
    }

    // It's not possible to get reasonable estimates for confTarget of 1
    if (confirmationTarget === 1) { confirmationTarget = 2; }

    const maxUsableEstimate = MaxUsableEstimate();
    if (confirmationTarget > maxUsableEstimate) {
      confirmationTarget = maxUsableEstimate;
    }
    if (feeCalculation) feeCalculation.returnedTarget = confirmationTarget;

    if (confirmationTarget <= 1) return CFeeRate(0); // error condition
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
    const halfEst = this.estimateCombinedFee(confirmationTarget / 2, HALF_SUCCESS_PCT, true, tempResult);
    if (feeCalculation) {
      feeCalculation.est = tempResult;
      feeCalculation.reason = FeeReason.HALF_ESTIMATE;
    }
    median = halfEst;
    const actualEst = this.estimateCombinedFee(confirmationTarget, SUCCESS_PCT, true, tempResult);
    if (actualEst > median) {
      median = actualEst;
      if (feeCalculation) {
        feeCalculation.est = tempResult;
        feeCalculation.reason = FeeReason.FULL_ESTIMATE;
      }
    }
    const doubleEst = this.estimateCombinedFee(2 * confirmationTarget, DOUBLE_SUCCESS_PCT, !isConservative, tempResult);
    if (doubleEst > median) {
      median = doubleEst;
      if (feeCalculation) {
        feeCalculation.est = tempResult;
        feeCalculation.reason = FeeReason.DOUBLE_ESTIMATE;
      }
    }

    if (isConservative || median === -1) {
      const consEst = estimateConservativeFee(2 * confirmationTarget, tempResult);
      if (consEst > median) {
        median = consEst;
        if (feeCalculation) {
          feeCalculation.est = tempResult;
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
  estimateCombinedFee(confTarget, successThreshold, checkShorterHorizon, result) {
    const { shortStats, feeStats, longStats } = this;
    let estimate = -1;
    if (confTarget >= 1 && confTarget <= longStats.getMaxConfirms()) {
      // Find estimate from shortest time horizon possible
      if (confTarget <= shortStats.getMaxConfirms()) { // short horizon
        estimate = shortStats.estimateMedianVal(confTarget, SUFFICIENT_TXS_SHORT, successThreshold, true, nBestSeenHeight, result);
      } else if (confTarget <= feeStats.getMaxConfirms()) { // medium horizon
        estimate = feeStats.estimateMedianVal(confTarget, SUFFICIENT_FEETXS, successThreshold, true, nBestSeenHeight, result);
      } else { // long horizon
        estimate = longStats.estimateMedianVal(confTarget, SUFFICIENT_FEETXS, successThreshold, true, nBestSeenHeight, result);
      }
      if (checkShorterHorizon) {
        let tempResult;
        // If a lower confTarget from a more recent horizon returns a lower answer use it.
        if (confTarget > feeStats.getMaxConfirms()) {
          const medMax = feeStats.estimateMedianVal(feeStats.getMaxConfirms(), SUFFICIENT_FEETXS, successThreshold, true, nBestSeenHeight, tempResult);
          if (medMax > 0 && (estimate === -1 || medMax < estimate)) {
            estimate = medMax;
            if (result) {
              result = tempResult;
            }
          }
        }
        if (confTarget > shortStats.getMaxConfirms()) {
          const shortMax = shortStats.estimateMedianVal(shortStats.getMaxConfirms(), SUFFICIENT_TXS_SHORT, successThreshold, true, nBestSeenHeight, tempResult);
          if (shortMax > 0 && (estimate === -1 || shortMax < estimate)) {
            estimate = shortMax;
            if (result) {
              result = tempResult;
            }
          }
        }
      }
    }
    return estimate;
  }
}

module.exports = Estimator;
