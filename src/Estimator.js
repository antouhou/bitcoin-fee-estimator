const TransactionStats = require('./TransactionStats');
const FeeRate = require('./FeeRate');
const { EstimationResult, MempoolTransaction, FeeCalculation } = require('./dataStructures');
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
  OLDEST_ESTIMATE_HISTORY,
  FeeReason,
} = require('./constants');

class Estimator {
  constructor(bestSeenHeight = 0, firstRecordedHeight = 0, historicalFirst = 0, historicalBest = 0, trackedTxs = 0, untrackedTxs = 0) {
    this.buckets = [];
    this.bucketMap = new Map();
    this.bestSeenHeight = bestSeenHeight;
    this.firstRecordedHeight = firstRecordedHeight;
    this.historicalFirst = historicalFirst;
    this.historicalBest = historicalBest;
    this.trackedTxs = trackedTxs;
    this.untrackedTxs = untrackedTxs;
    for (let bucketBoundary = MIN_BUCKET_FEERATE; bucketBoundary <= MAX_BUCKET_FEERATE; bucketBoundary *= FEE_SPACING) {
      const bucketIndex = this.buckets.push(bucketBoundary) - 1;
      this.bucketMap.set(bucketBoundary, bucketIndex);
    }
    const bucketIndex = this.buckets.push(INF_FEERATE) - 1;
    this.bucketMap.set(INF_FEERATE, bucketIndex);

    this.feeStats = new TransactionStats(this.buckets, this.bucketMap, MED_BLOCK_PERIODS, MED_DECAY, MED_SCALE);
    this.shortStats = new TransactionStats(this.buckets, this.bucketMap, SHORT_BLOCK_PERIODS, SHORT_DECAY, SHORT_SCALE);
    this.longStats = new TransactionStats(this.buckets, this.bucketMap, LONG_BLOCK_PERIODS, LONG_DECAY, LONG_SCALE);

    this.mempoolTransactions = new Map();
  }

  removeTx(hash, inBlock) {
    const transaction = this.mempoolTransactions.get(hash);
    const lastAddedTransactionHash = Array.from(this.mempoolTransactions.keys())[this.mempoolTransactions.size - 1];
    const isLastAdded = lastAddedTransactionHash === hash;
    // todo: Why should it give any sense?
    if (!isLastAdded) {
      this.feeStats.removeTx(transaction.blockHeight, this.bestSeenHeight, transaction.bucketIndex, inBlock);
      this.shortStats.removeTx(transaction.blockHeight, this.bestSeenHeight, transaction.bucketIndex, inBlock);
      this.longStats.removeTx(transaction.blockHeight, this.bestSeenHeight, transaction.bucketIndex, inBlock);
      this.mempoolTransactions.delete(hash);
      return true;
    }
    return false;
  }

  addTransactionsToMempool(rawMempoolTransactions) {
    const txids = Object.keys(rawMempoolTransactions);
    txids.forEach((hash) => {
      const transaction = rawMempoolTransactions[hash];
      transaction.hash = hash;
      // todo: remove true, add fee validation
      this.addTransactionToMempool(transaction, true);
    });
  }

  /**
   * Adds transaction to mempool.
   * Notice: It is important to process blocks before adding new mempool transactions
   * @param transaction mempoolTransactionEntry
   * @param isValidFeeEstimate
   */
  addTransactionToMempool(transaction, isValidFeeEstimate) {
    // todo: need to extract hash first
    const { hash, height } = transaction;
    if (this.mempoolTransactions.has(hash)) {
      return;
    }

    if (height !== this.bestSeenHeight) {
      // Ignore side chains and re-orgs; assuming they are random they don't
      // affect the estimate.  We'll potentially double count transactions in 1-block reorgs.
      // Ignore txs if Estimator is not in sync with chainActive.Tip().
      // It will be synced next time a block is processed.
      return;
    }

    // Only want to be updating estimates when our blockchain is synced,
    // otherwise we'll miscalculate how many blocks its taking to get included.
    if (!isValidFeeEstimate) {
      this.untrackedTxs++;
      return;
    }
    this.trackedTxs++;

    // Fee rates are stored and reported as BTC-per-kb:
    const feeRate = new FeeRate(transaction.fee, transaction.size);

    const bucketIndex = this.feeStats.addTx(height, feeRate.getFeePerK());
    this.shortStats.addTx(height, feeRate.getFeePerK());
    this.longStats.addTx(height, feeRate.getFeePerK());
    this.mempoolTransactions.set(hash, new MempoolTransaction(transaction, bucketIndex));
  }

