import { SetMetadata } from '@nestjs/common';

export const REQUIRED_ROLES = 'auth:required-roles';

export const Roles = (...roles: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_ROLES, roles);
