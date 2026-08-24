create table access_logs (
  id bigint primary key generated always as identity,
  member_id bigint references members(id) on delete set null,
  name text not null,
  created_at timestamptz default now()
);

alter table access_logs enable row level security;

create policy "public read access_logs" on access_logs for select using (true);
create policy "public insert access_logs" on access_logs for insert with check (true);
create policy "public delete access_logs" on access_logs for delete using (true);
