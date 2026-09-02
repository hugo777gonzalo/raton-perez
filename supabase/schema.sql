-- ============================================================
-- 🐭 RATÓN PÉREZ — Esquema de base de datos (Supabase / Postgres)
-- Incluye Row Level Security (RLS): una familia JAMÁS ve datos de otra.
-- Pegar en el editor SQL de Supabase. Requiere la extensión pgcrypto.
--
-- Revisión 2: corrige gaps encontrados contra la app (login, setup,
-- pantalla de padres, tesoro/pistas):
--   - agrega rewards.hiding_place_note (lugar real, privado)
--   - age_group_t ya no tiene hueco en los 11 años
--   - age_group se calcula desde birthdate (trigger), no se pide a mano
--   - xp_ledger y audit_log dejan de ser editables/borrables (inmutables)
--   - agrega función de alta onboard_family() (RPC security definer) que
--     resuelve el problema de "huevo y gallina" de RLS al crear la
--     primera familia/padre/hijo
--   - agrega set_child_pin() / verify_child_pin() para no manejar PIN
--     en texto plano
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- CATÁLOGOS GLOBALES ----------

create table levels (
  id          serial primary key,
  "order"     int not null unique,
  name        text not null,
  min_xp      int  not null
);

create table badges (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  name        text not null,
  icon        text,
  criteria    jsonb not null default '{}'::jsonb
);

-- ---------- FAMILIA Y USUARIOS ----------

create type plan_t as enum ('free','premium');

create table families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  plan        plan_t not null default 'free',
  created_at  timestamptz not null default now()
);

create table parents (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families(id) on delete cascade,
  auth_user_id  uuid not null unique,          -- referencia a auth.users
  email         text not null,
  full_name     text,
  role          text not null default 'owner', -- owner | guardian
  created_at    timestamptz not null default now()
);

-- g3 ahora cubre 9-11 (antes había un hueco: nadie de 11 años calzaba)
create type age_group_t as enum ('g1_5_6','g2_7_8','g3_9_11','g4_12_15');