  processBlockTx(blockHeight, entry) {
    if (!this.removeTx(entry.hash, true)) {
      // This transaction wasn't being tracked for fee estimation
      return false;
    }

    // How many blocks did it take for miners to include this transaction?
    // blocksToConfirm is 1-based, so a transaction included in the earliest
    // possible block has confirmation count of 1
    const blocksToConfirm = blockHeight - entry.height;
    if (blocksToConfirm <= 0) {
      // This can't happen because we don't process transactions from a block with a height
      // lower than our greatest seen height
      console.warn('Blockpolicy error Transaction had negative blocksToConfirm');
      return false;
    }

    // Fee rates are stored and reported as BTC-per-kb:
    const feeRate = new FeeRate(entry.fee, entry.size);

    this.feeStats.record(blocksToConfirm, feeRate.getFeePerK());
    this.shortStats.record(blocksToConfirm, feeRate.getFeePerK());
    this.longStats.record(blocksToConfirm, feeRate.getFeePerK());
    return true;
  }

  /**
   * @param blockHeight
   * @param txids - transactions included in block
   */
  processBlock(blockHeight, txids) {
    if (blockHeight <= this.bestSeenHeight) {
      // Ignore side chains and re-orgs; assuming they are random
      // they don't affect the estimate.
      // And if an attacker can re-org the chain at will, then
      // you've got much bigger problems than "attacker can influence
      // transaction fees."
      return;
    }

    // Must update bestSeenHeight in sync with ClearCurrent so that
    // calls to removeTx (via processBlockTx) correctly calculate age
    // of unconfirmed txs to remove from tracking.
    this.bestSeenHeight = blockHeight;

    // Update unconfirmed circular buffer
    this.feeStats.clearCurrent(blockHeight);
    this.shortStats.clearCurrent(blockHeight);
    this.longStats.clearCurrent(blockHeight);

    // Decay all exponential averages
    this.feeStats.updateMovingAverages();
    this.shortStats.updateMovingAverages();
    this.longStats.updateMovingAverages();

    let countedTxs = 0;
    // Update averages with data points from current block
    txids.forEach((txid) => {
      if (this.mempoolTransactions.has(txid)) {
        const transaction = this.mempoolTransactions.get(txid);
        if (this.processBlockTx(blockHeight, transaction)) { countedTxs++; }
      }
    });

    if (this.firstRecordedHeight === 0 && countedTxs > 0) {
      this.firstRecordedHeight = this.bestSeenHeight;
      // todo: Remove later
      console.info('First recorded height updated');
    }

    const message = `Blockpolicy estimates updated by ${countedTxs} of ${txids.length} block txs, 
      since last block ${this.trackedTxs} of ${this.trackedTxs + this.untrackedTxs} tracked, 
      mempool map size ${this.mempoolTransactions.size}, 
      max target ${this.maxUsableEstimate()} from ${this.historicalBlockSpan() > this.blockSpan() ? 'historical' : 'current'}`;
    // todo: remove
    console.info(message);

    this.trackedTxs = 0;
    this.untrackedTxs = 0;
  }

  blockSpan() {
    if (this.firstRecordedHeight === 0) return 0;
    if (this.bestSeenHeight < this.firstRecordedHeight) {
      throw new Error('First recorded height can not me bigger than last seen height');
    }
    return this.bestSeenHeight - this.firstRecordedHeight;
  }

  historicalBlockSpan() {
    if (this.historicalFirst === 0) { return 0; }
    if (this.historicalBest < this.historicalFirst) {
      throw new Error('First recorded historical height can not me bigger than last seen historical height');
    }

    if (this.bestSeenHeight - this.historicalBest > OLDEST_ESTIMATE_HISTORY) {
      return 0;
    }

    return this.historicalBest - this.historicalFirst;
  }

