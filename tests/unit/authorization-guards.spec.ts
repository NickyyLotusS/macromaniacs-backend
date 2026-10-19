import 'reflect-metadata';
import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { jest } from '@jest/globals';
import type { Request } from 'express';
import {
  OWNER_PARAM,
  OwnerParam,
} from '../../src/modules/auth/decorators/owner-param.decorator';
import {
  REQUIRED_ROLES,
  Roles,
} from '../../src/modules/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../src/modules/auth/guards/optional-jwt-auth.guard';
import { OwnershipGuard } from '../../src/modules/auth/guards/ownership.guard';
import { RolesGuard } from '../../src/modules/auth/guards/roles.guard';

type TestRequest = Partial<Request> & {
  headers: Record<string, string | undefined>;
  params: Record<string, string>;
  user?: { userId: string; roles?: readonly string[] };
};

const context = (request: TestRequest): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
  }) as unknown as ExecutionContext;

describe('authorization guards', () => {
  it('anexa identidade e papéis de um JWT válido', async () => {
    const jwt = {
      verifyAsync: jest.fn(async () => ({ sub: 'user-1', roles: ['ADMIN'] })),
    } as unknown as JwtService;
    const request: TestRequest = {
      headers: { authorization: 'Bearer valid-token' },
      params: {},
    };

    await expect(
      new JwtAuthGuard(jwt).canActivate(context(request)),
    ).resolves.toBe(true);
    expect(request.user).toEqual({ userId: 'user-1', roles: ['ADMIN'] });
  });

  it('rejeita token inválido e ignora papéis malformados', async () => {
    const invalidJwt = {
      verifyAsync: jest.fn(async () => {
        throw new Error('invalid');
      }),
    } as unknown as JwtService;
    await expect(
      new JwtAuthGuard(invalidJwt).canActivate(
        context({
          headers: { authorization: 'Bearer invalid' },
          params: {},
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const jwt = {
      verifyAsync: jest.fn(async () => ({
        sub: 'user-1',
        roles: ['ADMIN', 7],
      })),
    } as unknown as JwtService;
    const request: TestRequest = {
      headers: { authorization: 'Bearer valid-token' },
      params: {},
    };
    await new JwtAuthGuard(jwt).canActivate(context(request));
    expect(request.user).toEqual({ userId: 'user-1' });
  });

  it('permite ausência de credencial no guard opcional, mas rejeita credencial enviada e inválida', async () => {
    const jwt = {
      verifyAsync: jest.fn(async () => {
        throw new Error('invalid');
      }),
    } as unknown as JwtService;
    const guard = new OptionalJwtAuthGuard(jwt);

    await expect(
      guard.canActivate(context({ headers: {}, params: {} })),
    ).resolves.toBe(true);
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
    await expect(
      guard.canActivate(
        context({ headers: { authorization: 'Bearer invalid' }, params: {} }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('autoriza quando ao menos um papel exigido está presente', () => {
    const reflector = {
      getAllAndOverride: jest.fn(() => ['ADMIN', 'SUPPORT']),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(
      guard.canActivate(
        context({
          headers: {},
          params: {},
          user: { userId: 'user-1', roles: ['SUPPORT'] },
        }),
      ),
    ).toBe(true);
    expect(() =>
      guard.canActivate(
        context({ headers: {}, params: {}, user: { userId: 'user-1' } }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('compara o parâmetro de proprietário com a identidade autenticada', () => {
    const reflector = {
      getAllAndOverride: jest.fn(() => 'userId'),
    } as unknown as Reflector;
    const guard = new OwnershipGuard(reflector);

    expect(
      guard.canActivate(
        context({
          headers: {},
          params: { userId: 'user-1' },
          user: { userId: 'user-1' },
        }),
      ),
    ).toBe(true);
    expect(() =>
      guard.canActivate(
        context({
          headers: {},
          params: { userId: 'user-2' },
          user: { userId: 'user-1' },
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('decorators publicam metadados verificáveis sem acoplar o domínio ao HTTP', () => {
    class ExampleController {
      @Roles('ADMIN')
      @OwnerParam('userId')
      action(): void {}
    }
    const reflector = new Reflector();
    expect(
      reflector.get(REQUIRED_ROLES, ExampleController.prototype.action),
    ).toEqual(['ADMIN']);
    expect(reflector.get(OWNER_PARAM, ExampleController.prototype.action)).toBe(
      'userId',
    );
  });
});
