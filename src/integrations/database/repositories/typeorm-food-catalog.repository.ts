import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { FoodSource } from '../entities/enums';
import { Food } from '../entities/nutrition/food.entity';
import { DuplicateFoodBarcodeError } from '../../../modules/food-products/domain/food-catalog';
import type {
  FoodCatalogRepository,
  FoodRecord,
  ManualFood,
} from '../../../modules/food-products/domain/food-catalog';
import type {
  FoodProviderSource,
  NormalizedFood,
} from '../../../modules/food-products/domain/food-provider';

type PostgresDriverError = { code?: string; constraint?: string };

@Injectable()
export class TypeOrmFoodCatalogRepository implements FoodCatalogRepository {
  constructor(
    @InjectRepository(Food)
    private readonly foods: Repository<Food>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async findByBarcode(barcode: string): Promise<FoodRecord | null> {
    return this.toRecordOrNull(await this.foods.findOneBy({ barcode }));
  }

  async findByExternalIdentity(
    source: FoodProviderSource,
    externalId: string,
  ): Promise<FoodRecord | null> {
    return this.toRecordOrNull(
      await this.foods.findOneBy({ source, externalId }),
    );
  }

  async saveExternal(input: NormalizedFood): Promise<FoodRecord> {
    try {
      return await this.dataSource.transaction(async (manager) => {
        const repository = manager.getRepository(Food);
        const existing = await repository.findOneBy({
          source: input.source,
          externalId: input.externalId,
        });

        if (existing) {
          this.assignExternal(existing, input);
          return this.toRecord(await repository.save(existing));
        }

        if (input.barcode) {
          const sameBarcode = await repository.findOneBy({
            barcode: input.barcode,
          });
          if (sameBarcode) return this.toRecord(sameBarcode);
        }

        const food = repository.create({
          source: input.source,
          externalId: input.externalId,
        });
        this.assignExternal(food, input);
        return this.toRecord(await repository.save(food));
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const concurrent =
          (await this.findByExternalIdentity(input.source, input.externalId)) ??
          (input.barcode ? await this.findByBarcode(input.barcode) : null);
        if (concurrent) return concurrent;
      }
      throw error;
    }
  }

  async createManual(input: ManualFood): Promise<FoodRecord> {
    try {
      return this.toRecord(
        await this.foods.save(
          this.foods.create({
            ...input,
            source: FoodSource.MANUAL,
            externalId: null,
          }),
        ),
      );
    } catch (error) {
      if (input.barcode && this.isUniqueViolation(error)) {
        throw new DuplicateFoodBarcodeError(input.barcode);
      }
      throw error;
    }
  }

  private assignExternal(entity: Food, input: NormalizedFood): void {
    entity.name = input.name;
    entity.barcode = input.barcode;
    entity.caloriesPer100g = input.caloriesPer100g;
    entity.proteinPer100g = input.proteinPer100g;
    entity.carbsPer100g = input.carbsPer100g;
    entity.fatPer100g = input.fatPer100g;
    entity.fiberPer100g = input.fiberPer100g;
    entity.servingSizeG = input.servingSizeG;
  }

  private toRecordOrNull(entity: Food | null): FoodRecord | null {
    return entity ? this.toRecord(entity) : null;
  }

  private toRecord(entity: Food): FoodRecord {
    return {
      id: entity.id,
      name: entity.name,
      source: entity.source,
      externalId: entity.externalId,
      barcode: entity.barcode,
      caloriesPer100g: String(entity.caloriesPer100g),
      proteinPer100g: String(entity.proteinPer100g),
      carbsPer100g: String(entity.carbsPer100g),
      fatPer100g: String(entity.fatPer100g),
      fiberPer100g: String(entity.fiberPer100g),
      servingSizeG: String(entity.servingSizeG),
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error.driverError as PostgresDriverError).code === '23505'
    );
  }
}
