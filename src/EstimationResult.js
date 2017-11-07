const EstimatorBucket = require('./EstimatorBucket');

class EstimationResult {
  constructor(pass = new EstimatorBucket(), fail = new EstimatorBucket(), decay = 0, scale = 0) {
    this.pass = pass;
    this.fail = fail;
    this.decay = decay;
    this.scale = scale;
  }
}

module.exports = EstimationResult;
