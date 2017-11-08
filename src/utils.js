/**
 * Returns index of the first element in the array which is not less than given value.
 * @param {Array<number>} array
 * @param {number} value
 * @returns {number} index
 */
const lowerBound = function lowerBound(array, value) {
  const arrayCopy = array.slice(0);
  const closestGreaterOrEqualElement = arrayCopy.sort((a, b) => Math.abs(value - a) - Math.abs(value - b))[0];
  const index = array.indexOf(closestGreaterOrEqualElement);
  return index;
};

module.exports = {
  lowerBound,
};
