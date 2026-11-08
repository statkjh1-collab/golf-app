-- 필드 통합 1단계: 모임 종류 구분 + 설정값 테이블
-- 기존 데이터는 지우지 않는다. 컬럼·테이블 추가만 한다.

-- 1) 모임 종류: 기존 모임은 모두 스크린
alter table meetings
  add column if not exists type text not null default 'screen';

alter table meetings
  drop constraint if exists meetings_type_check;
alter table meetings
  add constraint meetings_type_check check (type in ('screen', 'field'));

-- 2) 설정값 (키-값). 회칙 숫자는 코드가 아니라 여기서 읽는다.
create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

alter table settings enable row level security;

drop policy if exists "public read settings" on settings;
drop policy if exists "public insert settings" on settings;
drop policy if exists "public update settings" on settings;
create policy "public read settings" on settings for select using (true);
create policy "public insert settings" on settings for insert with check (true);
create policy "public update settings" on settings for update using (true);

-- 회칙 초안 기준 기본값. 이미 값이 있으면 건드리지 않는다.
insert into settings (key, value) values
  ('fee_plan',                '"A"'),
  ('join_fee',                '100000'),
  ('annual_fee',              '100000'),
  ('field_fee',               '30000'),
  ('field_meal_portion',      '30000'),
  ('late_fine',               '10000'),
  ('cancel_free_days',        '7'),
  ('gather_minutes_before',   '30'),
  ('screen_meal_cap',         '50000'),
  ('screen_points',           '[10,9,8,7,6,5,4,3,2,1]'),
  ('min_games_avg_rank',      '3'),
  ('dormant_attendance_rate', '0.3'),
  ('noshow_limit',            '2'),
  ('capacity_total',          '40')
on conflict (key) do nothing;
