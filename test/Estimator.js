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
      //For this test we will assume that current block does not contain transactions
      estimator.processBlock(currentBlock.height, currentBlock.tx);
      const mempool = copyMempool();
      const mempoolSize = Object.keys(mempool).length;
      expect(estimator.mempoolTransactions.size).to.equal(0);
      estimator.addTransactionsToMempool(mempool);
      expect(estimator.mempoolTransactions.size).to.equal(mempoolSize);
      estimator.processBlock(block.height, block.tx);
    });
  });

  describe('.estimateSmartFee()', () => {
    it('Should return FeeRate', () => {
      const transactions = {};
      const estimator = new Estimator();
      const fee = estimator.estimateSmartFee(10);
      expect(fee).to.be.instanceof(FeeRate);
    });
  });
});
