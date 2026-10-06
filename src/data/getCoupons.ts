import { hotCoupons } from './coupons';
import type { Coupon } from '@/types/coupon';

/**
 * getCoupons 云函数的本地 mock
 * 仅在非微信平台（H5 预览 / 抖音 / 支付宝）由 services/cloud.ts 自动加载
 * 微信端会调用真实云函数 cloudfunctions/getCoupons
 */
export default function getCouponsMock(
  params: { platformCode?: string; category?: string; keyword?: string } = {}
): { list: Coupon[] } {
  const { platformCode = '', category = '', keyword = '' } = params || {};
  const kw = keyword.trim();

  const list = hotCoupons.filter((c) => {
    const okPlatform = !platformCode || c.platformCode === platformCode;
    const okCategory = !category || category === 'all' || c.category === category;
    const okKeyword =
      !kw || c.brand.includes(kw) || c.title.includes(kw) || c.platform.includes(kw);
    return okPlatform && okCategory && okKeyword;
  });

  return { list };
}
