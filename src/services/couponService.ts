import { fetchCoupons as fetchCouponsApi, claimCoupon as claimCouponApi, fetchMyClaims as fetchMyClaimsApi } from './cloudbase';
import type { Coupon, ClaimedCoupon } from '@/types/coupon';

export interface FetchCouponsParams {
  /** 平台筛选：meituan / eleme / taobao，空为全部 */
  platformCode?: string;
  /** 品类筛选：burger / coffee / tea / hotpot / all */
  category?: string;
  /** 关键词搜索（品牌/标题/描述） */
  keyword?: string;
}

/**
 * 获取券源列表（CloudBase PostgreSQL 券池，RLS 仅返回 active 券）
 */
export async function fetchCoupons(params: FetchCouponsParams = {}): Promise<Coupon[]> {
  return fetchCouponsApi(params);
}

/**
 * 领取优惠券（数据库 RPC：匿名身份防重复领取 + 库存原子扣减）
 */
export async function claimCouponById(
  couponId: string
): Promise<{ claimed: boolean; alreadyClaimed: boolean }> {
  return claimCouponApi(couponId);
}

/**
 * 查询当前用户已领券列表（数据库 RPC：按登录身份过滤，领取时间倒序）
 */
export async function fetchMyClaims(): Promise<ClaimedCoupon[]> {
  return fetchMyClaimsApi();
}
