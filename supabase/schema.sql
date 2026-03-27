-- ================================================
-- 크루즈 상품 상세페이지 자동화 툴 — Supabase 스키마
-- Supabase Dashboard > SQL Editor 에서 실행하세요
-- ================================================

-- 상품 초안 저장 테이블
create table if not exists cruise_products (
  id            uuid default gen_random_uuid() primary key,
  product_id    text unique not null,
  product_name  text,
  ship_line     text,
  ship_name     text,
  region        text,
  data          jsonb not null,        -- CruiseProduct 전체를 JSON으로 저장
  created_at    timestamp with time zone default now(),
  updated_at    timestamp with time zone default now()
);

-- updated_at 자동 갱신 트리거 함수
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- 트리거 적용
drop trigger if exists cruise_products_updated_at on cruise_products;
create trigger cruise_products_updated_at
  before update on cruise_products
  for each row execute function update_updated_at();

-- RLS (Row Level Security) 활성화 — 필요 시 정책 추가
alter table cruise_products enable row level security;

-- 개발 단계: 인증된 사용자 전체 접근 허용 (운영 시 정책 세분화 필요)
create policy "allow_all_authenticated" on cruise_products
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
