// This file needed to be run on node 0.12 in order to make sure that library runs on 0.12

var crypto = require('crypto');
var Estimator = require('../index');
var FeeRate = require('../build/FeeRate');

// For test we will assume that 4 transactions can be added to mempool on each iterration block and 3 can be mined
function generateRandomMempoolData(len, height) {
  var mempool = {};
  for (var i = 0; i < len; i++) {
    mempool[crypto.createHash('sha256').update((Date.now() + Math.random()).toString()).digest('hex')] = {
      size: 23818,
      fee: (Math.random() * (0.00047646 - 0.00023823)) + 0.00023823,
      // fee: 0.00023823,
      modifiedfee: 0.00023823,
      time: 1510165507,
      height: height,
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
  var hashes = Object.keys(rawmempooldata);
  var arr = [];
  for (var i = 0; i < hashes.length; i++) {
    rawmempooldata[hashes[i]].hash = hashes[i];
    arr.push(rawmempooldata[hashes[i]]);
  }
  return arr;
}
function generateBlock(mempooldata, prevBlockHeight, transactionsToInclude) {
  mempooldata.sort(function (a, b){return b.fee - a.fee});
  var txToIncludeInBlock = mempooldata.splice(0, transactionsToInclude);
  return {
    height: prevBlockHeight + 1,
    tx: txToIncludeInBlock.map(function (tx) {return tx.hash}),
  };
}

var estimator = new Estimator();

var wholePool = [];
for (var i = 1; i < 11; i++) {
  var newBlock = generateBlock(wholePool, i - 1, 10);
  var newMempoolData = generateRandomMempoolData(11, i);
  wholePool = wholePool.concat(transformMempoolData(newMempoolData));
  estimator.processBlock(newBlock.height, newBlock.tx);
  estimator.processNewMempoolTransactions(newMempoolData);
}

var fees = [];
for (var i = 1; i < 7; i++) {
  fees.push(estimator.estimateSmartFee(i));
}
if (fees[0] instanceof FeeRate) {
  console.log('0.12 test pass');
} else {
  console.log('0.12 test not pass');
}
