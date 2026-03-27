import { BenefitKey } from "@/types/cruise";

export const FIXED_BENEFITS: Record<
  BenefitKey,
  {
    icon: string;
    title: string;
    description: string;
    valueLabel?: string;
  }
> = {
  wifi: {
    icon: "wifi",
    title: "선내 와이파이",
    description: "1인당 150분 제공",
  },
  port_voucher: {
    icon: "coin",
    title: "기항지 관광 바우처",
    description: "기항지당 $50 할인 (첫 번째 승객 적용가능)",
    valueLabel: "$50",
  },
  onboard_credit: {
    icon: "coin",
    title: "온보드 바우처",
    description: "선실당 $100 제공 (*크루즈 내에서 현금처럼 사용 가능)",
    valueLabel: "$100",
  },
};
