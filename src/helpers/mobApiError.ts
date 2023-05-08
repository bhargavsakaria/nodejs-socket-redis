export default class ApiError extends Error {
  constructor(
    readonly result: Record<string, unknown>,
    readonly message: string,
    readonly error: string | object,
    readonly code: number
  ) {
    super();
  }
}

export class HttpError extends ApiError {
  constructor(readonly message: string, error: string | object, code: number) {
    super({}, message, error, code);
  }
}

export class WebSocketError extends ApiError {
  constructor(readonly message: string, error: string | object, code: number) {
    super({}, message, error, code);
  }
}
