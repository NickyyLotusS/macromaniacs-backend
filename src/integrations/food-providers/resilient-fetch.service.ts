import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FoodProviderUnavailableError } from './provider-errors';

type CircuitState = { failures: number; openUntil: number };

export type ProviderRateLimit = {
  key: string;
  maxRequests: number;
  windowMs: number;
};

export type ResilientFetchOptions = {
  rateLimit?: ProviderRateLimit;
};

@Injectable()
export class ResilientFetchService {
  private readonly circuits = new Map<string, CircuitState>();
  private readonly requestTimes = new Map<string, number[]>();
  private readonly blockedUntil = new Map<string, number>();

  constructor(private readonly config: ConfigService) {}

  async json<T>(
    provider: string,
    url: URL,
    headers: Record<string, string> = {},
    options: ResilientFetchOptions = {},
  ): Promise<T> {
    const circuit = this.circuits.get(provider) ?? {
      failures: 0,
      openUntil: 0,
    };
    if (circuit.openUntil > Date.now()) {
      throw new FoodProviderUnavailableError(provider, 'circuit is open');
    }

    const retries = this.config.get<number>('FOOD_PROVIDER_RETRIES') ?? 1;
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      this.reserveProviderRequest(provider, options.rateLimit);
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        this.config.get<number>('FOOD_PROVIDER_TIMEOUT_MS') ?? 3000,
      );
      try {
        const response = await fetch(url, {
          headers: { Accept: 'application/json', ...headers },
          signal: controller.signal,
        });
        if (response.status === 404) {
          this.success(provider);
          return null as T;
        }
        if (response.status === 429) {
          this.blockProvider(options.rateLimit, response.headers);
          lastError = new FoodProviderUnavailableError(
            provider,
            'provider returned HTTP 429',
          );
          break;
        }
        if (!response.ok) {
          if (response.status < 500) {
            throw new Error(`provider returned HTTP ${response.status}`);
          }
          throw new FoodProviderUnavailableError(
            provider,
            `provider returned HTTP ${response.status}`,
          );
        }
        const body = (await response.json()) as T;
        this.success(provider);
        return body;
      } catch (error) {
        lastError = error;
        if (
          attempt >= retries ||
          (error instanceof Error &&
            error.message.startsWith('provider returned HTTP 4'))
        ) {
          break;
        }
        await this.waitBeforeRetry(attempt);
      } finally {
        clearTimeout(timeout);
      }
    }
    this.failure(provider);
    throw new FoodProviderUnavailableError(
      provider,
      lastError instanceof Error ? lastError.message : 'provider unavailable',
    );
  }

  private success(provider: string): void {
    this.circuits.set(provider, { failures: 0, openUntil: 0 });
  }

  private failure(provider: string): void {
    const previous = this.circuits.get(provider) ?? {
      failures: 0,
      openUntil: 0,
    };
    const failures = previous.failures + 1;
    const threshold =
      this.config.get<number>('FOOD_PROVIDER_CIRCUIT_FAILURES') ?? 3;
    this.circuits.set(provider, {
      failures,
      openUntil:
        failures >= threshold
          ? Date.now() +
            (this.config.get<number>('FOOD_PROVIDER_CIRCUIT_RESET_MS') ??
              30_000)
          : 0,
    });
  }

  private reserveProviderRequest(
    provider: string,
    rateLimit?: ProviderRateLimit,
  ): void {
    if (!rateLimit) return;
    const now = Date.now();
    if ((this.blockedUntil.get(rateLimit.key) ?? 0) > now) {
      throw new FoodProviderUnavailableError(
        provider,
        'provider rate limit is temporarily blocked',
      );
    }

    const threshold = now - rateLimit.windowMs;
    const recent = (this.requestTimes.get(rateLimit.key) ?? []).filter(
      (requestAt) => requestAt > threshold,
    );
    if (recent.length >= rateLimit.maxRequests) {
      throw new FoodProviderUnavailableError(
        provider,
        'local provider rate limit exceeded',
      );
    }
    recent.push(now);
    this.requestTimes.set(rateLimit.key, recent);
  }

  private blockProvider(
    rateLimit: ProviderRateLimit | undefined,
    headers: Headers,
  ): void {
    if (!rateLimit) return;
    const retryAfter = headers.get('retry-after');
    const seconds = Number(retryAfter);
    const retryAt =
      retryAfter && !Number.isNaN(seconds)
        ? Date.now() + Math.max(1, seconds) * 1000
        : retryAfter
          ? Date.parse(retryAfter)
          : Number.NaN;
    this.blockedUntil.set(
      rateLimit.key,
      Number.isFinite(retryAt) && retryAt > Date.now()
        ? retryAt
        : Date.now() + rateLimit.windowMs,
    );
  }

  private async waitBeforeRetry(attempt: number): Promise<void> {
    const baseDelay =
      this.config.get<number>('FOOD_PROVIDER_RETRY_BASE_DELAY_MS') ?? 200;
    const delay = Math.min(baseDelay * 2 ** attempt, 2000);
    await new Promise<void>((resolve) => setTimeout(resolve, delay));
  }
}
