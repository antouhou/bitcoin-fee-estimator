const crypto = require('crypto');

const { expect } = require('chai');
const Estimator = require('../src/Estimator');
const FeeRate = require('../src/FeeRate');

// Todo: need to mention in readme that requesting non-wallet transactions require some additional configuration

/*
* For this test we will assume that current block is 23212 and all transactions
* entered mempool on this height. Then this mempool transactions will be confirmed
* on the next, 23213 block.
* */

const currentBlock = {
  height: 23212,
  tx: [],
};

const block = {
  hash: '0000000079232eea7aeacb316f2f5f52a137eeca6eff5ed470380a5c2aadcbb8',
  confirmations: 102,
  size: 5632,
  height: 23213,
  version: 536870912,
  merkleroot: '3cfcf7aa626ddf21a53fa43955f2523f13d69e8ef80fad0b9d7a3f5cc1f42870',
  tx: [
    '4eefe8f6a7259d60f8a18520fc001e58e73cd957ad4dea95fc8223c92df7525b',
    '66d128425f67c89fe5fff16a747a2021f12e56897c43f42880b7925ae1648f81',
    'b943bd758e15088a5e5a74b63d319e8e54675a68da1c331760eaf385324e3d5a',
    '03064c30a2f6776a7085f73d80699e98640f32e52f242d74f98bd3dc49a3bd6d',
    'dc108354f9ab060956ca05ca01f92f7815be8c992e1b4c45df9b86565e04127d',
    '97a6dea30f9968bac9d24cf37783e2c8d3d2dda0b5a6149207db9373e6a9db9a',
    '552b52f68c7e68df71b8182bdee3256d6277c89a3c25a57ff7db40567dd35ee8',
  ],
  time: 1510145550,
  mediantime: 1510145127,
  nonce: 1786953741,
  bits: '1d011d17',
  difficulty: 0.8979488374004905,
  chainwork: '000000000000000000000000000000000000000000000000000043d3a58ef3b1',
  previousblockhash: '00000000175cba6efcb1e3e2d15f7911d4d8c137dc6f501263330c9b7dc8074a',
  nextblockhash: '0000000028e6d5190c7b9709ce561af6800e5aea74a87b9c564907facf1ae805',
};

// For test we will assume that 4 transactions can be added to mempool on each iterration block and 3 can be mined

function generateRandomMempoolData(len, height) {
  const mempool = {};
  for (let i = 0; i < len; i++) {
    mempool[crypto.createHash('sha256').update((Date.now() + Math.random()).toString()).digest('hex')] = {
      size: 23818,
      fee: (Math.random() * (0.00047646 - 0.00023823)) + 0.00023823,
      // fee: 0.00023823,
      modifiedfee: 0.00023823,
      time: 1510165507,
      height,
      startingpriority: 15191056856720.27,
      currentpriority: 15191056856720.27,
      descendantcount: 1,
      descendantsize: 23818,
      descendantfees: 23823,
      depends: [
      ],
    };
  }
  return mempool;
}

function transformMempoolData(rawmempooldata) {
  const hashes = Object.keys(rawmempooldata);
  const arr = [];
  for (let i = 0; i < hashes.length; i++) {
    rawmempooldata[hashes[i]].hash = hashes[i];
    arr.push(rawmempooldata[hashes[i]]);
  }
  return arr;
}

function generateBlock(mempooldata, prevBlockHeight, transactionsToInclude) {
  mempooldata.sort((a, b) => b.fee - a.fee);
  const txToIncludeInBlock = mempooldata.splice(0, transactionsToInclude);
  return {
    height: prevBlockHeight + 1,
    tx: txToIncludeInBlock.map(tx => tx.hash),
  };
}