create table children (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families(id) on delete cascade,
  display_name  text not null,                 -- apodo, NO nombre legal obligatorio
  avatar_key    text not null default 'fox',
  birthdate     date not null,
  age_group     age_group_t not null,           -- recalculado por trigger, ver abajo
  pin_hash      text,                          -- PIN hasheado (crypt/bcrypt) — usar set_child_pin()
  favorite_color text default '#F5C542',
  interests     text[] not null default '{}',  -- ['dinosaurios','espacio',...]
  archived      boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Calcula el age_group a partir de birthdate. La edad cambia con el tiempo
-- aunque birthdate no cambie, así que esto corre en cada INSERT/UPDATE de
-- birthdate; si quieres que el grupo "suba" automáticamente el día del
-- cumpleaños sin que nadie edite la fila, agenda este mismo cálculo en un
-- cron nocturno (pg_cron) que haga `update children set birthdate = birthdate`.
create or replace function compute_age_group(p_birthdate date) returns age_group_t
language sql immutable as $$
  select case
    when date_part('year', age(p_birthdate)) <= 6  then 'g1_5_6'::age_group_t
    when date_part('year', age(p_birthdate)) <= 8  then 'g2_7_8'::age_group_t
    when date_part('year', age(p_birthdate)) <= 10 then 'g3_9_11'::age_group_t
    else 'g4_12_15'::age_group_t
  end;
$$;

create or replace function children_set_age_group() returns trigger
language plpgsql as $$
begin
  new.age_group := compute_age_group(new.birthdate);
  return new;
end;
$$;

create trigger trg_children_age_group
  before insert or update of birthdate on children
  for each row execute function children_set_age_group();

-- Estado gamificado (cache de agregados)
create table child_state (
  child_id      uuid primary key references children(id) on delete cascade,
  total_xp      int not null default 0,
  coins         int not null default 0,
  level_id      int not null default 1 references levels(id),
  streak_days   int not null default 0,
  updated_at    timestamptz not null default now()
);

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_child_state_touch
  before update on child_state
  for each row execute function touch_updated_at();

-- ---------- CONTENIDO / ACTIVIDADES ----------

create type difficulty_t as enum ('easy','medium','hard');

create table activities (
  id            uuid primary key default gen_random_uuid(),
  code          text unique,                   -- llave estable para el seed (p1, a1, m1, h1...)
  family_id     uuid references families(id) on delete cascade, -- null = global
  category      text not null,                 -- matematicas, lectura, logica...
  age_group     age_group_t not null,
  difficulty    difficulty_t not null,
  type          text not null,                 -- 'choice' | 'memory' | 'sequence'
  content       jsonb not null,                -- payload validado en la app
  xp_reward     int not null default 25,
  coin_reward   int not null default 5,
  created_at    timestamptz not null default now()
);

create table child_activity_attempts (
  id            uuid primary key default gen_random_uuid(),
  child_id      uuid not null references children(id) on delete cascade,
  activity_id   uuid not null references activities(id) on delete cascade,
  status        text not null default 'completed', -- completed | abandoned
  score         numeric,
  xp_earned     int not null default 0,
  coins_earned  int not null default 0,
  duration_s    int,
  completed_at  timestamptz not null default now()
);

-- Libro mayor: fuente de verdad de XP/monedas (auditable e INMUTABLE
-- desde el cliente — solo INSERT/SELECT, ver policies más abajo)
create table xp_ledger (
  id            uuid primary key default gen_random_uuid(),
  child_id      uuid not null references children(id) on delete cascade,
  kind          text not null,                 -- 'xp' | 'coins'
  amount        int not null,
  reason        text not null,                 -- 'activity','bonus','redeem'...
  ref_id        uuid,
  created_at    timestamptz not null default now()
);

create table child_badges (
  child_id      uuid not null references children(id) on delete cascade,
  badge_id      uuid not null references badges(id) on delete cascade,
  earned_at     timestamptz not null default now(),
  primary key (child_id, badge_id)
);

-- ---------- RECOMPENSAS FÍSICAS Y PISTAS ----------

create type reward_status_t as enum ('active','redeemed','archived');

create table rewards (
  id                 uuid primary key default gen_random_uuid(),
  family_id          uuid not null references families(id) on delete cascade,
  child_id           uuid not null references children(id) on delete cascade,
  title              text not null,                 -- 'Helado','Juguete'...
  type               text not null default 'otro',  -- comida|juguete|pantalla|salida|otro
  photo_key          text,
  hiding_place_note  text,                           -- lugar REAL, privado — nunca se muestra al niño
  status             reward_status_t not null default 'active',
  special            boolean not null default false, -- requiere aprobación del padre
  created_by         uuid references parents(id),
  created_at         timestamptz not null default now()
);

create table clues (
  id            uuid primary key default gen_random_uuid(),
  reward_id     uuid not null references rewards(id) on delete cascade,
  sequence      int not null,                  -- 1,2,3 (progresivas)
  text          text not null,
  unlock_rule   jsonb not null default '{}'::jsonb, -- p.ej. {"every_missions":2}
  unique (reward_id, sequence)
);

create table child_reward_progress (
  child_id       uuid not null references children(id) on delete cascade,
  reward_id      uuid not null references rewards(id) on delete cascade,
  clues_unlocked int not null default 0,
  redeemed_at    timestamptz,
  primary key (child_id, reward_id)
);

-- ---------- CONTROL PARENTAL Y USO ----------

create table usage_limits (
  child_id        uuid primary key references children(id) on delete cascade,
  daily_minutes   int not null default 30,
  allowed_windows jsonb not null default '[]'::jsonb -- [{"day":1,"from":"16:00","to":"18:00"}]
);

create table usage_sessions (
  id            uuid primary key default gen_random_uuid(),
  child_id      uuid not null references children(id) on delete cascade,
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  duration_s    int
);

create table audit_log (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid references families(id) on delete cascade,
  actor         uuid,                          -- parent id
  action        text not null,                 -- 'child.create','limits.update'...
  target        text,
  meta          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Regla base: un padre solo accede a filas de SU familia.
-- ============================================================

-- Helper: familia del usuario autenticado
create or replace function current_family_id() returns uuid
language sql stable security definer set search_path = public as $$
  select family_id from parents where auth_user_id = auth.uid() limit 1;
$$;

alter table families                 enable row level security;
alter table parents                  enable row level security;
alter table children                 enable row level security;
alter table child_state              enable row level security;
alter table child_activity_attempts  enable row level security;
alter table xp_ledger                enable row level security;
alter table child_badges             enable row level security;
alter table rewards                  enable row level security;
alter table clues                    enable row level security;
alter table child_reward_progress    enable row level security;
alter table usage_limits             enable row level security;
alter table usage_sessions           enable row level security;
alter table audit_log                enable row level security;
-- Catálogos globales: lectura pública para usuarios autenticados
alter table levels     enable row level security;
alter table badges     enable row level security;
alter table activities enable row level security;

-- Familia y padres: SOLO lectura/edición de la propia fila desde el
-- cliente. La creación (alta de familia nueva) pasa por onboard_family(),
-- que corre con privilegios elevados — así evitamos exponer un INSERT
-- policy que cualquiera podría usar para "unirse" a otra familia.
create policy family_read on families for select
  using (id = current_family_id());
create policy family_update on families for update
  using (id = current_family_id()) with check (id = current_family_id());

create policy parent_self on parents for select
  using (family_id = current_family_id());
create policy parent_update_self on parents for update
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- Plantilla reutilizable: acceso total a filas de la propia familia
create policy children_rw on children for all
  using (family_id = current_family_id())
  with check (family_id = current_family_id());

create policy rewards_rw on rewards for all
  using (family_id = current_family_id())
  with check (family_id = current_family_id());

create policy limits_rw on usage_limits for all
  using (child_id in (select id from children where family_id = current_family_id()))
  with check (child_id in (select id from children where family_id = current_family_id()));

create policy state_rw on child_state for all
  using (child_id in (select id from children where family_id = current_family_id()))
  with check (child_id in (select id from children where family_id = current_family_id()));

create policy attempts_rw on child_activity_attempts for all
  using (child_id in (select id from children where family_id = current_family_id()))
  with check (child_id in (select id from children where family_id = current_family_id()));

-- xp_ledger: inmutable desde el cliente. Solo INSERT + SELECT; sin policy
-- de UPDATE/DELETE, RLS las deniega por defecto.
create policy ledger_select on xp_ledger for select
  using (child_id in (select id from children where family_id = current_family_id()));
create policy ledger_insert on xp_ledger for insert
  with check (child_id in (select id from children where family_id = current_family_id()));

create policy cbadges_rw on child_badges for all
  using (child_id in (select id from children where family_id = current_family_id()))
  with check (child_id in (select id from children where family_id = current_family_id()));

create policy clues_rw on clues for all
  using (reward_id in (select id from rewards where family_id = current_family_id()))
  with check (reward_id in (select id from rewards where family_id = current_family_id()));

create policy crp_rw on child_reward_progress for all
  using (child_id in (select id from children where family_id = current_family_id()))
  with check (child_id in (select id from children where family_id = current_family_id()));

create policy sessions_rw on usage_sessions for all
  using (child_id in (select id from children where family_id = current_family_id()))
  with check (child_id in (select id from children where family_id = current_family_id()));

-- audit_log: solo lectura desde el cliente. Los INSERT los hacen las
-- funciones security definer (onboard_family, etc), nunca el cliente
-- directo — así el registro no se puede falsificar.
create policy audit_read on audit_log for select
  using (family_id = current_family_id());

-- Catálogos globales: cualquier autenticado puede leer; actividades propias o globales
create policy levels_read on levels for select using (auth.role() = 'authenticated');
create policy badges_read on badges for select using (auth.role() = 'authenticated');
create policy activities_read on activities for select
  using (family_id is null or family_id = current_family_id());

-- ============================================================
-- FUNCIONES DE ALTA Y PIN (security definer)
-- ============================================================

-- Alta completa: crea familia + padre + hijo + estado inicial + tesoro
-- vacío en una sola transacción. Resuelve el problema de "huevo y
-- gallina" de RLS (un usuario nuevo no tiene family_id todavía).
-- Llamar desde el cliente ya autenticado (auth.uid() no null) justo
-- después del login, con los datos de la pantalla de Configuración.
create or replace function onboard_family(
  p_parent_name    text,
  p_parent_email   text,
  p_child_name     text,
  p_child_birthdate date,
  p_hiding_place   text,
  p_avatar_key     text default 'fox'
) returns table(family_id uuid, parent_id uuid, child_id uuid)
language plpgsql security definer set search_path = public as $$
declare
  v_family_id uuid;
  v_parent_id uuid;
  v_child_id  uuid;
begin
  if auth.uid() is null then
    raise exception 'onboard_family requiere un usuario autenticado';
  end if;

  if exists (select 1 from parents where auth_user_id = auth.uid()) then
    raise exception 'Este usuario ya tiene una familia registrada';
  end if;

  insert into families (name) values (p_parent_name || ' — Familia')
    returning id into v_family_id;

  insert into parents (family_id, auth_user_id, email, full_name, role)
    values (v_family_id, auth.uid(), p_parent_email, p_parent_name, 'owner')
    returning id into v_parent_id;

  insert into children (family_id, display_name, avatar_key, birthdate, age_group)
    values (v_family_id, p_child_name, p_avatar_key, p_child_birthdate, compute_age_group(p_child_birthdate))
    returning id into v_child_id;

  insert into child_state (child_id) values (v_child_id);

  insert into rewards (family_id, child_id, title, hiding_place_note)
    values (v_family_id, v_child_id, 'Sorpresa de Ratón Pérez', p_hiding_place);

  insert into audit_log (family_id, actor, action, target)
    values (v_family_id, v_parent_id, 'family.onboard', v_child_id::text);

  return query select v_family_id, v_parent_id, v_child_id;
end;
$$;

-- PIN del niño: nunca se guarda ni se compara en texto plano.
create or replace function set_child_pin(p_child_id uuid, p_pin text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_child_id not in (select id from children where family_id = current_family_id()) then
    raise exception 'No autorizado';
  end if;
  update children set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf')) where id = p_child_id;
end;
$$;

create or replace function verify_child_pin(p_child_id uuid, p_pin text) returns boolean
language sql security definer set search_path = public as $$
  select pin_hash is not null and pin_hash = extensions.crypt(p_pin, pin_hash)
  from children where id = p_child_id;
$$;

-- ============================================================
-- SEED MÍNIMO (niveles + insignias)
-- ============================================================
insert into levels ("order", name, min_xp) values
  (1,'Explorador',0),(2,'Aventurero',150),(3,'Inventor',400),
  (4,'Científico',900),(5,'Maestro del Conocimiento',1800),
  (6,'Sabio Ratón',3000),(7,'Leyenda del Saber',5000),(8,'Campeón de Ratón Pérez',8000);

-- Banco de actividades global (family_id null), por franja de edad:
-- 4-6=g1_5_6, 7-8=g2_7_8, 9-10=g3_9_11, 11-15=g4_12_15.
insert into activities (code, family_id, category, age_group, difficulty, type, content, xp_reward, coin_reward) values
  ('p1', null, 'Matemáticas', 'g1_5_6', 'easy',   'choice',   '{"q":"2 + 1","options":["2","3","4"],"correct":1}'::jsonb, 10, 3),
  ('p2', null, 'Lógica',      'g1_5_6', 'easy',   'sequence', '{"prompt":"¿Qué color sigue?","seq":["🔴","🔵","🔴","🔵","❓"],"options":["🔴","🔵","🟢"],"correct":0}'::jsonb, 10, 3),
  ('p3', null, 'Memoria',     'g1_5_6', 'easy',   'memory',   '{"pairs":["🐶","🐱"]}'::jsonb, 10, 3),
  ('p4', null, 'Lectura',     'g1_5_6', 'easy',   'choice',   '{"q":"¿Cuál es un animal?","options":["🚗 Auto","🐶 Perro","🍎 Manzana"],"correct":1}'::jsonb, 10, 3),
  ('p5', null, 'Ciencias',    'g1_5_6', 'easy',   'choice',   '{"q":"¿De qué color es el sol?","options":["Azul","Amarillo","Verde"],"correct":1}'::jsonb, 10, 3),
  ('p6', null, 'Matemáticas', 'g1_5_6', 'easy',   'choice',   '{"q":"¿Cuántas manzanas hay? 🍎🍎🍎","options":["2","3","4"],"correct":1}'::jsonb, 10, 3),

  ('a1', null, 'Matemáticas', 'g2_7_8', 'easy',   'choice',   '{"q":"7 + 5","options":["10","12","13"],"correct":1}'::jsonb, 15, 4),
  ('a2', null, 'Lógica',      'g2_7_8', 'medium', 'sequence', '{"prompt":"¿Qué figura sigue?","seq":["🔺","🔵","🔺","🔵","❓"],"options":["🔵","🔺","🟡"],"correct":1}'::jsonb, 25, 5),
  ('a3', null, 'Memoria',     'g2_7_8', 'medium', 'memory',   '{"pairs":["🦕","🚀","⭐"]}'::jsonb, 25, 5),
  ('a4', null, 'Lectura',     'g2_7_8', 'easy',   'choice',   '{"q":"¿Cuál es una fruta?","options":["🐶 Perro","🍎 Manzana","🚗 Auto"],"correct":1}'::jsonb, 15, 4),
  ('a5', null, 'Ciencias',    'g2_7_8', 'medium', 'choice',   '{"q":"¿Qué planeta es el nuestro?","options":["Marte","Tierra","Júpiter"],"correct":1}'::jsonb, 25, 5),
  ('a6', null, 'Matemáticas', 'g2_7_8', 'medium', 'choice',   '{"q":"15 - 6","options":["8","9","10"],"correct":1}'::jsonb, 25, 5),

  ('m1', null, 'Matemáticas', 'g3_9_11', 'medium', 'choice',   '{"q":"9 × 3","options":["27","21","18"],"correct":0}'::jsonb, 30, 6),
  ('m2', null, 'Lógica',      'g3_9_11', 'medium', 'sequence', '{"prompt":"¿Qué número sigue?","seq":["2","4","6","8","❓"],"options":["9","10","12"],"correct":1}'::jsonb, 30, 6),
  ('m3', null, 'Memoria',     'g3_9_11', 'medium', 'memory',   '{"pairs":["🦕","🚀","⭐","🔬"]}'::jsonb, 30, 6),
  ('m4', null, 'Lectura',     'g3_9_11', 'medium', 'choice',   '{"q":"Un tren sale a las 3pm y tarda 2 horas. ¿A qué hora llega?","options":["4pm","5pm","6pm"],"correct":1}'::jsonb, 30, 6),
  ('m5', null, 'Ciencias',    'g3_9_11', 'medium', 'choice',   '{"q":"¿Cuántos planetas tiene el sistema solar?","options":["7","8","9"],"correct":1}'::jsonb, 30, 6),
  ('m6', null, 'Matemáticas', 'g3_9_11', 'hard',   'choice',   '{"q":"12 ÷ 4","options":["3","4","6"],"correct":1}'::jsonb, 35, 7),

  ('h1', null, 'Matemáticas', 'g4_12_15', 'hard', 'choice',   '{"q":"(6 + 4) × 2","options":["18","20","22"],"correct":1}'::jsonb, 50, 8),
  ('h2', null, 'Lógica',      'g4_12_15', 'hard', 'sequence', '{"prompt":"¿Qué número sigue? (Fibonacci)","seq":["1","1","2","3","5","❓"],"options":["7","8","9"],"correct":1}'::jsonb, 50, 8),
  ('h3', null, 'Memoria',     'g4_12_15', 'hard', 'memory',   '{"pairs":["🦕","🚀","⭐","🔬","🎨","🎵"]}'::jsonb, 50, 8),
  ('h4', null, 'Lectura',     'g4_12_15', 'hard', 'choice',   '{"q":"Un libro cuesta $15 con 20% de descuento. ¿Cuánto cuesta ahora?","options":["$10","$12","$13"],"correct":1}'::jsonb, 50, 8),
  ('h5', null, 'Ciencias',    'g4_12_15', 'hard', 'choice',   '{"q":"¿Cuál es la fórmula química del agua?","options":["CO2","H2O","O2"],"correct":1}'::jsonb, 50, 8),
  ('h6', null, 'Matemáticas', 'g4_12_15', 'hard', 'choice',   '{"q":"15% de 200","options":["20","30","45"],"correct":1}'::jsonb, 50, 8);

insert into badges (code,name,icon,criteria) values
  ('MATH_KING','Rey de las Matemáticas','👑','{"category":"matematicas","count":10}'),
  ('WORD_DETECTIVE','Detective de Palabras','🔎','{"category":"lectura","count":10}'),
  ('MEMORY_MASTER','Maestro de la Memoria','🧠','{"type":"memory","count":8}'),
  ('LOGIC_GENIUS','Genio de la Lógica','⚡','{"category":"logica","count":10}'),
  ('EARLY_BIRD','Madrugador','🌅','{"streak_days":5}'),
  ('CURIOUS','Explorador Curioso','🧭','{"distinct_categories":4}');
