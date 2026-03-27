// DB 레이어
// - Supabase 설정 시 → Supabase 사용 (Vercel 배포 포함)
// - 미설정 시 → 로컬 파일(data/products.json) 폴백

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH  = path.join(DATA_DIR, "products.json");

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const USE_SUPABASE = SUPABASE_URL.length > 0 && !SUPABASE_URL.includes("xxxx");

export type ProductSummary = {
  id:           string;
  shippingLine: string;
  shipName:     string;
  region:       string;
  thumbnail?:   string;
  createdAt:    string;
  updatedAt:    string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ProductRecord = ProductSummary & { [key: string]: any };

// ── 파일 기반 헬퍼 (로컬 폴백) ────────────────────────────────────
function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}
function readAll(): ProductRecord[] {
  ensureDir();
  if (!existsSync(DB_PATH)) return [];
  try { return JSON.parse(readFileSync(DB_PATH, "utf-8")); }
  catch { return []; }
}
function writeAll(records: ProductRecord[]) {
  ensureDir();
  writeFileSync(DB_PATH, JSON.stringify(records, null, 2), "utf-8");
}

// ── Supabase ──────────────────────────────────────────────────────
async function getDb() {
  const { getSupabaseAdmin } = await import("./supabase");
  return getSupabaseAdmin();
}

// ── 공개 API (모두 async) ─────────────────────────────────────────
export async function listProducts(): Promise<ProductSummary[]> {
  if (USE_SUPABASE) {
    const db = await getDb();
    const { data, error } = await db
      .from("cruise_products")
      .select("product_id, ship_line, ship_name, region, data, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) { console.error("[db] listProducts error:", error); return []; }
    return (data ?? []).map(row => ({
      id:           row.product_id,
      shippingLine: row.ship_line,
      shipName:     row.ship_name,
      region:       row.region,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      thumbnail:    (row.data as any)?.images?.s01Hero,
      createdAt:    row.created_at,
      updatedAt:    row.updated_at,
    }));
  }
  return readAll()
    .map(({ id, shippingLine, shipName, region, thumbnail, createdAt, updatedAt }) =>
      ({ id, shippingLine, shipName, region, thumbnail, createdAt, updatedAt }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getProduct(id: string): Promise<ProductRecord | null> {
  if (USE_SUPABASE) {
    const db = await getDb();
    const { data, error } = await db
      .from("cruise_products")
      .select("data")
      .eq("product_id", id)
      .maybeSingle();
    if (error || !data) return null;
    return data.data as ProductRecord;
  }
  return readAll().find(p => p.id === id) ?? null;
}

export async function upsertProduct(record: ProductRecord): Promise<void> {
  if (USE_SUPABASE) {
    const db = await getDb();
    await db.from("cruise_products").upsert({
      product_id: record.id,
      ship_line:  record.shippingLine,
      ship_name:  record.shipName,
      region:     record.region,
      data:       record,
    }, { onConflict: "product_id" });
    return;
  }
  const all = readAll();
  const idx = all.findIndex(p => p.id === record.id);
  const now = new Date().toISOString();
  if (idx >= 0) {
    all[idx] = { ...record, createdAt: all[idx].createdAt, updatedAt: now };
  } else {
    all.unshift({ ...record, createdAt: now, updatedAt: now });
  }
  writeAll(all);
}

export async function deleteProduct(id: string): Promise<void> {
  if (USE_SUPABASE) {
    const db = await getDb();
    await db.from("cruise_products").delete().eq("product_id", id);
    return;
  }
  writeAll(readAll().filter(p => p.id !== id));
}
