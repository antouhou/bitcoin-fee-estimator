const EstimationResult = require('./EstimationResult');
const { FeeReason } = require('./constants');

class FeeCalculation {
  constructor(est = new EstimationResult(), desiredTarget = 0, returnedTarget = 0) {
    this.est = est;
    this.reason = FeeReason.NONE;
    this.desiredTarget = desiredTarget;
    this.returnedTarget = returnedTarget;
  }
}

module.exports = FeeCalculation;
