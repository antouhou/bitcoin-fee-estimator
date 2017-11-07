const EstimatorBucket = require('./EstimatorBucket');
const EstimationResult = require('./EstimationResult');

/**
 * We will instantiate an instance of this class to track transactions that were
 * included in a block. We will lump transactions into a bucket according to their
 * approximate feerate and then track how long it took for those txs to be included in a block
 *
 * The tracking of unconfirmed (mempool) transactions is completely independent of the
 * historical tracking of transactions that have been confirmed in a block.
 */
class TransactionStats {
  constructor(buckets, bucketMap, maxPeriods, decay, scale) {
    if (scale === 0) {
      throw new Error('scale must non-zero');
    }
    this.buckets = buckets;
    this.bucketMap = bucketMap;

    /**
     * For each bucket X:
     * Count the total # of txs in each bucket
     * Track the historical moving average of this total over blocks
     * @type {Array<number>}
     */
    this.averageTransactionConfirmTimes = [];
    /**
     * Count the total # of txs confirmed within Y blocks in each bucket
     * Track the historical moving average of theses totals over blocks
     * @type {Array<number>}
     */
    this.confirmationAverage = [];
    /**
     * Track moving avg of txs which have been evicted from the mempool
     * after failing to be confirmed within Y blocks
     * @type {Array<number>}
     */
    this.failAverage = [];
    /**
     * Sum the total feerate of all tx's in each bucket
     * Track the historical moving average of this total over blocks
     * @type {Array<number>}
     */
    this.average = [];

    this.decay = decay;
    this.scale = scale;

    /**
     * Mempool counts of outstanding transactions
     * For each bucket X, track the number of transactions in the mempool
     * that are unconfirmed for each possible confirmation value Y
     * @type {Array}
     */
    this.unconfirmedTransactions = [];
    /**
     * Transactions still unconfirmed after GetMaxConfirms for each bucket
     * @type {Array}
     */
    this.oldUnconfirmedTransactions = [];

    this.blockPeriods = maxPeriods;
  }

  /**
   * Returns the max number of confirms we're tracking
   * @returns {number}
   */
  getMaxConfirms() {
    return this.scale * this.confirmationAverage.length;
  }

