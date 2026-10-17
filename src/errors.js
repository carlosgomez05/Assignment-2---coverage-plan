// One error type used by every layer; the HTTP layer maps it to a response.
export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (msg, code = 'BAD_REQUEST') => new AppError(400, code, msg);
export const unauthorized = (msg = 'Login required', code = 'UNAUTHORIZED') => new AppError(401, code, msg);
export const forbidden = (msg = 'Not allowed', code = 'FORBIDDEN') => new AppError(403, code, msg);
export const notFound = (msg = 'Not found', code = 'NOT_FOUND') => new AppError(404, code, msg);
export const conflict = (msg, code = 'CONFLICT') => new AppError(409, code, msg);
