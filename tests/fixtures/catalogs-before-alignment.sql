-- Equivalente SQL do seed histórico: dados conhecidos antes dos códigos novos.
INSERT INTO achievements(id,code,title,description) VALUES
 ('90000000-0000-0000-0000-000000000001','FIRST_MEAL','Primeiro Prato','Registrou a primeira refeição no app.'),
 ('90000000-0000-0000-0000-000000000002','STREAK_3','3 Dias no Foco','Manteve 3 dias seguidos de dieta.'),
 ('90000000-0000-0000-0000-000000000003','STREAK_7','Monstro Sagrado','Manteve 7 dias seguidos de dieta.'),
 ('90000000-0000-0000-0000-000000000004','PHOTO_MASTER','Olho Clínico','Registrou 5 refeições usando foto do prato.');
INSERT INTO daily_missions(id,title,target_count,points_reward) VALUES
 ('91000000-0000-0000-0000-000000000001','Registrar 3 refeições hoje',3,15),
 ('91000000-0000-0000-0000-000000000002','Bater a meta diária de proteína',1,30),
 ('91000000-0000-0000-0000-000000000003','Reagir ao post de um amigo no feed',1,5);
INSERT INTO cosmetic_items(id,name,type,price,asset_url) VALUES
 ('92000000-0000-0000-0000-000000000001','Mestre do Carbo','TAG',100,'tag_carbo_master'),
 ('92000000-0000-0000-0000-000000000002','Frango de Academia','TAG',50,'tag_frango'),
 ('92000000-0000-0000-0000-000000000003','Borda Roxa Lendária','FRAME',250,'frame_purple_legend');
