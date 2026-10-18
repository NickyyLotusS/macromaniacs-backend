import { PrismaClient, CosmeticType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
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

  await prisma.$transaction([
    ...achievements.map((achievement) =>
      prisma.achievement.upsert({
        where: { code: achievement.code },
        update: achievement,
        create: achievement,
      }),
    ),
    ...dailyMissions.map((mission) =>
      prisma.dailyMission.upsert({
        where: { code: mission.code },
        update: mission,
        create: mission,
      }),
    ),
    ...cosmeticItems.map((item) =>
      prisma.cosmeticItem.upsert({
        where: { code: item.code },
        update: item,
        create: item,
      }),
    ),
  ]);

  console.log('Seed executado com sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
