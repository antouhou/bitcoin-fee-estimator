# bitcoin-fee-estimator
Implementation of fee estimation algorithm of bitcoin-core > 0.15.x in javascript

## Motivation
bitcoin-core 0.15.x fee estimation algorithm is a big improvement over older versions.
It can estimate fee up to 1000 blocks instead of only 25 blocks
on pre 0.15.x versions. But there are many bitcoin forks that still using older code.
With this library, it is now possible to estimate fees in a new way for every pre-0.15.x fork.

## Installation
`npm i bitcoin-fee-estimator --save`

## Usage

### Initialization
```javascript
const Estimator = require('bitcoin-fee-estimator');
const estimator = new Estimator();
```

### Getting some fee stats
Since estimator uses moving averages of fees, we need to feed to an estimator
a mempool and then submit some blocks with confirmed transactions from mempool:
```javascript
// rawMempool is raw mempool that can be obtained through getrawmempool RPC call to bitcoin node
estimator.processNewMempoolTransactions(rawMempool);
// newBlock is a new incoming block that has some confirmed transactions from mempool.
// can be obtained through getblock RPC call
estimator.processBlock(newBlock.height, newBlock.tx);
// after processing block, new incoming transactions need to be processed:
estimator.processNewMempoolTransactions(newRawMempool);
// This algorithm needs to be run for each new block in order to maintain up to date bitcoin fee statistics.
// After repeating this several times, you can do estimations:
estimator.estimateSmartFee(1).getFeePerK();
// 1 is desired number of blocks before the transaction will be included in the block.
```
**If you collected not enough data, estimator will always return zero.**
**If you collected information only for 25 blocks, estimator will return zero if you will pass target above 25.**

## Contributing

To build the library you need to run `npm run build`. This will run eslint, transpile code for older versions of node, run tests.

As this library designed to works on node versions 0.12 and above, in order to make sure everything is fine you need installed 0.12 version of node and run `tools/testOldNode.js` with it.