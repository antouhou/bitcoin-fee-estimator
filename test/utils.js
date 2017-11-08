const { expect } = require('chai');
const { lowerBound } = require('../src/utils');

describe('utils', () => {
  describe('.lowerBound()', () => {
    it('should find closest element in array to a given, when value not in array', () => {
      const x = 8;
      const array = [5, 10, 15, 9, 20, 25, 30, 35];
      const boundIndex = lowerBound(array, x);
      expect(boundIndex).to.be.a('number');
      expect(boundIndex).to.equal(3); // index of 9
      expect(array[boundIndex]).to.be.at.least(x);
    });
    it('should find closest element in array to a given when value in array', () => {
      const x = 20;
      const array = [10, 20, 30, 30, 20, 10, 10, 20];
      const boundIndex = lowerBound(array, x);
      expect(boundIndex).to.be.a('number');
      expect(boundIndex).to.equal(1); // First encounter of 20
      expect(array[boundIndex]).to.be.at.least(x);
    });
    it('should give same results as cpp implementation', () => {
      const array = [10, 20, 30, 30, 20, 10, 10, 20];
      array.sort((a, b) => a - b);
      const boundIndex = lowerBound(array, 20);
      expect(boundIndex).to.be.equal(3);
    });
    it('should return correct result on any iterable', () => {
      const map = new Map();
      map.set(1, 'foo');
      map.set(3, 'bar');
      map.set(5, 'baz');
      const boundIndex = lowerBound(map.keys(), 4);
      expect(boundIndex).to.be.equal(1);
      const boundKey = Array.from(map.keys())[boundIndex];
      expect(boundKey).to.be.equal(3);
      const boundValue = map.get(boundKey);
      expect(boundValue).to.be.equal('bar');
    });
  });
});
