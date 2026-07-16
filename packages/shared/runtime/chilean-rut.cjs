const RUT_PATTERN = /^\d{1,8}[0-9K]$/;

function normalizeChileanRut(value) {
  return String(value ?? "").replace(/[.\-\s]/g, "").toUpperCase();
}

function calculateChileanRutVerifier(bodyValue) {
  const body = String(bodyValue).replace(/\D/g, "");
  if (!/^\d{7,8}$/.test(body)) {
    throw new TypeError("Chilean RUT body must contain seven or eight digits");
  }

  let multiplier = 2;
  let sum = 0;
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += Number(body[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const result = 11 - (sum % 11);
  if (result === 11) return "0";
  if (result === 10) return "K";
  return String(result);
}

function createChileanRut(bodyValue) {
  const body = String(bodyValue).replace(/\D/g, "");
  return `${body}${calculateChileanRutVerifier(body)}`;
}

function isValidChileanRut(value) {
  const normalized = normalizeChileanRut(value);
  if (!RUT_PATTERN.test(normalized)) {
    return false;
  }

  const body = normalized.slice(0, -1);
  if (body.length < 7) {
    return false;
  }

  return normalized.slice(-1) === calculateChileanRutVerifier(body);
}

function formatChileanRut(value) {
  const normalized = normalizeChileanRut(value);
  if (!normalized) {
    return "";
  }

  const body = normalized.slice(0, -1);
  const verifier = normalized.slice(-1);
  const groups = [];
  for (let index = body.length; index > 0; index -= 3) {
    groups.unshift(body.slice(Math.max(0, index - 3), index));
  }
  return `${groups.join(".")}-${verifier}`;
}

module.exports = {
  calculateChileanRutVerifier,
  createChileanRut,
  formatChileanRut,
  isValidChileanRut,
  normalizeChileanRut
};
