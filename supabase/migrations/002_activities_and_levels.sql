-- ============================================================
-- 🐭 RATÓN PÉREZ — Migración 002
-- Conecta el banco de actividades y los niveles (ya usados en el
-- frontend como ACTS/LEVELS) a la base de datos.
--
-- Seguro de volver a ejecutar (idempotente): usa "code" como llave
-- natural para las actividades (on conflict do update) y "order"
-- para los niveles (where not exists).
-- Pegar en el editor SQL de Supabase y ejecutar UNA vez sobre una
-- base que ya tiene supabase/schema.sql aplicado.
-- ============================================================

-- Llave natural estable para poder re-ejecutar este script sin duplicar filas
alter table activities add column if not exists code text unique;

-- ---------- Niveles nuevos (arriba de "Maestro del Conocimiento") ----------
insert into levels ("order", name, min_xp)
select 6, 'Sabio Ratón', 3000
where not exists (select 1 from levels where "order" = 6);

insert into levels ("order", name, min_xp)
select 7, 'Leyenda del Saber', 5000
where not exists (select 1 from levels where "order" = 7);

insert into levels ("order", name, min_xp)
select 8, 'Campeón de Ratón Pérez', 8000
where not exists (select 1 from levels where "order" = 8);

-- ---------- Alinea el límite de edad con el frontend ----------
-- La app corta la franja "9-10" en 10 años (11+ pasa a la franja alta).
-- El compute_age_group original cortaba en 11; lo ajustamos para que
-- coincida exactamente con ageGroupFor() del cliente.
create or replace function compute_age_group(p_birthdate date) returns age_group_t
language sql immutable as $$
  select case
    when date_part('year', age(p_birthdate)) <= 6  then 'g1_5_6'::age_group_t
    when date_part('year', age(p_birthdate)) <= 8  then 'g2_7_8'::age_group_t
    when date_part('year', age(p_birthdate)) <= 10 then 'g3_9_11'::age_group_t
    else 'g4_12_15'::age_group_t
  end;
$$;

-- Recalcula age_group para niños ya existentes (el trigger solo corre en
-- INSERT/UPDATE; esto fuerza un UPDATE inofensivo para que se reevalúe).
update children set birthdate = birthdate;

