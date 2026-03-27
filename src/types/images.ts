export type ImageStore = {
  s01Hero?: string;
  s03Highlights?: string[];      // 최대 4장
  s04Ship?: string;
  s05Cabins?: { photo?: string; floorplan?: string }[];
  s06Overview?: string;          // 선박 전경 대표 이미지
  s06Main?: string[];            // 주요 부대시설 사진
  s06Kids?: string[];            // 어린이&패밀리 시설 사진
  s06Dining?: string[];          // 다이닝 사진
  s07Ports?: string[];           // 기항지 사진
  s08Closing?: string;
};
