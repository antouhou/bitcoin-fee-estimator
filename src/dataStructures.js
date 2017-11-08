const { FeeReason } = require('./constants');

class EstimatorBucket {
  constructor(start = -1, end = -1, withinTarget = 0, totalConfirmed = 0, inMempool = 0, leftMempool = 0) {
    this.start = start;
    this.end = end;
    this.withinTarget = withinTarget;
    this.totalConfirmed = totalConfirmed;
    this.inMempool = inMempool;
    this.leftMempool = leftMempool;
  }
}

class EstimationResult {
  constructor(pass = new EstimatorBucket(), fail = new EstimatorBucket(), decay = 0, scale = 0) {
    this.pass = pass;
    this.fail = fail;
    this.decay = decay;
    this.scale = scale;
  }
}

class FeeCalculation {
  constructor(est = new EstimationResult(), desiredTarget = 0, returnedTarget = 0) {
    this.est = est;
    this.reason = FeeReason.NONE;
    this.desiredTarget = desiredTarget;
    this.returnedTarget = returnedTarget;
  }
}

class MempoolTransaction {
  constructor(transaction, bucketIndex) {
    this.blockHeight = transaction.height;
    this.height = transaction.height;
    this.hash = transaction.hash;
    this.fee = transaction.fee;
    this.size = transaction.size;
    this.bucketIndex = bucketIndex;
  }
}

module.exports = {
  EstimationResult,
  EstimatorBucket,
  FeeCalculation,
  MempoolTransaction,
};
