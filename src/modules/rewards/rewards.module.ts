import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CosmeticItem } from '../../integrations/database/entities/catalogs/cosmetic-item.entity';
import { PointTransaction } from '../../integrations/database/entities/gamification/point-transaction.entity';
import { UserCosmetic } from '../../integrations/database/entities/gamification/user-cosmetic.entity';
import { UserStats } from '../../integrations/database/entities/gamification/user-stats.entity';
import { AuthModule } from '../auth/auth.module';
import { GamificationModule } from '../gamification/gamification.module';
import { RewardsController } from './rewards.controller';
import { RewardsService } from './rewards.service';

@Module({
  imports: [
    AuthModule,
    GamificationModule,
    TypeOrmModule.forFeature([
      CosmeticItem,
      PointTransaction,
      UserCosmetic,
      UserStats,
    ]),
  ],
  controllers: [RewardsController],
  providers: [RewardsService],
})
export class RewardsModule {}
