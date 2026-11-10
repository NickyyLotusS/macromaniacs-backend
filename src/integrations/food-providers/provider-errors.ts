export class FoodProviderUnavailableError extends Error {
  constructor(
    readonly provider: string,
    message = 'provider unavailable',
  ) {
    super(message);
    this.name = 'FoodProviderUnavailableError';
  }
}

export class FoodProviderResponseError extends Error {
  constructor(
    readonly provider: string,
    message: string,
  ) {
    super(message);
    this.name = 'FoodProviderResponseError';
  }
}
