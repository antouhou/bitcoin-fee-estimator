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

module.exports = EstimatorBucket;
