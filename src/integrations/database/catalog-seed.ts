import { randomUUID } from 'node:crypto';
import type { DataSource, ObjectLiteral } from 'typeorm';
import { Achievement } from './entities/catalogs/achievement.entity';
import { DailyMission } from './entities/catalogs/daily-mission.entity';
import { CosmeticItem } from './entities/catalogs/cosmetic-item.entity';
import { CosmeticType } from './entities/enums';

export async function seedCatalogs(source: DataSource): Promise<void> {
  const achievements = [
    {
      code: 'FIRST_MEAL',
      title: 'Primeiro Prato',
      description: 'Registrou a primeira refeição no app.',
    },
    {
      code: 'STREAK_3',
      title: '3 Dias no Foco',
      description: 'Manteve 3 dias seguidos de dieta.',
    },
    {
      code: 'STREAK_7',
      title: 'Monstro Sagrado',
      description: 'Manteve 7 dias seguidos de dieta.',
    },
    {
      code: 'PHOTO_MASTER',
      title: 'Olho Clínico',
      description: 'Registrou 5 refeições usando foto do prato.',
    },
  ];

  const dailyMissions = [
    {
      code: 'LOG_THREE_MEALS',
      title: 'Registrar 3 refeições hoje',
      targetCount: 3,
      pointsReward: 15,
    },
    {
      code: 'HIT_PROTEIN_TARGET',
      title: 'Bater a meta diária de proteína',
      targetCount: 1,
      pointsReward: 30,
    },
    {
      code: 'REACT_TO_FRIEND_POST',
      title: 'Reagir ao post de um amigo no feed',
      targetCount: 1,
      pointsReward: 5,
    },
  ];

  const cosmeticItems = [
    {
      code: 'CARB_MASTER_TAG',
      name: 'Mestre do Carbo',
      type: CosmeticType.TAG,
      price: 100,
      assetUrl: 'tag_carbo_master',
    },
    {
      code: 'GYM_CHICKEN_TAG',
      name: 'Frango de Academia',
      type: CosmeticType.TAG,
      price: 50,
      assetUrl: 'tag_frango',
    },
    {
      code: 'LEGENDARY_PURPLE_FRAME',
      name: 'Borda Roxa Lendária',
      type: CosmeticType.FRAME,
      price: 250,
      assetUrl: 'frame_purple_legend',
    },
  ];
  await source.transaction(async (manager) => {
    await manager.query(
      "SELECT pg_advisory_xact_lock(hashtext('macromaniacs-catalog-seed'))",
    );
    for (const [target, records] of [
      [Achievement, achievements],
      [DailyMission, dailyMissions],
      [CosmeticItem, cosmeticItems],
    ] as const) {
      const repository = manager.getRepository<ObjectLiteral>(target);
      for (const record of records) {
        const existing = await repository.findOneBy({ code: record.code });
        await repository.save(
          repository.create({
            ...existing,
            ...record,
            id: existing?.id ?? randomUUID(),
          }),
        );
      }
    }
  });
}