const rawMempool = {
  b6cad1deec1635576ad984db3932cabfdea7f666f65b7bf2cf02fcbb28214061: {
    size: 23818,
    fee: 0.00023823,
    modifiedfee: 0.00023823,
    time: 1510165507,
    height: 23212,
    startingpriority: 15191056856720.27,
    currentpriority: 15191056856720.27,
    descendantcount: 1,
    descendantsize: 23818,
    descendantfees: 23823,
    depends: [
    ],
  },
  '66d128425f67c89fe5fff16a747a2021f12e56897c43f42880b7925ae1648f81': {
    size: 23818,
    fee: 0.00023823,
    modifiedfee: 0.00023823,
    time: 1510165507,
    height: 23212,
    startingpriority: 15191056856720.27,
    currentpriority: 15191056856720.27,
    descendantcount: 1,
    descendantsize: 23818,
    descendantfees: 23823,
    depends: [
    ],
  },
  b943bd758e15088a5e5a74b63d319e8e54675a68da1c331760eaf385324e3d5a: {
    size: 23818,
    fee: 0.00023823,
    modifiedfee: 0.00023823,
    time: 1510165507,
    height: 23212,
    startingpriority: 15191056856720.27,
    currentpriority: 15191056856720.27,
    descendantcount: 1,
    descendantsize: 23818,
    descendantfees: 23823,
    depends: [
    ],
  },
  '03064c30a2f6776a7085f73d80699e98640f32e52f242d74f98bd3dc49a3bd6d': {
    size: 23818,
    fee: 0.00023823,
    modifiedfee: 0.00023823,
    time: 1510165507,
    height: 23212,
    startingpriority: 15191056856720.27,
    currentpriority: 15191056856720.27,
    descendantcount: 1,
    descendantsize: 23818,
    descendantfees: 23823,
    depends: [
    ],
  },
  dc108354f9ab060956ca05ca01f92f7815be8c992e1b4c45df9b86565e04127d: {
    size: 23818,
    fee: 0.00023823,
    modifiedfee: 0.00023823,
    time: 1510165507,
    height: 23212,
    startingpriority: 15191056856720.27,
    currentpriority: 15191056856720.27,
    descendantcount: 1,
    descendantsize: 23818,
    descendantfees: 23823,
    depends: [
    ],
  },
  '97a6dea30f9968bac9d24cf37783e2c8d3d2dda0b5a6149207db9373e6a9db9a': {
    size: 23818,
    fee: 0.0023823,
    modifiedfee: 0.00023823,
    time: 1510165507,
    height: 23212,
    startingpriority: 15191056856720.27,
    currentpriority: 15191056856720.27,
    descendantcount: 1,
    descendantsize: 23818,
    descendantfees: 23823,
    depends: [
    ],
  },
  '552b52f68c7e68df71b8182bdee3256d6277c89a3c25a57ff7db40567dd35ee8': {
    size: 23818,
    fee: 0.00023823,
    modifiedfee: 0.00023823,
    time: 1510165507,
    height: 23212,
    startingpriority: 15191056856720.27,
    currentpriority: 15191056856720.27,
    descendantcount: 1,
    descendantsize: 23818,
    descendantfees: 23823,
    depends: [
    ],
  },
};

function copyMempool() {
  const mempoolCopy = {};
  Object.keys(rawMempool).forEach((txid) => {
    mempoolCopy[txid] = Object.assign({}, rawMempool[txid]);
  });
  return mempoolCopy;
}

