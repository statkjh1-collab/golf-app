-- 필드 통합 2단계: 필드 라운드 일정·참석
-- 기존 데이터는 지우지 않는다. 컬럼 추가 + 함수만 만든다.

-- 1) 모임(라운드) 정보
alter table meetings add column if not exists venue text;
alter table meetings add column if not exists venue_address text;
alter table meetings add column if not exists signup_deadline date;
alter table meetings add column if not exists gather_time time;
alter table meetings add column if not exists notice text;
alter table meetings add column if not exists is_holiday_round boolean not null default false;

-- 2) 참석 상태 (기존 스크린 참석 기록은 모두 applied)
--   applied: 신청(확정) / waitlist: 대기 / canceled: 취소 / no_show: 노쇼
alter table attendances add column if not exists status text not null default 'applied';
alter table attendances drop constraint if exists attendances_status_check;
alter table attendances add constraint attendances_status_check
  check (status in ('applied', 'confirmed', 'waitlist', 'canceled', 'no_show'));
alter table attendances add column if not exists applied_at timestamptz default now();
alter table attendances add column if not exists waitlist_order int;
alter table attendances add column if not exists canceled_at timestamptz;
-- 취소 구간 (세칙 2-2): free 위약 없음 / mid 대체 인원 못 구하면 위약금 / late 위약금 + 노쇼 기록
alter table attendances add column if not exists cancel_tier text;
alter table attendances add column if not exists late boolean not null default false;

-- 3) 설정값
insert into settings (key, value) values
  ('cancel_late_days', '1'),
  ('field_capacity_default', '20'),
  ('local_rules', '[
    "일파만파: 첫 홀·마지막 홀 적용 금지",
    "멀리건: 18홀 중 1회만 사용 가능",
    "벙커: 드롭 금지",
    "트러블샷: 드롭 금지",
    "무벌타 드롭: 본인 클럽 중 가장 긴 클럽 길이 이내, 뒤쪽 또는 옆쪽으로만 (앞쪽 금지)",
    "분실구: 무리한 수색으로 진행을 지연하지 않음",
    "공 확인: 라운드 시작 전 사용할 공을 동반자와 서로 확인",
    "컨시드(OK): 구장 OK 라인이 있으면 따르고, 없으면 퍼터 그립을 제외한 길이 이내"
  ]')
on conflict (key) do nothing;

-- 4) 신청: 정원 안이면 applied, 넘으면 waitlist + 순번 (동시에 눌러도 순서가 꼬이지 않게 라운드를 잠근다)
create or replace function field_apply(p_meeting bigint, p_member bigint)
returns attendances
language plpgsql
as $$
declare
  m meetings;
  a attendances;
  had_row boolean;
  active_count int;
  next_order int;
  today date := (now() at time zone 'Asia/Seoul')::date;
begin
  select * into m from meetings where id = p_meeting for update;
  if not found or m.type <> 'field' then raise exception '필드 라운드가 아니에요.'; end if;
  if m.status <> 'open' then raise exception '신청을 받지 않는 라운드예요.'; end if;
  if m.signup_deadline is not null and today > m.signup_deadline then raise exception '신청이 마감됐어요.'; end if;

  select * into a from attendances where meeting_id = p_meeting and member_id = p_member;
  had_row := found;
  if had_row and a.status in ('applied', 'confirmed', 'waitlist') then return a; end if;
  if had_row and a.status = 'no_show' then raise exception '노쇼 처리된 라운드예요.'; end if;

  select count(*) into active_count from attendances
   where meeting_id = p_meeting and status in ('applied', 'confirmed');
  select coalesce(max(waitlist_order), 0) + 1 into next_order from attendances
   where meeting_id = p_meeting and status = 'waitlist';

  if had_row then
    update attendances set
      status = case when active_count < m.capacity then 'applied' else 'waitlist' end,
      waitlist_order = case when active_count < m.capacity then null else next_order end,
      applied_at = now(), canceled_at = null, cancel_tier = null
     where id = a.id returning * into a;
  else
    insert into attendances (meeting_id, member_id, status, waitlist_order, applied_at)
    values (p_meeting, p_member,
            case when active_count < m.capacity then 'applied' else 'waitlist' end,
            case when active_count < m.capacity then null else next_order end,
            now())
    returning * into a;
  end if;
  return a;
end;
$$;

-- 5) 취소: 남은 일수로 취소 구간을 정하고, 빈자리는 대기 1순위로 채운다
create or replace function field_cancel(p_meeting bigint, p_member bigint)
returns text
language plpgsql
as $$
declare
  m meetings;
  a attendances;
  free_days int;
  late_days int;
  days_left int;
  tier text;
  next_wait attendances;
begin
  select * into m from meetings where id = p_meeting for update;
  if not found or m.type <> 'field' then raise exception '필드 라운드가 아니에요.'; end if;

  select * into a from attendances
   where meeting_id = p_meeting and member_id = p_member and status in ('applied', 'confirmed', 'waitlist');
  if not found then raise exception '신청 내역이 없어요.'; end if;

  select coalesce((select (value #>> '{}')::int from settings where key = 'cancel_free_days'), 7) into free_days;
  select coalesce((select (value #>> '{}')::int from settings where key = 'cancel_late_days'), 1) into late_days;
  days_left := m.meet_date - (now() at time zone 'Asia/Seoul')::date;

  -- 대기자 취소는 위약 없음
  if a.status = 'waitlist' then tier := 'free';
  elsif days_left >= free_days then tier := 'free';
  elsif days_left > late_days then tier := 'mid';
  else tier := 'late';
  end if;

  update attendances set status = 'canceled', canceled_at = now(), cancel_tier = tier, waitlist_order = null
   where id = a.id;

  if a.status in ('applied', 'confirmed') then
    select * into next_wait from attendances
     where meeting_id = p_meeting and status = 'waitlist'
     order by waitlist_order, applied_at limit 1;
    if found then
      update attendances set status = 'applied', waitlist_order = null where id = next_wait.id;
    end if;
  end if;
  return tier;
end;
$$;

grant execute on function field_apply(bigint, bigint) to anon, authenticated;
grant execute on function field_cancel(bigint, bigint) to anon, authenticated;
