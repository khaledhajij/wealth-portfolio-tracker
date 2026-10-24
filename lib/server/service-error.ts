import "server-only";

export class ServiceError extends Error {
  constructor(public readonly status: 400 | 401 | 403 | 404 | 409 | 503, message: string) {
    super(message);
    this.name = "ServiceError";
  }
}
