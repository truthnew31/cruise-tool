// 투어 상품 섹션 타입
export type TourSectionId = "S01" | "S02" | "S03" | "S04" | "S05";

export type TourData = {
  sectionOrder: TourSectionId[];
  S01: {
    heroTitle: string;
    heroSubtitle: string;
    duration: string;
    departureInfo: string;
  };
  S02: {
    intro: string;
    highlights: { icon: string; text: string }[];
    showTips: boolean;
    tips: string[];
  };
  S03: {
    intro: string;
    days: {
      dayNum: string;
      title: string;
      desc: string;
      meals: string;
      accommodation: string;
    }[];
  };
  S04: {
    categories: {
      title: string;
      items: string[];
    }[];
  };
  S05: {
    faqs: {
      question: string;
      answer: string;
    }[];
  };
};
