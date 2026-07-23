export class AppError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export class AuthError extends AppError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHENTICATED', message)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message)
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super('BAD_REQUEST', message)
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super('NOT_FOUND', message)
  }
}
