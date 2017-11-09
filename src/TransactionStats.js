const { EstimatorBucket, EstimationResult } = require('./dataStructures');
const { lowerBound, getTwoDimensionalArrayWithZeros } = require('./utils');
/**
 * We will instantiate an instance of this class to track transactions that were
 * included in a block. We will lump transactions into a bucket according to their
 * approximate feerate and then track how long it took for those txs to be included in a block
 *
 * The tracking of unconfirmed (mempool) transactions is completely independent of the
 * historical tracking of transactions that have been confirmed in a block.
 */
class TransactionStats {
  /**
   * @param {Array<number>} buckets
   * @param {number} maxPeriods
   * @param {number} decay
   * @param {number} scale
   */
  constructor(buckets, maxPeriods, decay, scale) {
    if (scale === 0) {
      throw new Error('scale must non-zero');
    }
    this.buckets = buckets;
    this.decay = decay;
    this.scale = scale;
    this.maxPeriods = maxPeriods;

    /**
     * For each bucket X:
     * Count the total # of txs in each bucket
     * Track the historical moving average of this total over blocks
     * @type {Array<number>}
     */
    this.averageTransactionConfirmationTarget = new Array(this.buckets.length).fill(0);
    /**
     * Count the total # of txs confirmed within Y blocks in each bucket
     * Track the historical moving average of theses totals over blocks
     * @type {Array<number>}
     */
    this.confirmationAverage = getTwoDimensionalArrayWithZeros(this.maxPeriods, this.buckets.length);
    /**
     * Track moving avg of txs which have been evicted from the mempool
     * after failing to be confirmed within Y blocks
     * @type {Array<number>}
     */
    this.failAverage = getTwoDimensionalArrayWithZeros(this.maxPeriods, this.buckets.length);
    /**
     * Sum the total feerate of all tx's in each bucket
     * Track the historical moving average of this total over blocks
     * @type {Array<number>}
     */
    this.average = new Array(this.buckets.length).fill(0);
    /**
     * Mempool counts of outstanding transactions
     * For each bucket X, track the number of transactions in the mempool
     * that are unconfirmed for each possible confirmation value Y
     * @type {Array<number>}
     */
    this.unconfirmedTransactions = getTwoDimensionalArrayWithZeros(this.getMaxConfirms(), this.buckets.length);
    /**
     * Transactions count still unconfirmed after GetMaxConfirms for each bucket.
     * So array index is bucket index, and value is transactions count.
     * @type {Array<number>}
     */
    this.oldUnconfirmedTransactions = new Array(this.buckets.length).fill(0);
  }

  clearCurrent(blockHeight) {
    const blockIndex = blockHeight % this.unconfirmedTransactions.length;
    for (let j = 0; j < this.buckets.length; j++) {
      this.oldUnconfirmedTransactions[j] += this.unconfirmedTransactions[blockIndex][j];
      this.unconfirmedTransactions[blockIndex][j] = 0;
    }
  }

  /**
   *
   * @param blocksToConfirm
   * @param val - fee in satoshis
   */
  record(blocksToConfirm, val) {
    // Todo: danger! val in btc, buckets in satoshis!
    // blocksToConfirm is 1-based
    if (blocksToConfirm < 1) { return; }
    const periodsToConfirm = parseInt(((blocksToConfirm + this.scale) - 1) / this.scale, 10);
    const bucketIndex = lowerBound(this.buckets, val);
    for (let i = periodsToConfirm; i <= this.confirmationAverage.length; i++) {
      this.confirmationAverage[i - 1][bucketIndex]++;
    }
    this.averageTransactionConfirmationTarget[bucketIndex]++;
    this.average[bucketIndex] += val;
  }

  updateMovingAverages() {
    for (let j = 0; j < this.buckets.length; j++) {
      for (let i = 0; i < this.confirmationAverage.length; i++) {
        this.confirmationAverage[i][j] = this.confirmationAverage[i][j] * this.decay;
      }
      for (let i = 0; i < this.failAverage.length; i++) {
        this.failAverage[i][j] = this.failAverage[i][j] * this.decay;
      }
      this.average[j] = this.average[j] * this.decay;
      this.averageTransactionConfirmationTarget[j] = this.averageTransactionConfirmationTarget[j] * this.decay;
    }
  }

