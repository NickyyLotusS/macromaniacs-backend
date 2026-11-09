import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CosmeticItem } from '../../integrations/database/entities/catalogs/cosmetic-item.entity';
import { PointTransactionReason } from '../../integrations/database/entities/enums';
import { PointTransaction } from '../../integrations/database/entities/gamification/point-transaction.entity';
import { UserCosmetic } from '../../integrations/database/entities/gamification/user-cosmetic.entity';
import { UserStats } from '../../integrations/database/entities/gamification/user-stats.entity';
import { GamificationService } from '../gamification/gamification.service';
import type {
  InventoryItemDto,
  PointsBalanceDto,
  PurchaseResponseDto,
  RewardItemDto,
} from './dto/reward-response.dto';

@Injectable()
export class RewardsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CosmeticItem)
    private readonly catalog: Repository<CosmeticItem>,
    @InjectRepository(UserCosmetic)
    private readonly userCosmetics: Repository<UserCosmetic>,
    @InjectRepository(PointTransaction)
    private readonly transactions: Repository<PointTransaction>,
    private readonly gamification: GamificationService,
  ) {}

  async listCatalog(): Promise<RewardItemDto[]> {
    const items = await this.catalog.find({
      where: { isActive: true },
      order: { price: 'ASC', code: 'ASC' },
    });
    return items.map(this.toReward);
  }

  async balance(userId: string): Promise<PointsBalanceDto> {
    await this.gamification.processPendingForUser(userId);
    return { balance: await this.sumBalance(userId) };
  }

  async inventory(userId: string): Promise<InventoryItemDto[]> {
    const rows = await this.userCosmetics.find({
      where: { userId },
      relations: { cosmeticItem: true },
      order: { acquiredAt: 'DESC' },
    });
    return rows.map((row) => this.toInventory(row));
  }

  async purchase(
    userId: string,
    itemId: string,
    idempotencyValue: string | undefined,
  ): Promise<PurchaseResponseDto> {
    const suppliedKey = idempotencyValue?.trim();
    if (!suppliedKey || suppliedKey.length > 110) {
      throw new BadRequestException(
        'Idempotency-Key header is required and must contain at most 110 characters',
      );
    }
    await this.gamification.processPendingForUser(userId);
    const key = `purchase:${suppliedKey}`;
    await this.dataSource.transaction(async (manager) => {
      const previous = await manager.findOneBy(PointTransaction, {
        userId,
        idempotencyKey: key,
      });
      if (previous) {
        if (previous.metadata.itemId !== itemId) {
          throw new ConflictException(
            'Idempotency-Key was already used for another purchase',
          );
        }
        return;
      }
      const item = await manager.findOneBy(CosmeticItem, {
        id: itemId,
        isActive: true,
      });
      if (!item) throw new NotFoundException('Reward item not found');
      const stats = await manager
        .getRepository(UserStats)
        .createQueryBuilder('stats')
        .setLock('pessimistic_write')
        .where('stats.userId = :userId', { userId })
        .getOneOrFail();
      const existing = await manager.findOneBy(UserCosmetic, {
        userId,
        cosmeticItemId: item.id,
      });
      if (existing) throw new ConflictException('Reward item already owned');
      const balance = Number(
        (await manager.getRepository(PointTransaction).sum('amount', {
          userId,
        })) ?? 0,
      );
      if (balance < item.price) {
        throw new ConflictException('Insufficient points balance');
      }
      await manager.save(
        PointTransaction,
        manager.create(PointTransaction, {
          userId,
          amount: -item.price,
          reason: PointTransactionReason.COSMETIC_PURCHASE,
          metadata: { itemId: item.id, code: item.code },
          idempotencyKey: key,
          sourceType: 'cosmetic_item',
          sourceId: item.id,
        }),
      );
      await manager.save(
        UserCosmetic,
        manager.create(UserCosmetic, {
          userId,
          cosmeticItemId: item.id,
          acquiredAt: new Date(),
          isEquipped: false,
        }),
      );
      stats.totalPoints = balance - item.price;
      await manager.save(UserStats, stats);
    });
    const owned = await this.userCosmetics.findOne({
      where: { userId, cosmeticItemId: itemId },
      relations: { cosmeticItem: true },
    });
    if (!owned) throw new ConflictException('Purchase was not completed');
    return {
      item: this.toInventory(owned),
      balance: await this.sumBalance(userId),
    };
  }

  async equip(userId: string, itemId: string): Promise<InventoryItemDto> {
    await this.dataSource.transaction(async (manager) => {
      const selected = await manager.findOne(UserCosmetic, {
        where: { userId, cosmeticItemId: itemId },
        relations: { cosmeticItem: true },
      });
      if (!selected) throw new NotFoundException('Inventory item not found');
      const inventory = await manager.find(UserCosmetic, {
        where: { userId },
        relations: { cosmeticItem: true },
      });
      for (const row of inventory) {
        if (row.cosmeticItem.type === selected.cosmeticItem.type) {
          row.isEquipped = row.cosmeticItemId === itemId;
        }
      }
      await manager.save(UserCosmetic, inventory);
    });
    const equipped = await this.userCosmetics.findOne({
      where: { userId, cosmeticItemId: itemId },
      relations: { cosmeticItem: true },
    });
    if (!equipped) throw new NotFoundException('Inventory item not found');
    return this.toInventory(equipped);
  }

  private async sumBalance(userId: string): Promise<number> {
    return Number((await this.transactions.sum('amount', { userId })) ?? 0);
  }

  private readonly toReward = (item: CosmeticItem): RewardItemDto => ({
    id: item.id,
    code: item.code,
    name: item.name,
    description: item.description,
    type: item.type,
    price: item.price,
    assetUrl: item.assetUrl,
  });

  private toInventory(row: UserCosmetic): InventoryItemDto {
    return {
      ...this.toReward(row.cosmeticItem),
      acquiredAt: row.acquiredAt.toISOString(),
      isEquipped: row.isEquipped,
    };
  }
}
