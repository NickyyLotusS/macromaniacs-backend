type Sample = {
  endpoint: string;
  durationMs: number;
  status: number;
};

const baseUrl = process.env.PERF_BASE_URL?.replace(/\/$/, '');
const token = process.env.PERF_ACCESS_TOKEN;
const iterations = Number(process.env.PERF_ITERATIONS ?? 30);
const concurrency = Number(process.env.PERF_CONCURRENCY ?? 5);
const configuredEndpoints = process.env.PERF_ENDPOINTS?.split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const endpoints = configuredEndpoints?.length
  ? configuredEndpoints
  : [
      '/v1/foods?q=arroz&page=1&limit=20&external=false',
      '/v1/meals?page=1&limit=20',
      '/v1/progress/history?page=1&limit=20',
      '/v1/gamification/ledger?page=1&limit=20',
      '/v1/rewards/balance',
      '/v1/rewards/inventory',
    ];

function requiredConfiguration(): { baseUrl: string; token: string } {
  if (!baseUrl) throw new Error('PERF_BASE_URL is required.');
  if (!token) throw new Error('PERF_ACCESS_TOKEN is required.');
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 10_000)
    throw new Error('PERF_ITERATIONS must be an integer between 1 and 10000.');
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 100)
    throw new Error('PERF_CONCURRENCY must be an integer between 1 and 100.');
  for (const endpoint of endpoints) {
    if (!endpoint.startsWith('/'))
      throw new Error('Every PERF_ENDPOINTS value must be a relative path.');
  }
  return { baseUrl, token };
}

function percentile(values: number[], value: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[
    Math.min(sorted.length - 1, Math.ceil(value * sorted.length) - 1)
  ];
}

async function sample(
  endpoint: string,
  targetBaseUrl: string,
  accessToken: string,
): Promise<Sample> {
  const startedAt = performance.now();
  const response = await fetch(`${targetBaseUrl}${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  await response.arrayBuffer();
  return {
    endpoint,
    durationMs: Number((performance.now() - startedAt).toFixed(2)),
    status: response.status,
  };
}

async function main(): Promise<void> {
  const configuration = requiredConfiguration();
  const queue = Array.from(
    { length: iterations },
    (_, index) => endpoints[index % endpoints.length],
  );
  const samples: Sample[] = [];
  const workers = Array.from(
    { length: Math.min(concurrency, queue.length) },
    async () => {
      while (queue.length > 0) {
        const endpoint = queue.shift();
        if (endpoint)
          samples.push(
            await sample(endpoint, configuration.baseUrl, configuration.token),
          );
      }
    },
  );
  await Promise.all(workers);
  const failures = samples.filter(
    ({ status }) => status < 200 || status >= 400,
  );
  const durations = samples.map(({ durationMs }) => durationMs);
  console.log(
    JSON.stringify(
      {
        baseUrl: configuration.baseUrl,
        iterations: samples.length,
        concurrency,
        p50Ms: percentile(durations, 0.5),
        p95Ms: percentile(durations, 0.95),
        maxMs: Math.max(...durations),
        failures: failures.length,
        endpoints: Object.fromEntries(
          endpoints.map((endpoint) => {
            const values = samples
              .filter((entry) => entry.endpoint === endpoint)
              .map(({ durationMs }) => durationMs);
            return [
              endpoint,
              {
                count: values.length,
                p95Ms: percentile(values, 0.95),
              },
            ];
          }),
        ),
      },
      null,
      2,
    ),
  );
  if (failures.length > 0) process.exitCode = 1;
}

void main();
