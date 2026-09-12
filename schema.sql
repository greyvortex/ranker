create table if not exists entries (
  id text primary key,
  title text not null,
  type text not null,
  poster_url text,
  external_source text,
  external_id text,
  status text not null default 'want',
  episode integer not null default 0,
  total_episodes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists entries_status_idx on entries (status);
