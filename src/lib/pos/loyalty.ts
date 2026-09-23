export const EARN_RATE = 10000; // 1 poin per Rp10.000 belanja
export const POINT_VALUE = 100; // 1 poin = Rp100 saat redeem

export function calcPointsEarned(total: number): number {
  return Math.floor(total / EARN_RATE);
}

export function calcPointsValue(points: number): number {
  return points * POINT_VALUE;
}
