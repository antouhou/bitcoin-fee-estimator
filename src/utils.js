/**
 * Returns index of the first element in the array which is not less than given value.
 * @param {Iterator<number>} iterable
 * @param {number} value
 * @returns {number} index
 */
const lowerBound = function lowerBound(iterable, value) {
  const array = Array.isArray(iterable) ? iterable : Array.from(iterable);
  const arrayCopy = array.slice(0);
  const closestGreaterOrEqualElement = arrayCopy.sort((a, b) => Math.abs(value - a) - Math.abs(value - b))[0];
  const index = array.indexOf(closestGreaterOrEqualElement);
  return index;
};

const getTwoDimensionalArrayWithZeros = function getTwoDimensionalArrayWithZeros(outerSize, innerSize) {
  const outer = new Array(outerSize);
  for (let i = 0; i < outerSize; i++) {
    outer[i] = new Array(innerSize).fill(0);
  }
  return outer;
};

module.exports = {
  lowerBound,
  getTwoDimensionalArrayWithZeros,
};
