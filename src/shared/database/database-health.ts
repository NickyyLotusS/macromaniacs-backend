export const DATABASE_HEALTH = Symbol('DATABASE_HEALTH');
export interface DatabaseHealth {
  isAvailable(): Promise<boolean>;
}
