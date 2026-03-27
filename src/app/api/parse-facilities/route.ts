// POST /api/parse-facilities
// 시설 URL 텍스트에서 S06 요금 태그를 분류

import { parseFacilitiesFromText } from "@/lib/scraper";
import type { FacilityItem } from "@/types/cruise";

export const dynamic = "force-dynamic";

type ParseRequest = {
  facilityText: string;
};

type ParseResponse = {
  facilities: FacilityItem[];
  reviewCount: number;
};

export async function POST(request: Request) {
  const { facilityText }: ParseRequest = await request.json();

  if (!facilityText?.trim()) {
    return Response.json({ facilities: [], reviewCount: 0 });
  }

  const facilities = parseFacilitiesFromText(facilityText);
  const reviewCount = facilities.filter((f) => f.reviewFlag).length;

  const result: ParseResponse = { facilities, reviewCount };
  return Response.json(result);
}
