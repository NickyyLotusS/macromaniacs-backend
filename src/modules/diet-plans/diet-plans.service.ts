import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DietPlanStatus } from '../../integrations/database/entities/enums';
import { DietPlan } from '../../integrations/database/entities/nutrition/diet-plan.entity';
import {
  paginationMeta,
  SortDirection,
} from '../../shared/http/pagination.dto';
import type { CreateDietPlanDto } from './dto/create-diet-plan.dto';
import { DietPlanResponseDto } from './dto/diet-plan-response.dto';
import type { DietPlanListResponseDto } from './dto/diet-plan-response.dto';
import type {
  DietPlanSortField,
  ListDietPlansQueryDto,
} from './dto/list-diet-plans-query.dto';
import type { UpdateDietPlanDto } from './dto/update-diet-plan.dto';

const orderFields: Readonly<Record<DietPlanSortField, keyof DietPlan>> = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  title: 'title',
  status: 'status',
};

@Injectable()
export class DietPlansService {
  constructor(
    @InjectRepository(DietPlan)
    private readonly plans: Repository<DietPlan>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    userId: string,
    dto: CreateDietPlanDto,
  ): Promise<DietPlanResponseDto> {
    this.validateDateRange(dto.startDate ?? null, dto.endDate ?? null);
    const plan = this.plans.create({
      userId,
      title: dto.title,
      status: DietPlanStatus.DRAFT,
      targetCalories: dto.targetCalories,
      targetProtein: this.decimal(dto.targetProtein),
      targetCarbs: this.decimal(dto.targetCarbs),
      targetFat: this.decimal(dto.targetFat),
      targetFiber: this.decimal(dto.targetFiber),
      startDate: dto.startDate ?? null,
      endDate: dto.endDate ?? null,
    });
    return DietPlanResponseDto.from(await this.plans.save(plan));
  }

  async list(
    userId: string,
    query: ListDietPlansQueryDto,
  ): Promise<DietPlanListResponseDto> {
    const sortBy = query.sortBy ?? 'createdAt';
    const [plans, total] = await this.plans.findAndCount({
      where: { userId, ...(query.status ? { status: query.status } : {}) },
      order: {
        [orderFields[sortBy]]:
          query.sortDirection === SortDirection.ASC ? 'ASC' : 'DESC',
      },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });

    return {
      items: plans.map(DietPlanResponseDto.from),
      meta: paginationMeta(total, query),
    };
  }

  async get(userId: string, planId: string): Promise<DietPlanResponseDto> {
    return DietPlanResponseDto.from(await this.ownedPlan(userId, planId));
  }

  async update(
    userId: string,
    planId: string,
    dto: UpdateDietPlanDto,
  ): Promise<DietPlanResponseDto> {
    const plan = await this.ownedPlan(userId, planId);
    if (dto.title !== undefined) plan.title = dto.title;
    if (dto.targetCalories !== undefined) {
      plan.targetCalories = dto.targetCalories;
    }
    if (dto.targetProtein !== undefined) {
      plan.targetProtein = this.decimal(dto.targetProtein);
    }
    if (dto.targetCarbs !== undefined) {
      plan.targetCarbs = this.decimal(dto.targetCarbs);
    }
    if (dto.targetFat !== undefined) {
      plan.targetFat = this.decimal(dto.targetFat);
    }
    if (dto.targetFiber !== undefined) {
      plan.targetFiber = this.decimal(dto.targetFiber);
    }
    if (dto.startDate !== undefined) plan.startDate = dto.startDate;
    if (dto.endDate !== undefined) plan.endDate = dto.endDate;

    this.validateDateRange(plan.startDate, plan.endDate);
    return DietPlanResponseDto.from(await this.plans.save(plan));
  }

  async activate(userId: string, planId: string): Promise<DietPlanResponseDto> {
    const activated = await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(DietPlan);
      const userPlans = await repository
        .createQueryBuilder('plan')
        .where('plan.userId = :userId', { userId })
        .setLock('pessimistic_write')
        .getMany();
      const target = userPlans.find((plan) => plan.id === planId);

      if (!target) throw new NotFoundException('Diet plan not found');

      const changed: DietPlan[] = [];
      for (const plan of userPlans) {
        if (plan.id !== planId && plan.status === DietPlanStatus.ACTIVE) {
          plan.status = DietPlanStatus.ARCHIVED;
          changed.push(plan);
        }
      }
      if (target.status !== DietPlanStatus.ACTIVE) {
        target.status = DietPlanStatus.ACTIVE;
        changed.push(target);
      }
      if (changed.length > 0) await repository.save(changed);
      return target;
    });

    return DietPlanResponseDto.from(activated);
  }

  private async ownedPlan(userId: string, planId: string): Promise<DietPlan> {
    const plan = await this.plans.findOneBy({ id: planId, userId });
    if (!plan) throw new NotFoundException('Diet plan not found');
    return plan;
  }

  private validateDateRange(
    startDate: string | null,
    endDate: string | null,
  ): void {
    if (startDate) this.validateDate(startDate, 'startDate');
    if (endDate) this.validateDate(endDate, 'endDate');
    if (startDate && endDate && endDate < startDate) {
      throw new BadRequestException('endDate must be on or after startDate');
    }
  }

  private validateDate(value: string, field: string): void {
    const [year, month, day] = value.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      throw new BadRequestException(`${field} must be a valid date`);
    }
  }

  private decimal(value: number): string {
    return value.toFixed(2);
  }
}
