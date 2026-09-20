import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { UserProfile } from '../auth/entities/user-profile.entity';
import { User } from '../auth/entities/user.entity';
import type { UpdateMyProfileDto } from './dto/update-my-profile.dto';
import type {
  BodyMeasurementResponseDto,
  MyProfileResponseDto,
  NutritionMetricsResponseDto,
} from './dto/user-profile-response.dto';
import { BodyMeasurement } from './entities/body-measurement.entity';
import { UserStat } from './entities/user-stat.entity';
import {
  NutritionCalculatorService,
  type NutritionCalculation,
} from './nutrition-calculator.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(BodyMeasurement)
    private readonly measurements: Repository<BodyMeasurement>,
    @InjectRepository(UserStat)
    private readonly stats: Repository<UserStat>,
    private readonly dataSource: DataSource,
    private readonly calculator: NutritionCalculatorService,
  ) {}

  async getMe(userId: string): Promise<MyProfileResponseDto> {
    const user = await this.users.findOne({
      where: { id: userId },
      relations: { profile: true },
    });

    if (!user?.profile) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const [measurements, latestStat] = await Promise.all([
      this.measurements.find({
        where: { userId },
        order: { measuredAt: 'DESC', createdAt: 'DESC' },
      }),
      this.stats.findOne({
        where: { userId },
        order: { statDate: 'DESC', updatedAt: 'DESC' },
      }),
    ]);

    return this.toResponse(user, user.profile, measurements, latestStat);
  }

  async updateMe(
    userId: string,
    dto: UpdateMyProfileDto,
  ): Promise<MyProfileResponseDto> {
    await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId },
        relations: { profile: true },
      });

      if (!user?.profile) {
        throw new UnauthorizedException('Invalid or expired token');
      }

      if (dto.username && dto.username !== user.username) {
        const duplicate = await manager.findOneBy(User, {
          username: dto.username,
        });

        if (duplicate) {
          throw new ConflictException('username already exists');
        }

        user.username = dto.username;
        await manager.save(User, user);
      }

      const profile = user.profile;
      this.applyProfilePatch(profile, dto);
      this.validateGoalDetails(profile.targetWeightKg, profile.targetDate);

      if (profile.dateOfBirth) {
        this.calculator.calculateAge(profile.dateOfBirth);
      }

      let currentMeasurement = await manager.findOne(BodyMeasurement, {
        where: { userId },
        order: { measuredAt: 'DESC', createdAt: 'DESC' },
      });

      if (dto.heightCm !== undefined || dto.currentWeightKg !== undefined) {
        const heightCm = dto.heightCm ?? currentMeasurement?.heightCm;
        const weightKg = dto.currentWeightKg ?? currentMeasurement?.weightKg;

        if (heightCm === undefined || weightKg === undefined) {
          throw new BadRequestException(
            'heightCm and currentWeightKg are required for the first measurement',
          );
        }

        if (
          !currentMeasurement ||
          currentMeasurement.heightCm !== heightCm ||
          currentMeasurement.weightKg !== weightKg
        ) {
          currentMeasurement = await manager.save(
            BodyMeasurement,
            manager.create(BodyMeasurement, {
              userId,
              heightCm,
              weightKg,
              measuredAt: new Date(),
            }),
          );
        }
      }

      const complete = this.isProfileComplete(profile, currentMeasurement);
      profile.onboardingCompleted = complete;
      profile.onboardingCompletedAt = complete
        ? (profile.onboardingCompletedAt ?? new Date())
        : null;
      await manager.save(UserProfile, profile);

      if (complete && currentMeasurement) {
        const calculation = this.calculator.calculate({
          dateOfBirth: profile.dateOfBirth!,
          biologicalSex: profile.biologicalSex!,
          heightCm: currentMeasurement.heightCm,
          currentWeightKg: currentMeasurement.weightKg,
          goal: profile.goal!,
          activityLevel: profile.activityLevel!,
          targetWeightKg: profile.targetWeightKg,
          targetDate: profile.targetDate,
        });
        await this.saveTodayStats(manager, userId, calculation);
      }
    });

    return this.getMe(userId);
  }

  private applyProfilePatch(
    profile: UserProfile,
    dto: UpdateMyProfileDto,
  ): void {
    if (dto.displayName !== undefined) profile.displayName = dto.displayName;
    if (dto.dateOfBirth !== undefined) profile.dateOfBirth = dto.dateOfBirth;
    if (dto.biologicalSex !== undefined) {
      profile.biologicalSex = dto.biologicalSex;
    }
    if (dto.goal !== undefined) profile.goal = dto.goal;
    if (dto.activityLevel !== undefined) {
      profile.activityLevel = dto.activityLevel;
    }
    if (dto.targetWeightKg !== undefined) {
      profile.targetWeightKg = dto.targetWeightKg;
    }
    if (dto.targetDate !== undefined) profile.targetDate = dto.targetDate;
    if (dto.dietaryRestrictions !== undefined) {
      profile.dietaryRestrictions = dto.dietaryRestrictions;
    }
  }

  private validateGoalDetails(
    targetWeightKg: number | null,
    targetDate: string | null,
  ): void {
    if ((targetWeightKg === null) !== (targetDate === null)) {
      throw new BadRequestException(
        'targetWeightKg and targetDate must be provided together',
      );
    }
  }

  private isProfileComplete(
    profile: UserProfile,
    measurement: BodyMeasurement | null,
  ): boolean {
    return Boolean(
      profile.displayName &&
        profile.dateOfBirth &&
        profile.biologicalSex &&
        profile.goal &&
        profile.activityLevel &&
        measurement,
    );
  }

  private async saveTodayStats(
    manager: EntityManager,
    userId: string,
    calculation: NutritionCalculation,
  ): Promise<void> {
    const statDate = new Date().toISOString().slice(0, 10);
    const existing = await manager.findOneBy(UserStat, { userId, statDate });
    const stat = existing ?? manager.create(UserStat, { userId, statDate });

    Object.assign(stat, calculation);
    await manager.save(UserStat, stat);
  }

  private toResponse(
    user: User,
    profile: UserProfile,
    measurements: BodyMeasurement[],
    latestStat: UserStat | null,
  ): MyProfileResponseDto {
    const measurementResponses = measurements.map((measurement) =>
      this.toMeasurementResponse(measurement),
    );
    const nutrition =
      profile.onboardingCompleted && latestStat
        ? this.toNutritionResponse(latestStat)
        : null;

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: profile.displayName,
      dateOfBirth: profile.dateOfBirth,
      biologicalSex: profile.biologicalSex,
      goal: profile.goal,
      activityLevel: profile.activityLevel,
      targetWeightKg: profile.targetWeightKg,
      targetDate: profile.targetDate,
      dietaryRestrictions: profile.dietaryRestrictions,
      onboardingCompleted: profile.onboardingCompleted,
      onboardingCompletedAt: profile.onboardingCompletedAt?.toISOString() ?? null,
      currentMeasurement: measurementResponses[0] ?? null,
      measurements: measurementResponses,
      nutrition,
    };
  }

  private toMeasurementResponse(
    measurement: BodyMeasurement,
  ): BodyMeasurementResponseDto {
    return {
      id: measurement.id,
      heightCm: measurement.heightCm,
      weightKg: measurement.weightKg,
      measuredAt: measurement.measuredAt.toISOString(),
    };
  }

  private toNutritionResponse(stat: UserStat): NutritionMetricsResponseDto {
    return {
      ageYears: stat.ageYears,
      bmrKcalPerDay: stat.bmrKcalPerDay,
      tdeeKcalPerDay: stat.tdeeKcalPerDay,
      calorieTargetKcalPerDay: stat.calorieTargetKcalPerDay,
      calculatedAt: stat.updatedAt.toISOString(),
    };
  }
}
