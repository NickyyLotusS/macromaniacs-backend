process.env.APP_ENV = 'test';
process.env.APP_PORT = '3001';
process.env.DATABASE_URL =
  'postgresql://user:password@localhost:5433/macromaniacs_test';
process.env.JWT_SECRET = 'test-only-jwt-secret-with-at-least-32-characters';
process.env.JWT_EXPIRES_IN = '1h';
