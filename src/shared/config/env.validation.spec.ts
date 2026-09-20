import { validate } from './env.validation';

const validConfig = {
  APP_ENV: 'test',
  APP_PORT: '3000',
  DATABASE_URL: 'postgresql://user:password@localhost:5432/macromaniacs',
  JWT_SECRET: 'a-valid-test-secret-with-more-than-32-characters',
  JWT_EXPIRES_IN: '1h',
  CORS_ORIGINS: 'http://localhost:5173',
};

describe('environment validation', () => {
  it('accepts the authentication configuration', () => {
    expect(validate(validConfig)).toMatchObject({
      APP_ENV: 'test',
      APP_PORT: 3000,
      JWT_EXPIRES_IN: '1h',
      CORS_ORIGINS: 'http://localhost:5173',
    });
  });

  it('uses the hosting PORT when APP_PORT is not defined', () => {
    expect(
      validate({ ...validConfig, APP_PORT: undefined, PORT: '8080' }),
    ).toMatchObject({ APP_PORT: 8080 });
  });

  it('prefers APP_PORT over the hosting PORT', () => {
    expect(validate({ ...validConfig, PORT: '8080' })).toMatchObject({
      APP_PORT: 3000,
    });
  });

  it('uses port 3000 only when neither port variable is defined', () => {
    expect(
      validate({ ...validConfig, APP_PORT: undefined, PORT: undefined }),
    ).toMatchObject({ APP_PORT: 3000 });
  });

  it('rejects an invalid hosting PORT', () => {
    expect(() =>
      validate({ ...validConfig, APP_PORT: undefined, PORT: 'invalid' }),
    ).toThrow('APP_PORT deve ser um número entre 1 e 65535');
  });

  it('rejects a missing JWT secret', () => {
    expect(() =>
      validate({ ...validConfig, JWT_SECRET: undefined }),
    ).toThrow('JWT_SECRET deve possuir pelo menos 32 caracteres');
  });

  it('rejects the example JWT secret placeholder', () => {
    expect(() =>
      validate({
        ...validConfig,
        JWT_SECRET: 'replace-with-at-least-32-random-characters',
      }),
    ).toThrow('JWT_SECRET deve possuir pelo menos 32 caracteres');
  });

  it('rejects an invalid JWT expiration', () => {
    expect(() =>
      validate({ ...validConfig, JWT_EXPIRES_IN: 'never' }),
    ).toThrow('JWT_EXPIRES_IN deve usar um valor');
  });

  it('normalizes multiple CORS origins', () => {
    expect(
      validate({
        ...validConfig,
        CORS_ORIGINS: 'http://localhost:5173, https://app.example.com/',
      }),
    ).toMatchObject({
      CORS_ORIGINS: 'http://localhost:5173,https://app.example.com',
    });
  });

  it('rejects an invalid CORS origin', () => {
    expect(() =>
      validate({ ...validConfig, CORS_ORIGINS: '*' }),
    ).toThrow('Origem CORS inválida');
  });
});
