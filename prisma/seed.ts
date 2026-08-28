import { PrismaClient, CosmeticType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.achievement.createMany({
    skipDuplicates: true,
    data: [
      { code: 'FIRST_MEAL', title: 'Primeiro Prato', description: 'Registrou a primeira refeição no app.' },
      { code: 'STREAK_3', title: '3 Dias no Foco', description: 'Manteve 3 dias seguidos de dieta.' },
      { code: 'STREAK_7', title: 'Monstro Sagrado', description: 'Manteve 7 dias seguidos de dieta.' },
      { code: 'PHOTO_MASTER', title: 'Olho Clínico', description: 'Registrou 5 refeições usando foto do prato.' },
    ],
  });

  await prisma.dailyMission.createMany({
    skipDuplicates: true,
    data: [
      { title: 'Registrar 3 refeições hoje', targetCount: 3, pointsReward: 15 },
      { title: 'Bater a meta diária de proteína', targetCount: 1, pointsReward: 30 },
      { title: 'Reagir ao post de um amigo no feed', targetCount: 1, pointsReward: 5 },
    ],
  });

  await prisma.cosmeticItem.createMany({
    skipDuplicates: true,
    data: [
      { name: 'Mestre do Carbo', type: CosmeticType.TAG, price: 100, assetUrl: 'tag_carbo_master' },
      { name: 'Frango de Academia', type: CosmeticType.TAG, price: 50, assetUrl: 'tag_frango' },
      { name: 'Borda Roxa Lendária', type: CosmeticType.FRAME, price: 250, assetUrl: 'frame_purple_legend' },
    ],
  });

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