  maxUsableEstimate() {
    // Block spans are divided by 2 to make sure there are enough potential failing data points for the estimate
    return Math.min(this.longStats.getMaxConfirms(), Math.max(this.blockSpan(), this.historicalBlockSpan()) / 2);
  }

  estimateSmartFee(confirmationTarget, isConservative = false) {
    let target = confirmationTarget;
    const feeCalculation = new FeeCalculation();
    if (feeCalculation) {
      feeCalculation.desiredTarget = target;
      feeCalculation.returnedTarget = target;
    }

    let median;
    let halfEst = -1;
    let actualEst = -1;
    let doubleEst = -1;
    let consEst = -1;
    let estimationResult = new EstimationResult();

    // Return failure if trying to analyze a target we're not tracking
    if (target <= 0 || target > this.longStats.getMaxConfirms()) {
      return new FeeRate(0);
    }

    // It's not possible to get reasonable estimates for confTarget of 1
    if (target === 1) { target = 2; }

    const maxUsableEstimate = this.maxUsableEstimate();
    if (target > maxUsableEstimate) {
      target = maxUsableEstimate;
    }
    if (feeCalculation) feeCalculation.returnedTarget = target;

    if (target <= 1) return new FeeRate(0); // error condition
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
      [consEst, estimationResult] = this.estimateConservativeFee(2 * target);
      if (consEst > median) {
        median = consEst;
        if (feeCalculation) {
          feeCalculation.est = estimationResult;
          feeCalculation.reason = FeeReason.CONSERVATIVE;
        }
      }
    }

    if (median < 0) return new FeeRate(0); // error condition

    return new FeeRate(median);
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
        [estimate, result] = shortStats.estimateMedianVal(confirmationTarget, SUFFICIENT_TXS_SHORT, successThreshold, true, this.bestSeenHeight);
      } else if (confirmationTarget <= feeStats.getMaxConfirms()) { // medium horizon
        [estimate, result] = feeStats.estimateMedianVal(confirmationTarget, SUFFICIENT_FEETXS, successThreshold, true, this.bestSeenHeight);
      } else { // long horizon
        [estimate, result] = longStats.estimateMedianVal(confirmationTarget, SUFFICIENT_FEETXS, successThreshold, true, this.bestSeenHeight);
      }

      if (checkShorterHorizon) {
        // If a lower confTarget from a more recent horizon returns a lower answer use it.
        if (confirmationTarget > feeStats.getMaxConfirms()) {
          const [medMax, tempResult] = feeStats.estimateMedianVal(feeStats.getMaxConfirms(), SUFFICIENT_FEETXS, successThreshold, true, this.bestSeenHeight);
          if (medMax > 0 && (estimate === -1 || medMax < estimate)) {
            estimate = medMax;
            if (result) {
              result = tempResult;
            }
          }
        }
        if (confirmationTarget > shortStats.getMaxConfirms()) {
          const [shortMax, tempResult] = shortStats.estimateMedianVal(shortStats.getMaxConfirms(), SUFFICIENT_TXS_SHORT, successThreshold, true, this.bestSeenHeight);
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

  estimateConservativeFee(doubleTarget) {
    let estimate = -1;
    let longEstimate = -1;
    let result = new EstimationResult();
    let longResult = new EstimationResult();
    if (doubleTarget <= this.shortStats.getMaxConfirms()) {
      [estimate, result] = this.feeStats.estimateMedianVal(doubleTarget, SUFFICIENT_FEETXS, DOUBLE_SUCCESS_PCT, true, this.bestSeenHeight);
    }
    if (doubleTarget <= this.feeStats.getMaxConfirms()) {
      [longEstimate, longResult] = this.longStats.estimateMedianVal(doubleTarget, SUFFICIENT_FEETXS, DOUBLE_SUCCESS_PCT, true, this.bestSeenHeight);
      if (longEstimate > estimate) {
        estimate = longEstimate;
        result = longResult;
      }
    }
    return [estimate, result];
  }
}

module.exports = Estimator;
