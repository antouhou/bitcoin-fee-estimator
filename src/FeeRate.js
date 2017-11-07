class FeeRate {
  constructor(nFeePaid, transactionSizeInBytes) {
    if (transactionSizeInBytes > Math.MAX_SAFE_INTEGER) {
      throw new Error('Transaction size is too big');
    }

    if (transactionSizeInBytes > 0) {
      this.nSatoshisPerK = (nFeePaid * 1000) / transactionSizeInBytes;
    } else {
      this.nSatoshisPerK = 0;
    }
  }

  getFee(transactionSizeInBytes) {
    if (transactionSizeInBytes > Math.MAX_SAFE_INTEGER) {
      throw new Error('Transaction size is too big');
    }

    let nFee = (this.nSatoshisPerK * transactionSizeInBytes) / 1000;

    if (nFee === 0 && transactionSizeInBytes !== 0) {
      if (this.nSatoshisPerK > 0) { nFee = CAmount(1); }
      if (this.nSatoshisPerK < 0) { nFee = CAmount(-1); }
    }

    return nFee;
  }
}

module.exports = FeeRate;
