import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FoodProviderUnavailableError } from './provider-errors';

type CircuitState = { failures: number; openUntil: number };

@Injectable()
export class ResilientFetchService {
  private readonly circuits = new Map<string, CircuitState>();

  constructor(private readonly config: ConfigService) {}

  async json<T>(
    provider: string,
    url: URL,
    headers: Record<string, string> = {},
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
        if (!response.ok) {
          if (response.status < 500 && response.status !== 429) {
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
}
