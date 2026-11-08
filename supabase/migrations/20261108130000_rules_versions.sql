-- 필드 통합 1-1단계: 회칙 버전 관리
-- status: draft(초안, 관리자 화면에서만 표시) / published(게시됨)
-- is_current: 현재 시행본 (published 중 1건만 true)

create table if not exists rules_versions (
  id bigint primary key generated always as identity,
  version text not null,
  effective_date date,
  content_md text not null,
  change_summary text,
  approved_by text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  is_current boolean not null default false,
  published_at timestamptz,
  created_at timestamptz default now()
);

-- 현재 시행본은 하나만
create unique index if not exists rules_versions_one_current
  on rules_versions (is_current) where is_current;

alter table rules_versions enable row level security;

drop policy if exists "public read rules_versions" on rules_versions;
drop policy if exists "public insert rules_versions" on rules_versions;
drop policy if exists "public update rules_versions" on rules_versions;
drop policy if exists "public delete rules_versions" on rules_versions;
create policy "public read rules_versions" on rules_versions for select using (true);
create policy "public insert rules_versions" on rules_versions for insert with check (true);
create policy "public update rules_versions" on rules_versions for update using (true);
create policy "public delete rules_versions" on rules_versions for delete using (true);

-- 게시: 기존 시행본을 내리고 이 버전을 시행본으로 (한 번에 처리)
create or replace function publish_rules_version(p_id bigint)
returns void
language plpgsql
as $$
begin
  update rules_versions set is_current = false where is_current and id <> p_id;
  update rules_versions
     set status = 'published', is_current = true, published_at = now()
   where id = p_id;
end;
$$;

grant execute on function publish_rules_version(bigint) to anon, authenticated;

-- 회칙 개정 배너 표시 기간(일)
insert into settings (key, value) values ('rules_banner_days', '14')
on conflict (key) do nothing;
