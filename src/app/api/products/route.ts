// GET  /api/products      → 전체 상품 목록 (요약)
// POST /api/products      → 상품 저장 (upsert)

import { listProducts, upsertProduct } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const products = await listProducts();
  return Response.json({ ok: true, products });
}

export async function POST(request: Request) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try { body = await request.json(); }
  catch { return Response.json({ ok: false, error: "JSON 파싱 실패" }, { status: 400 }); }

  const { id, shippingLine, shipName, region } = body;
  if (!id || !shippingLine || !shipName || !region) {
    return Response.json({ ok: false, error: "id·shippingLine·shipName·region 필수" }, { status: 400 });
  }

  const now       = new Date().toISOString();
  const thumbnail = body.images?.s01Hero ?? undefined;

  await upsertProduct({ ...body, thumbnail, createdAt: now, updatedAt: now });
  return Response.json({ ok: true });
}
