export const MARKETPLACE_CHANNELS = ["gofood", "grabfood", "shopeefood"] as const;
export type MarketplaceChannel = (typeof MARKETPLACE_CHANNELS)[number];

export const CHANNEL_META: Record<
  MarketplaceChannel,
  { label: string; emoji: string; defaultFeePercent: number }
> = {
  gofood: { label: "GoFood", emoji: "🟢", defaultFeePercent: 20 },
  grabfood: { label: "GrabFood", emoji: "🍏", defaultFeePercent: 20 },
  shopeefood: { label: "ShopeeFood", emoji: "🧡", defaultFeePercent: 17.5 },
};