  /**
   * Add data about transaction to unconfirmed transactions
   * @param blockHeight - height when transaction entered mempool
   * @param feeInSatoshisPerK - fee in satoshis per kilobyte
   * @returns {number} - bucket index
   */
  addTx(blockHeight, feeInSatoshisPerK) {
    const bucketIndex = lowerBound(this.buckets, feeInSatoshisPerK);
    const blockIndex = blockHeight % this.unconfirmedTransactions.length;
    this.unconfirmedTransactions[blockIndex][bucketIndex]++;
    return bucketIndex;
  }

  removeTx(transactionHeight, bestSeenHeight, bucketIndex, inBlock) {
    // bestSeenHeight is not updated yet for the new block
    let blocksAgo = bestSeenHeight - transactionHeight;
    // the Estimator hasn't seen any blocks yet
    if (bestSeenHeight === 0) {
      blocksAgo = 0;
    }
    if (blocksAgo < 0) {
      throw new Error('Blockpolicy error, blocks ago is negative for mempool tx');
    }

    if (blocksAgo >= this.unconfirmedTransactions.length) {
      if (this.oldUnconfirmedTransactions[bucketIndex] > 0) {
        this.oldUnconfirmedTransactions[bucketIndex]--;
      } else {
        console.log(`Mempool tx removed from > ${blocksAgo} blocks, bucketIndex = ${bucketIndex} already`);
      }
    } else {
      const blockIndex = transactionHeight % this.unconfirmedTransactions.length;
      if (this.unconfirmedTransactions[blockIndex][bucketIndex] > 0) {
        this.unconfirmedTransactions[blockIndex][bucketIndex]--;
      } else {
        // todo: It is not actually error, but warning maybe?
        throw new Error(`Can't remove tx: transactions at blockIndex = ${blockIndex}, bucketIndex = ${bucketIndex} already empty`);
      }
    }
    // Only counts as a failure if not confirmed for entire period
    if (!inBlock && blocksAgo >= this.scale) {
      const periodsAgo = parseInt(blocksAgo / this.scale, 10);
      for (let i = 0; i < periodsAgo && i < this.failAverage.length; i++) {
        this.failAverage[i][bucketIndex]++;
      }
    }
  }
  /**
   * Returns the max number of confirms we're tracking
   * @returns {number}
   */
  getMaxConfirms() {
    return this.scale * this.confirmationAverage.length;
  }

