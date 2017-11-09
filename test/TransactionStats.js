const { expect } = require('chai');
const TransactionStats = require('../src/TransactionStats');

// Fees in satoshis. Transactions will be grouped by that values
const buckets = [1000, 2000, 3000];
// How long transactions tracked
const BLOCK_PERIODS = 4;
const SCALE = 1;
// How fast old transactions stats decaying. 0.8 will halve data importance in 3 blocks
const DECAY = 0.8;

describe('TransactionStats', () => {
  describe('.record', () => {
    it('Should save data at correct buckets', () => {
      const stats = new TransactionStats(buckets, BLOCK_PERIODS, DECAY, SCALE);
      // Match bucket at index 2
      stats.record(1, 3500);
      expect(stats.feeSumPerBucket[2]).to.equal(3500);
      expect(stats.confirmedTransactionsPerBucket[2]).to.equal(1);
      console.log(stats);
      stats.record(1, 4000);
      expect(stats.feeSumPerBucket[2]).to.equal(3500 + 4000);
      expect(stats.confirmedTransactionsPerBucket[2]).to.equal(2);
      console.log(stats);
      // Match bucket at index 1
      stats.record(2, 2200);
      expect(stats.feeSumPerBucket[1]).to.equal(2200);
      expect(stats.confirmedTransactionsPerBucket[1]).to.equal(1);
      console.log(stats);
      // Match bucket at index 0
      stats.record(3, 1100);
      expect(stats.feeSumPerBucket[0]).to.equal(1100);
      expect(stats.confirmedTransactionsPerBucket[0]).to.equal(1);
      console.log(stats);
    });
  });
  describe('.updateMovingAverages()', () => {
    it('Should decay all stats by decay coef passed to constructor', () => {
      const stats = new TransactionStats(buckets, BLOCK_PERIODS, DECAY, SCALE);
      stats.record(1, 3500);
      stats.record(1, 4000);
      stats.record(2, 2200);
      stats.record(3, 1100);
      stats.updateMovingAverages();
      expect(stats.feeSumPerBucket[2]).to.equal((3500 + 4000) * DECAY);
      expect(stats.feeSumPerBucket[1]).to.equal(2200 * DECAY);
      expect(stats.feeSumPerBucket[0]).to.equal(1100 * DECAY);
      expect(stats.confirmedTransactionsPerBucket[2]).to.equal(2 * DECAY);
      expect(stats.confirmedTransactionsPerBucket[1]).to.equal(1 * DECAY);
      expect(stats.confirmedTransactionsPerBucket[0]).to.equal(1 * DECAY);
    });
  });
  describe('.estimateMedianVal()', () => {
    it('Should give correct estimations', () => {
      const stats = new TransactionStats(buckets, BLOCK_PERIODS, DECAY, SCALE);
      // Require an avg of 0.1 tx in the combined feerate bucket per block to have stat significance
      const confirmationsPerBlock = 0.1;
      const desiredSuccessProbability = 0.5;
      const lowestPossibleFeeRequired = true;
      // This number can not be bigger than max transaction tracking period, i.g. stats.maxPeriods
      const desiredConfirmationsCount = 4;
      // Assume that current block height is 4.
      const currentBlockHeight = 4;
      stats.record(1, 3500);
      stats.record(1, 4000);
      stats.record(2, 2200);
      stats.record(2, 2200);
      stats.record(2, 2200);
      stats.record(2, 2200);
      stats.record(2, 2200);
      stats.record(2, 2200);
      stats.record(3, 1100);
      const [estimation, estimationStats] = stats.estimateMedianVal(
        desiredConfirmationsCount,
        confirmationsPerBlock,
        desiredSuccessProbability,
        lowestPossibleFeeRequired,
        currentBlockHeight,
      );
      console.log(estimation);
      console.log(estimationStats);
    });
  });
});
