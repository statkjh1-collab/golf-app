create table members (
  id bigint primary key generated always as identity,
  name text not null,
  handicap int not null default 0,
  active boolean not null default true,
  created_at timestamptz default now()
);

create table meetings (
  id bigint primary key generated always as identity,
  title text not null,
  meet_date date not null,
  meet_time time not null,
  capacity int not null default 10,
  status text not null default 'open',
  total_fee int,
  created_at timestamptz default now()
);

create table attendances (
  id bigint primary key generated always as identity,
  meeting_id bigint references meetings(id) on delete cascade,
  member_id bigint references members(id) on delete cascade,
  team text,
  unique(meeting_id, member_id)
);

create table scores (
  id bigint primary key generated always as identity,
  meeting_id bigint references meetings(id) on delete cascade,
  member_id bigint references members(id) on delete cascade,
  gross int not null,
  mulligan boolean not null default false,
  net int not null,
  rank int,
  ratio float,
  fee_amount int
);

alter table members enable row level security;
alter table meetings enable row level security;
alter table attendances enable row level security;
alter table scores enable row level security;

create policy "public read members" on members for select using (true);
create policy "public read meetings" on meetings for select using (true);
create policy "public read attendances" on attendances for select using (true);
create policy "public read scores" on scores for select using (true);

create policy "public insert members" on members for insert with check (true);
create policy "public insert meetings" on meetings for insert with check (true);
create policy "public insert attendances" on attendances for insert with check (true);
create policy "public insert scores" on scores for insert with check (true);

create policy "public update members" on members for update using (true);
create policy "public update meetings" on meetings for update using (true);
create policy "public update attendances" on attendances for update using (true);
create policy "public update scores" on scores for update using (true);

create policy "public delete members" on members for delete using (true);
create policy "public delete meetings" on meetings for delete using (true);
create policy "public delete attendances" on attendances for delete using (true);
create policy "public delete scores" on scores for delete using (true);