  /**
   *
   * @param {int} confTarget - desired number of confirmations
   * @param {number} sufficientTxVal - minimum confirmed transaction per bucket
   * @param {number} minimumSuccessRate - desired success probability
   * @param {boolean} requireLowestPossibleFee - return lowest fee or highest success rate
   * @param {int} blockHeight
   * @returns {[number, EstimationResult]}
   */
  estimateMedianVal(confTarget, sufficientTxVal, minimumSuccessRate, requireLowestPossibleFee, blockHeight) {
    const {
      unconfirmedTransactions,
      oldUnconfirmedTransactions,
      averageTransactionConfirmationTarget,
      failAverage,
      average,
      confirmationAverage,
    } = this;

    // Counters for a bucket (or range of buckets)
    let confirmedTransactionCount = 0; // Number of tx's confirmed within the confTarget
    let confirmedTransactionForAllTime = 0; // Total number of tx's that were ever confirmed
    let transactionsWithSameTargetStillInMempool = 0; // Number of tx's still in mempool for confTarget or longer
    // Number of tx's that were never confirmed but removed from the mempool after confTarget
    let neverConfirmedTransactionsLeavedMempool = 0;
    const periodTarget = parseInt(((confTarget + this.scale) - 1) / this.scale, 10);

    const bucketsCount = this.buckets.length - 1;

    // requireLowestPossibleFee means we are looking for the lowest feerate such that all higher
    // values pass, so we start at maxbucketindex (highest feerate) and look at successively
    // smaller buckets until we reach failure.  Otherwise, we are looking for the highest
    // feerate such that all lower values fail, and we go in the opposite direction.
    const startBucket = requireLowestPossibleFee ? bucketsCount : 0;
    const step = requireLowestPossibleFee ? -1 : 1;

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
      confirmedTransactionCount += confirmationAverage[periodTarget - 1][bucketIndex];
      confirmedTransactionForAllTime += averageTransactionConfirmationTarget[bucketIndex];
      neverConfirmedTransactionsLeavedMempool += failAverage[periodTarget - 1][bucketIndex];
      for (let confirmationsCount = confTarget; confirmationsCount < this.getMaxConfirms(); confirmationsCount++) {
        transactionsWithSameTargetStillInMempool += unconfirmedTransactions[Math.abs(blockHeight - confirmationsCount) % bins][bucketIndex];
      }
      transactionsWithSameTargetStillInMempool += oldUnconfirmedTransactions[bucketIndex];
      // If we have enough transaction data points in this range of buckets,
      // we can test for success
      // (Only count the confirmed data points, so that each confirmation count
      // will be looking at the same amount of data and same bucket breaks)
      if (confirmedTransactionForAllTime >= sufficientTxVal / (1 - this.decay)) {
        const curSuccessRate = confirmedTransactionCount / (confirmedTransactionForAllTime + neverConfirmedTransactionsLeavedMempool + transactionsWithSameTargetStillInMempool);

        // Check to see if we are no longer getting confirmed at the success rate
        const lowerFeeNeeded = requireLowestPossibleFee && minimumSuccessRate > curSuccessRate;
        const higherSuccessRateRequired = !requireLowestPossibleFee && curSuccessRate > minimumSuccessRate;
        if (lowerFeeNeeded || higherSuccessRateRequired) {
          if (passing) {
            // First time we hit a failure record the failed bucket
            const failMinBucket = Math.min(curNearBucket, curFarBucket);
            const failMaxBucket = Math.max(curNearBucket, curFarBucket);
            failBucket.start = failMinBucket ? this.buckets[failMinBucket - 1] : 0;
            failBucket.end = this.buckets[failMaxBucket];
            failBucket.withinTarget = confirmedTransactionCount;
            failBucket.totalConfirmed = confirmedTransactionForAllTime;
            failBucket.inMempool = transactionsWithSameTargetStillInMempool;
            failBucket.leftMempool = neverConfirmedTransactionsLeavedMempool;
            passing = false;
          }
          // Otherwise update the cumulative stats, and the bucket variables
          // and reset the counters
        } else {
          // Reset any failed bucket, currently passing
          failBucket = new EstimatorBucket();
          foundAnswer = true;
          passing = true;

          passBucket.withinTarget = confirmedTransactionCount;
          passBucket.totalConfirmed = confirmedTransactionForAllTime;
          passBucket.inMempool = transactionsWithSameTargetStillInMempool;
          passBucket.leftMempool = neverConfirmedTransactionsLeavedMempool;

          confirmedTransactionCount = 0;
          confirmedTransactionForAllTime = 0;
          neverConfirmedTransactionsLeavedMempool = 0;
          transactionsWithSameTargetStillInMempool = 0;

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
      txSum += averageTransactionConfirmationTarget[j];
    }

    if (foundAnswer && txSum !== 0) {
      txSum /= 2;
      for (let j = minBucket; j <= maxBucket; j++) {
        if (averageTransactionConfirmationTarget[j] < txSum) {
          txSum -= averageTransactionConfirmationTarget[j];
        } else { // we're in the right bucket
          median = parseInt(average[j] / averageTransactionConfirmationTarget[j], 10);
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
      failBucket.withinTarget = confirmedTransactionCount;
      failBucket.totalConfirmed = confirmedTransactionForAllTime;
      failBucket.inMempool = transactionsWithSameTargetStillInMempool;
      failBucket.leftMempool = neverConfirmedTransactionsLeavedMempool;
    }

    // console.log(`FeeEst: ${confTarget} ${requireGreater ? '>' : '<'} ${100.0 * successBreakPoint}
    //   decay ${this.decay}: feerate: ${median} from (${passBucket.start} - ${passBucket.end})
    //   ${(100 * passBucket.withinTarget) / (passBucket.totalConfirmed + passBucket.inMempool + passBucket.leftMempool)} ${passBucket.withinTarget}/(${passBucket.totalConfirmed} ${passBucket.inMempool} mem ${passBucket.leftMempool} out)
    //   Fail: (${failBucket.start} - ${failBucket.end})
    //   ${(100 * failBucket.withinTarget) / (failBucket.totalConfirmed + failBucket.inMempool + failBucket.leftMempool)} ${failBucket.withinTarget}/(${failBucket.totalConfirmed} ${failBucket.inMempool} mem ${failBucket.leftMempool} out)`);
    const result = new EstimationResult(passBucket, failBucket, this.decay, this.scale);

    return [
      median,
      result,
    ];
  }
}

module.exports = TransactionStats;
