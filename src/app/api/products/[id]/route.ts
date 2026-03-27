// GET    /api/products/[id]  → 단일 상품 전체 데이터
// PUT    /api/products/[id]  → 상품 업데이트
// DELETE /api/products/[id]  → 상품 삭제

import { getProduct, upsertProduct, deleteProduct } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return Response.json({ ok: false, error: "상품 없음" }, { status: 404 });
  return Response.json({ ok: true, product });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
  try { body = await request.json(); }
  catch { return Response.json({ ok: false, error: "JSON 파싱 실패" }, { status: 400 }); }

  const existing  = await getProduct(id);
  const now       = new Date().toISOString();
  const thumbnail = body.images?.s01Hero ?? existing?.thumbnail ?? undefined;

  await upsertProduct({ ...existing, ...body, id, thumbnail, createdAt: existing?.createdAt ?? now, updatedAt: now });
  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteProduct(id);
  return Response.json({ ok: true });
}