-- ---------- Banco de actividades global (family_id null), por franja ----------
-- Mapeo de franjas del cliente -> age_group_t: 4-6=g1_5_6, 7-8=g2_7_8,
-- 9-10=g3_9_11, 11-15=g4_12_15.
insert into activities (code, family_id, category, age_group, difficulty, type, content, xp_reward, coin_reward)
values
  -- 4-6 años
  ('p1', null, 'Matemáticas', 'g1_5_6', 'easy',   'choice',   '{"q":"2 + 1","options":["2","3","4"],"correct":1}'::jsonb, 10, 3),
  ('p2', null, 'Lógica',      'g1_5_6', 'easy',   'sequence', '{"prompt":"¿Qué color sigue?","seq":["🔴","🔵","🔴","🔵","❓"],"options":["🔴","🔵","🟢"],"correct":0}'::jsonb, 10, 3),
  ('p3', null, 'Memoria',     'g1_5_6', 'easy',   'memory',   '{"pairs":["🐶","🐱"]}'::jsonb, 10, 3),
  ('p4', null, 'Lectura',     'g1_5_6', 'easy',   'choice',   '{"q":"¿Cuál es un animal?","options":["🚗 Auto","🐶 Perro","🍎 Manzana"],"correct":1}'::jsonb, 10, 3),
  ('p5', null, 'Ciencias',    'g1_5_6', 'easy',   'choice',   '{"q":"¿De qué color es el sol?","options":["Azul","Amarillo","Verde"],"correct":1}'::jsonb, 10, 3),
  ('p6', null, 'Matemáticas', 'g1_5_6', 'easy',   'choice',   '{"q":"¿Cuántas manzanas hay? 🍎🍎🍎","options":["2","3","4"],"correct":1}'::jsonb, 10, 3),

  -- 7-8 años
  ('a1', null, 'Matemáticas', 'g2_7_8', 'easy',   'choice',   '{"q":"7 + 5","options":["10","12","13"],"correct":1}'::jsonb, 15, 4),
  ('a2', null, 'Lógica',      'g2_7_8', 'medium', 'sequence', '{"prompt":"¿Qué figura sigue?","seq":["🔺","🔵","🔺","🔵","❓"],"options":["🔵","🔺","🟡"],"correct":1}'::jsonb, 25, 5),
  ('a3', null, 'Memoria',     'g2_7_8', 'medium', 'memory',   '{"pairs":["🦕","🚀","⭐"]}'::jsonb, 25, 5),
  ('a4', null, 'Lectura',     'g2_7_8', 'easy',   'choice',   '{"q":"¿Cuál es una fruta?","options":["🐶 Perro","🍎 Manzana","🚗 Auto"],"correct":1}'::jsonb, 15, 4),
  ('a5', null, 'Ciencias',    'g2_7_8', 'medium', 'choice',   '{"q":"¿Qué planeta es el nuestro?","options":["Marte","Tierra","Júpiter"],"correct":1}'::jsonb, 25, 5),
  ('a6', null, 'Matemáticas', 'g2_7_8', 'medium', 'choice',   '{"q":"15 - 6","options":["8","9","10"],"correct":1}'::jsonb, 25, 5),

  -- 9-10 años
  ('m1', null, 'Matemáticas', 'g3_9_11', 'medium', 'choice',   '{"q":"9 × 3","options":["27","21","18"],"correct":0}'::jsonb, 30, 6),
  ('m2', null, 'Lógica',      'g3_9_11', 'medium', 'sequence', '{"prompt":"¿Qué número sigue?","seq":["2","4","6","8","❓"],"options":["9","10","12"],"correct":1}'::jsonb, 30, 6),
  ('m3', null, 'Memoria',     'g3_9_11', 'medium', 'memory',   '{"pairs":["🦕","🚀","⭐","🔬"]}'::jsonb, 30, 6),
  ('m4', null, 'Lectura',     'g3_9_11', 'medium', 'choice',   '{"q":"Un tren sale a las 3pm y tarda 2 horas. ¿A qué hora llega?","options":["4pm","5pm","6pm"],"correct":1}'::jsonb, 30, 6),
  ('m5', null, 'Ciencias',    'g3_9_11', 'medium', 'choice',   '{"q":"¿Cuántos planetas tiene el sistema solar?","options":["7","8","9"],"correct":1}'::jsonb, 30, 6),
  ('m6', null, 'Matemáticas', 'g3_9_11', 'hard',   'choice',   '{"q":"12 ÷ 4","options":["3","4","6"],"correct":1}'::jsonb, 35, 7),

  -- 11-15 años
  ('h1', null, 'Matemáticas', 'g4_12_15', 'hard', 'choice',   '{"q":"(6 + 4) × 2","options":["18","20","22"],"correct":1}'::jsonb, 50, 8),
  ('h2', null, 'Lógica',      'g4_12_15', 'hard', 'sequence', '{"prompt":"¿Qué número sigue? (Fibonacci)","seq":["1","1","2","3","5","❓"],"options":["7","8","9"],"correct":1}'::jsonb, 50, 8),
  ('h3', null, 'Memoria',     'g4_12_15', 'hard', 'memory',   '{"pairs":["🦕","🚀","⭐","🔬","🎨","🎵"]}'::jsonb, 50, 8),
  ('h4', null, 'Lectura',     'g4_12_15', 'hard', 'choice',   '{"q":"Un libro cuesta $15 con 20% de descuento. ¿Cuánto cuesta ahora?","options":["$10","$12","$13"],"correct":1}'::jsonb, 50, 8),
  ('h5', null, 'Ciencias',    'g4_12_15', 'hard', 'choice',   '{"q":"¿Cuál es la fórmula química del agua?","options":["CO2","H2O","O2"],"correct":1}'::jsonb, 50, 8),
  ('h6', null, 'Matemáticas', 'g4_12_15', 'hard', 'choice',   '{"q":"15% de 200","options":["20","30","45"],"correct":1}'::jsonb, 50, 8)
on conflict (code) do update set
  category    = excluded.category,
  age_group   = excluded.age_group,
  difficulty  = excluded.difficulty,
  type        = excluded.type,
  content     = excluded.content,
  xp_reward   = excluded.xp_reward,
  coin_reward = excluded.coin_reward;
