/**
 * claimCoupon 云函数的本地 mock
 * 仅在非微信平台（H5 预览 / 抖音 / 支付宝）由 services/cloud.ts 自动加载
 * 微信端会调用真实云函数 cloudfunctions/claimCoupon（含防重复领取与库存扣减）
 */
export default function claimCouponMock(
  _params: { couponId?: string } = {}
): { claimed: boolean; alreadyClaimed: boolean } {
  return { claimed: true, alreadyClaimed: false };
}
