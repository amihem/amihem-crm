// fabricWeight.js — textile weight unit conversions.
//
// GSM = grams per square metre (the base unit everything converts through)
// GLM = grams per linear metre = GSM × width in metres
// OZ  = ounces per square yard = GSM / 33.906 (standard conversion factor)
//
// Width is entered in inches (how Indian textile trade normally quotes
// it) and converted to metres internally.

const OZ_PER_GSM = 1 / 33.906;
const INCH_TO_METRE = 0.0254;

export function widthInchesToMetres(widthInches) {
  const w = parseFloat(widthInches);
  return isNaN(w) ? null : w * INCH_TO_METRE;
}

// Given one known weight value + its unit + width, returns { gsm, glm, oz }
// all as numbers rounded to 2 decimals, or null for any that can't be
// computed (e.g. GLM/OZ need width, GSM alone doesn't).
export function computeFabricWeights(value, unit, widthInches) {
  const v = parseFloat(value);
  if (isNaN(v)) return { gsm: null, glm: null, oz: null };

  const widthM = widthInchesToMetres(widthInches);

  let gsm;
  if (unit === "gsm") gsm = v;
  else if (unit === "oz") gsm = v / OZ_PER_GSM;
  else if (unit === "glm") gsm = widthM ? v / widthM : null;
  else gsm = null;

  if (gsm === null) return { gsm: null, glm: null, oz: null };

  const glm = widthM ? gsm * widthM : null;
  const oz = gsm * OZ_PER_GSM;

  return {
    gsm: round2(gsm),
    glm: glm === null ? null : round2(glm),
    oz: round2(oz),
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
