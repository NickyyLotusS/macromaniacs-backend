import { SetMetadata } from '@nestjs/common';

export const OWNER_PARAM = 'auth:owner-param';

export const OwnerParam = (
  parameterName: string,
): MethodDecorator & ClassDecorator => SetMetadata(OWNER_PARAM, parameterName);