  estimateMedianVal(confTarget, sufficientTxVal, successBreakPoint, requireGreater, nBlockHeight) {
    // TODO: big fat todo: is it really should be transaction from mempool or transactions out of mempool or both?
    const {
      unconfirmedTransactions,
      oldUnconfirmedTransactions,
      averageTransactionConfirmTimes,
      failAverage,
      average,
      confirmationAverage,
    } = this;

    // Counters for a bucket (or range of buckets)
    let nConf = 0; // Number of tx's confirmed within the confTarget
    let totalNum = 0; // Total number of tx's that were ever confirmed
    let extraNum = 0; // Number of tx's still in mempool for confTarget or longer
    // Number of tx's that were never confirmed but removed from the mempool after confTarget
    let failNum = 0;
    const periodTarget = ((confTarget + this.scale) - 1) / this.scale;

    const bucketsCount = this.buckets.length - 1;

    // requireGreater means we are looking for the lowest feerate such that all higher
    // values pass, so we start at maxbucketindex (highest feerate) and look at successively
    // smaller buckets until we reach failure.  Otherwise, we are looking for the highest
    // feerate such that all lower values fail, and we go in the opposite direction.
    const startBucket = requireGreater ? bucketsCount : 0;
    const step = requireGreater ? -1 : 1;

    // We'll combine buckets until we have enough samples.
    // The near and far variables will define the range we've combined
    // The best variables are the last range we saw which still had a high
    // enough confirmation rate to count as success.
    // The cur variables are the current range we're counting.
    let curNearBucket = startBucket;
    let bestNearBucket = startBucket;
    let curFarBucket = startBucket;
    let bestFarBucket = startBucket;

    let foundAnswer = false;
    const bins = unconfirmedTransactions.length;
    let newBucketRange = true;
    let passing = true;
    const passBucket = new EstimatorBucket();
    let failBucket = new EstimatorBucket();

    // Start counting from highest(default) or lowest feerate transactions
    for (let bucketIndex = startBucket; bucketIndex >= 0 && bucketIndex <= bucketsCount; bucketIndex += step) {
      if (newBucketRange) {
        curNearBucket = bucketIndex;
        newBucketRange = false;
      }
      curFarBucket = bucketIndex;
      nConf += confirmationAverage[periodTarget - 1][bucketIndex];
      totalNum += averageTransactionConfirmTimes[bucketIndex];
      failNum += failAverage[periodTarget - 1][bucketIndex];
      for (let confct = confTarget; confct < this.getMaxConfirms(); confct++) {
        extraNum += unconfirmedTransactions[(nBlockHeight - confct) % bins][bucketIndex];
      }
      extraNum += oldUnconfirmedTransactions[bucketIndex];
      // If we have enough transaction data points in this range of buckets,
      // we can test for success
      // (Only count the confirmed data points, so that each confirmation count
      // will be looking at the same amount of data and same bucket breaks)
      if (totalNum >= sufficientTxVal / (1 - this.decay)) {
        const curPct = nConf / (totalNum + failNum + extraNum);

        // Check to see if we are no longer getting confirmed at the success rate
        if ((requireGreater && curPct < successBreakPoint) || (!requireGreater && curPct > successBreakPoint)) {
          if (passing) {
            // First time we hit a failure record the failed bucket
            const failMinBucket = Math.min(curNearBucket, curFarBucket);
            const failMaxBucket = Math.max(curNearBucket, curFarBucket);
            failBucket.start = failMinBucket ? this.buckets[failMinBucket - 1] : 0;
            failBucket.end = this.buckets[failMaxBucket];
            failBucket.withinTarget = nConf;
            failBucket.totalConfirmed = totalNum;
            failBucket.inMempool = extraNum;
            failBucket.leftMempool = failNum;
            passing = false;
          }
          // Otherwise update the cumulative stats, and the bucket variables
          // and reset the counters
        } else {
          failBucket = new EstimatorBucket(); // Reset any failed bucket, currently passing
          foundAnswer = true;
          passing = true;
          passBucket.withinTarget = nConf;
          nConf = 0;
          passBucket.totalConfirmed = totalNum;
          totalNum = 0;
          passBucket.inMempool = extraNum;
          passBucket.leftMempool = failNum;
          failNum = 0;
          extraNum = 0;
          bestNearBucket = curNearBucket;
          bestFarBucket = curFarBucket;
          newBucketRange = true;
        }
      }
    }

    let median = -1;
    let txSum = 0;

    // Calculate the "average" feerate of the best bucket range that met success conditions
    // Find the bucket with the median transaction and then report the average feerate from that bucket
    // This is a compromise between finding the median which we can't since we don't save all tx's
    // and reporting the average which is less accurate
    const minBucket = Math.min(bestNearBucket, bestFarBucket);
    const maxBucket = Math.max(bestNearBucket, bestFarBucket);
    for (let j = minBucket; j <= maxBucket; j++) {
      txSum += averageTransactionConfirmTimes[j];
    }
    if (foundAnswer && txSum !== 0) {
      txSum /= 2;
      for (let j = minBucket; j <= maxBucket; j++) {
        if (averageTransactionConfirmTimes[j] < txSum) {
          txSum -= averageTransactionConfirmTimes[j];
        } else { // we're in the right bucket
          median = average[j] / averageTransactionConfirmTimes[j];
          break;
        }
      }

      passBucket.start = minBucket ? this.buckets[minBucket - 1] : 0;
      passBucket.end = this.buckets[maxBucket];
    }

    // If we were passing until we reached last few buckets with insufficient data, then report those as failed
    if (passing && !newBucketRange) {
      const failMinBucket = Math.min(curNearBucket, curFarBucket);
      const failMaxBucket = Math.max(curNearBucket, curFarBucket);
      failBucket.start = failMinBucket ? this.buckets[failMinBucket - 1] : 0;
      failBucket.end = this.buckets[failMaxBucket];
      failBucket.withinTarget = nConf;
      failBucket.totalConfirmed = totalNum;
      failBucket.inMempool = extraNum;
      failBucket.leftMempool = failNum;
    }

    // console.log(
    //   'FeeEst: %d %s%.0f%% decay %.5f: feerate: %g from (%g - %g) %.2f%% %.1f/(%.1f %d mem %.1f out) Fail: (%g - %g) %.2f%% %.1f/(%.1f %d mem %.1f out)\n',
    //   confTarget, requireGreater ? '>' : '<', 100.0 * successBreakPoint, this.decay,
    //   median, passBucket.start, passBucket.end,
    //   (100 * passBucket.withinTarget) / (passBucket.totalConfirmed + passBucket.inMempool + passBucket.leftMempool),
    //   passBucket.withinTarget, passBucket.totalConfirmed, passBucket.inMempool, passBucket.leftMempool,
    //   failBucket.start, failBucket.end,
    //   (100 * failBucket.withinTarget) / (failBucket.totalConfirmed + failBucket.inMempool + failBucket.leftMempool),
    //   failBucket.withinTarget, failBucket.totalConfirmed, failBucket.inMempool, failBucket.leftMempool,
    // );
    const result = new EstimationResult(passBucket, failBucket, this.decay, this.scale);

    return [
      median,
      result,
    ];
  }
}

module.exports = TransactionStats;
