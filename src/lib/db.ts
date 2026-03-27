// 파일 기반 간단 DB — data/products.json 에 저장
// API route(서버 사이드)에서만 import 할 것

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH  = path.join(DATA_DIR, "products.json");

export type ProductSummary = {
  id:           string;
  shippingLine: string;
  shipName:     string;
  region:       string;
  thumbnail?:   string;          // s01Hero 이미지 URL/base64
  createdAt:    string;          // ISO string
  updatedAt:    string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ProductRecord = ProductSummary & { [key: string]: any };

// ── 내부 헬퍼 ─────────────────────────────────────────────────
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

// ── 공개 API ──────────────────────────────────────────────────
export function listProducts(): ProductSummary[] {
  return readAll()
    .map(({ id, shippingLine, shipName, region, thumbnail, createdAt, updatedAt }) =>
      ({ id, shippingLine, shipName, region, thumbnail, createdAt, updatedAt }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getProduct(id: string): ProductRecord | null {
  return readAll().find(p => p.id === id) ?? null;
}

export function upsertProduct(record: ProductRecord): void {
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

export function deleteProduct(id: string): void {
  writeAll(readAll().filter(p => p.id !== id));
}
