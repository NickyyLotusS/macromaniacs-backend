export const SCORING_RULES_V1 = {
  version: '2026-11-v1',
  mealLogPoints: 5,
  maxAwardedMealsPerFoodDate: 3,
  achievementPoints: {
    FIRST_MEAL: 10,
    STREAK_3: 25,
    STREAK_7: 75,
  } as Readonly<Record<string, number>>,
} as const;
