// Quantities use up to three decimal places (one roll = 0.125 of an 8-roll pack).
export function validBhpQuantity(value, allowZero = false) {
  if (!['number','string'].includes(typeof value) || String(value).trim() === '') return false;
  const number = Number(value);
  return Number.isFinite(number) && number >= (allowZero ? 0 : 0.001) && number <= 1000000000 && Math.abs(number * 1000 - Math.round(number * 1000)) < 0.000001;
}
