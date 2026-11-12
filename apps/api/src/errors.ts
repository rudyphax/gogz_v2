export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Not found') => new HttpError(404, what);
export const forbidden = (why = 'Forbidden') => new HttpError(403, why);
export const badRequest = (why: string) => new HttpError(400, why);
