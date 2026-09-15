import type { Config } from 'jest';
import { createDefaultEsmPreset } from 'ts-jest';

const preset = createDefaultEsmPreset({
  tsconfig: './tsconfig.spec.json',
});

const config: Config = {
  ...preset,
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  testPathIgnorePatterns:
    process.env.RUN_DATABASE_TESTS === 'true'
      ? ['/node_modules/', '/legacy/']
      : ['/node_modules/', '/legacy/', '/tests/integration/'],
};

export default config;