describe('Estimator', () => {
  describe('constructor', () => {
    it('should fill estimator data correctly', () => {
      const estimator = new Estimator();
      expect(estimator.mempoolTransactions).to.be.instanceof(Map);
    });
  });

  describe('.processBlock()', () => {
    it('should process new block', () => {
      const estimator = new Estimator();
      estimator.processBlock(block.height, block.tx);
      expect(estimator.bestSeenHeight).to.be.equal(block.height);
    });
  });

  describe('.addTransactionToMempool()', () => {
    it('should add transactions to mempool', () => {
      const estimator = new Estimator();
      estimator.processBlock(currentBlock.height, currentBlock.tx);
      const mempool = copyMempool();
      const mempoolSize = Object.keys(mempool).length;
      expect(estimator.mempoolTransactions.size).to.equal(0);
      estimator.processNewMempoolTransactions(mempool);
      expect(estimator.mempoolTransactions.size).to.equal(mempoolSize);
    });
    it('should add transactions to mempool, add to stats and remove them when they are confirmed', () => {
      const estimator = new Estimator();
      estimator.processBlock(currentBlock.height, currentBlock.tx);
      const mempool = copyMempool();
      const mempoolSize = Object.keys(mempool).length;
      expect(estimator.mempoolTransactions.size).to.equal(0);
      estimator.processNewMempoolTransactions(mempool);
      expect(estimator.mempoolTransactions.size).to.equal(mempoolSize);
      /* 28 is corresponding to block 23212 (blockHeight % maxNumberOfConfirmations for this stat),
      * 0 to fee 1000 satoshis per k (lower bound of buckets),
      * which is used in test data set
      */
      expect(estimator.feeStats.unconfirmedTransactions[28][0]).to.equal(6);
      // Same way, 47 is corresponding to fee 10k per k
      expect(estimator.feeStats.unconfirmedTransactions[28][47]).to.equal(1);

      estimator.processBlock(block.height, block.tx);
      /* In mempool was 7 transactions,
      *  5 then was included in block (6 actually, but the first is coinbase),
      * so there are should be two transactions in mempool
       */
      expect(estimator.mempoolTransactions.size).to.equal(2);
      expect(estimator.feeStats.unconfirmedTransactions[28][0]).to.equal(2);
      expect(estimator.feeStats.unconfirmedTransactions[28][47]).to.equal(0);
    });
  });

  describe('.estimateSmartFee()', () => {
    it('Should return FeeRate', () => {
      const estimator = new Estimator();
      const fee = estimator.estimateSmartFee(10);
      expect(fee).to.be.instanceof(FeeRate);
    });
    it('Should estimate fee depending on target', () => {
      const estimator = new Estimator();

      let wholePool = [];
      for (let i = 1; i < 11; i++) {
        const newBlock = generateBlock(wholePool, i - 1, 10);
        const newMempoolData = generateRandomMempoolData(11, i);
        wholePool = wholePool.concat(transformMempoolData(newMempoolData));
        estimator.processBlock(newBlock.height, newBlock.tx);
        estimator.processNewMempoolTransactions(newMempoolData);
      }

      const fees = [];
      for (let i = 1; i < 7; i++) {
        fees.push(estimator.estimateSmartFee(i));
      }
      expect(fees[0]).to.be.instanceof(FeeRate);
    });
    it('Should return conservative fee', () => {
      const estimator = new Estimator();
      let wholePool = [];
      for (let i = 1; i < 11; i++) {
        const newBlock = generateBlock(wholePool, i - 1, 10);
        const newMempoolData = generateRandomMempoolData(9, i);
        wholePool = wholePool.concat(transformMempoolData(newMempoolData));
        estimator.processBlock(newBlock.height, newBlock.tx);
        estimator.processNewMempoolTransactions(newMempoolData);
      }
      const fee = estimator.estimateSmartFee(2, true);
      expect(fee).to.be.instanceof(FeeRate);
      expect(fee.getFeePerK()).to.be.above(1000);
    });
    it('Should not give any estimations under 1 confirmation', () => {
      const estimator = new Estimator();

      // fill estimator with data
      let wholePool = [];
      for (let i = 1; i < 10; i++) {
        const newBlock = generateBlock(wholePool, i - 1, 10);
        const newMempoolData = generateRandomMempoolData(10, i);
        wholePool = wholePool.concat(transformMempoolData(newMempoolData));
        estimator.processBlock(newBlock.height, newBlock.tx);
        estimator.processNewMempoolTransactions(newMempoolData);
      }

      expect(estimator.estimateSmartFee(1).getFeePerK()).to.be.above(0);
      expect(estimator.estimateSmartFee(0).getFeePerK()).to.equal(0);
    });
    it('Should not give any estimations over 1008 confirmation', () => {
      const estimator = new Estimator();

      // fill estimator with data
      let wholePool = [];
      for (let i = 1; i < 10; i++) {
        const newBlock = generateBlock(wholePool, i - 1, 10);
        const newMempoolData = generateRandomMempoolData(10, i);
        wholePool = wholePool.concat(transformMempoolData(newMempoolData));
        estimator.processBlock(newBlock.height, newBlock.tx);
        estimator.processNewMempoolTransactions(newMempoolData);
      }

      expect(estimator.estimateSmartFee(1008).getFeePerK()).to.be.above(0);
      expect(estimator.estimateSmartFee(1009).getFeePerK()).to.equal(0);
    });
  });
});
