import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { OWNER_PARAM } from '../decorators/owner-param.decorator';
import type { AuthenticatedUser } from '../interfaces/authenticated-user';

type OwnedRequest = Request & {
  user?: AuthenticatedUser;
  params: Record<string, string>;
};

@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const ownerParameter = this.reflector.getAllAndOverride<string>(
      OWNER_PARAM,
      [context.getHandler(), context.getClass()],
    );
    if (!ownerParameter) return true;

    const request = context.switchToHttp().getRequest<OwnedRequest>();
    if (!request.user) {
      throw new UnauthorizedException('Authentication required');
    }
    if (request.params[ownerParameter] !== request.user.userId) {
      throw new ForbiddenException('Resource belongs to another user');
    }
    return true;
  }
}
