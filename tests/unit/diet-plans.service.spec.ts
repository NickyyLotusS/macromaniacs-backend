import { BadRequestException } from '@nestjs/common';
import { jest } from '@jest/globals';
import type { DataSource, EntityManager, Repository } from 'typeorm';
import { DietPlanStatus } from '../../src/integrations/database/entities/enums';
import { DietPlan } from '../../src/integrations/database/entities/nutrition/diet-plan.entity';
import { DietPlansService } from '../../src/modules/diet-plans/diet-plans.service';

describe('DietPlansService', () => {
  const userId = '10000000-0000-4000-8000-000000000001';
  const now = new Date('2026-10-18T12:00:00.000Z');
  const plan = (overrides: Partial<DietPlan> = {}): DietPlan =>
    Object.assign(new DietPlan(), {
      id: '20000000-0000-4000-8000-000000000001',
      userId,
      title: 'Plano',
      status: DietPlanStatus.DRAFT,
      targetCalories: 2200,
      targetProtein: '150.00',
      targetCarbs: '250.00',
      targetFat: '70.00',
      targetFiber: '30.00',
      startDate: '2026-10-20',
      endDate: '2026-11-20',
      createdAt: now,
      updatedAt: now,
      ...overrides,
    });

  const repository = () =>
    ({
      create: jest.fn((value) => plan(value as Partial<DietPlan>)),
      save: jest.fn(async (value) => value),
      findOneBy: jest.fn(),
      findAndCount: jest.fn(),
    }) as unknown as jest.Mocked<Repository<DietPlan>>;

  it('cria sempre como rascunho e formata metas decimais', async () => {
    const plans = repository();
    const service = new DietPlansService(plans, {} as DataSource);

    const result = await service.create(userId, {
      title: 'Plano',
      targetCalories: 2200,
      targetProtein: 150,
      targetCarbs: 250.5,
      targetFat: 70,
      targetFiber: 30,
      startDate: '2026-10-20',
      endDate: '2026-11-20',
    });

    expect(result.status).toBe(DietPlanStatus.DRAFT);
    expect(plans.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: DietPlanStatus.DRAFT,
        targetProtein: '150.00',
        targetCarbs: '250.50',
      }),
    );
  });

  it.each([
    ['2026-02-30', '2026-03-20'],
    ['2026-11-20', '2026-10-20'],
  ])('rejeita período inválido %s a %s', async (startDate, endDate) => {
    const plans = repository();
    const service = new DietPlansService(plans, {} as DataSource);

    await expect(
      service.create(userId, {
        title: 'Plano',
        targetCalories: 2200,
        targetProtein: 150,
        targetCarbs: 250,
        targetFat: 70,
        targetFiber: 30,
        startDate,
        endDate,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(plans.save).not.toHaveBeenCalled();
  });

  it('arquiva todos os ativos anteriores dentro da mesma transação', async () => {
    const plans = repository();
    const previous = plan({ status: DietPlanStatus.ACTIVE });
    const target = plan({
      id: '20000000-0000-4000-8000-000000000002',
      status: DietPlanStatus.DRAFT,
    });
    const save = jest.fn(async (value: DietPlan[]) => value);
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest.fn(async () => [previous, target]),
    };
    const dataSource = {
      transaction: jest.fn(
        async (work: (manager: EntityManager) => Promise<unknown>) =>
          work({
            getRepository: () => ({
              createQueryBuilder: () => queryBuilder,
              save,
            }),
          } as unknown as EntityManager),
      ),
    } as unknown as DataSource;
    const service = new DietPlansService(plans, dataSource);

    const result = await service.activate(userId, target.id);

    expect(queryBuilder.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(previous.status).toBe(DietPlanStatus.ARCHIVED);
    expect(result.status).toBe(DietPlanStatus.ACTIVE);
    expect(save).toHaveBeenCalledWith([previous, target]);
  });
});
