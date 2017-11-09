// One hundred millions
const satoshisInBtc = 100000000;

class FeeRate {
  static fromSatoshisPerK(satoshisPerK) {
    const feeRate = new FeeRate(0);
    feeRate.satoshisPerK = satoshisPerK;
    return feeRate;
  }

  constructor(feePaidInBtc, transactionSizeInBytes) {
    if (transactionSizeInBytes > 0) {
      const btcPerByte = feePaidInBtc / transactionSizeInBytes;
      const btcPerK = btcPerByte * 1000;
      this.satoshisPerK = btcPerK * satoshisInBtc;
    } else {
      this.satoshisPerK = 0;
    }
  }

  getFee(transactionSizeInBytes) {
    let feeInSatoshis = (this.satoshisPerK * transactionSizeInBytes) / 1000;

    if (feeInSatoshis === 0 && transactionSizeInBytes !== 0) {
      if (this.satoshisPerK > 0) { feeInSatoshis = 1; }
      if (this.satoshisPerK < 0) { feeInSatoshis = -1; }
    }

    return parseInt(feeInSatoshis, 10);
  }

  getFeePerK() {
    return this.getFee(1000);
  }
}

module.exports = FeeRate;
