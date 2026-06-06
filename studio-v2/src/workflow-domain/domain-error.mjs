export class DomainError extends Error {
  constructor(message, { code = "DOMAIN_ERROR", statusCode = 400 } = {}) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function isExpectedError(error) {
  return Number.isInteger(error?.statusCode) && error.statusCode >= 400 && error.statusCode < 500;
}

