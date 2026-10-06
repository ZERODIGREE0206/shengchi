/**
 * CloudBase 数据服务（Web / 微信小程序内置适配器，一套代码多端可用）
 * - 通过 @cloudbase/js-sdk rdb() 访问 PostgreSQL（底层 PostgREST 语法）
 * - 匿名会话支撑免登录领券；防重复领取由数据库 RPC + 唯一索引保证
 * - Publishable Key 设计上可暴露在浏览器（代表匿名身份），不用于提权
 */
import Tcb from '@cloudbase/js-sdk';
import Taro from '@tarojs/taro';
import type { Coupon, ClaimedCoupon } from '@/types/coupon';

/** CloudBase 环境 ID（通过 .env 的 TARO_APP_CLOUDBASE_ENV 配置，参考 .env.example） */
export const CLOUDBASE_ENV_ID = process.env.TARO_APP_CLOUDBASE_ENV || '';

if (!CLOUDBASE_ENV_ID) {
  console.warn('[cloudbase] 未配置 TARO_APP_CLOUDBASE_ENV：请复制 .env.example 为 .env 并填写你的环境 ID');
}

/** Publishable Key（匿名身份凭证，仅限前端初始化 SDK 用；通过 .env 的 TARO_APP_TCB_ACCESS_KEY 配置） */
const ACCESS_KEY = process.env.TARO_APP_TCB_ACCESS_KEY || '';

let appInstance: any = null;
let sessionPromise: Promise<void> | null = null;

/** 获取 CloudBase 应用实例（单例），供其它服务复用会话/鉴权 */
export function getApp(): any {
  if (!appInstance) {
    appInstance = Tcb.init({
      env: CLOUDBASE_ENV_ID,
      clientId: CLOUDBASE_ENV_ID,
      accessKey: ACCESS_KEY
    });
  }
  return appInstance;
}

/** 确保存在匿名登录会话（单例 Promise；失败时重置以便下次重试） */
export async function ensureSession(): Promise<void> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const auth = getApp().auth({ persistence: 'local' });
      const session = await auth.getSession();
      if (!session?.data?.session) {
        const { error } = await auth.signInAnonymously();
        if (error) throw new Error(error.message || '登录失败，请稍后再试');
      }
    })().catch((err) => {
      sessionPromise = null;
      throw err;
    });
  }
  return sessionPromise;
}

/**
 * 重置会话缓存（手机号登录 / 登出后必须调用）：
 * 旧缓存 Promise 持有失效的匿名 accessToken，不重置会导致网关请求 401
 */
export function resetSessionCache(): void {
  sessionPromise = null;
}

/** 退出登录（清会话；下次 ensureSession 自动重建匿名会话） */
export async function signOut(): Promise<void> {
  try {
    const auth = getApp().auth({ persistence: 'local' });
    await auth.signOut();
  } finally {
    resetSessionCache();
  }
}

/** 数据库行 → 前端 Coupon 模型 */
function mapRow(row: any): Coupon {
  return {
    id: row.coupon_id,
    brand: row.brand,
    emoji: row.emoji || '🍽️',
    bgColor: row.bg_color || '#fde8e8',
    brandLogo: row.brand_logo || undefined,
    category: row.category,
    title: row.title,
    desc: row.description || '',
    platform: row.platform || '',
    platformCode: row.platform_code,
    tag: row.tag || undefined,
    claimUrl: row.claim_url || undefined
  };
}

export interface FetchCouponsParams {
  /** 平台筛选：meituan / eleme / taobao，空为全部 */
  platformCode?: string;
  /** 品类筛选：burger / coffee / tea / hotpot，空为全部 */
  category?: string;
  /** 关键词搜索（标题/描述/品牌，PostgREST ilike） */
  keyword?: string;
}

/**
 * 获取券源列表（CloudBase PostgreSQL 券池，RLS 仅返回 active 券）
 * 排序：weight 降序 → created_at 降序，最多 50 条
 */
export async function fetchCoupons(params: FetchCouponsParams = {}): Promise<Coupon[]> {
  await ensureSession();
  const db: any = getApp().rdb();
  let query = db.from('coupons').select('*').eq('status', 'active');
  if (params.platformCode) {
    query = query.eq('platform_code', params.platformCode);
  }
  if (params.category && params.category !== 'all') {
    query = query.eq('category', params.category);
  }
  if (params.keyword) {
    // PostgREST or 表达式对保留字符敏感，过滤可能破坏查询的字符
    const safe = String(params.keyword).replace(/[(),%*]/g, '');
    query = query.or(
      `title.ilike.%${safe}%,description.ilike.%${safe}%,brand.ilike.%${safe}%`
    );
  }
  const { data, error } = await query
    .order('weight', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message || '查询优惠失败');
  return (data || []).map(mapRow);
}

/**
 * 领取优惠券（数据库 RPC claim_coupon：SECURITY DEFINER，
 * 服务端核验身份 + 唯一约束防重复 + 库存原子扣减）
 */
export async function claimCoupon(
  couponId: string
): Promise<{ claimed: boolean; alreadyClaimed: boolean }> {
  await ensureSession();
  const db: any = getApp().rdb();
  const { data, error } = await db.rpc('claim_coupon', { p_coupon_id: couponId });
  if (error) throw new Error(error.message || '领取失败，请稍后再试');
  const result = typeof data === 'string' ? JSON.parse(data) : data;
  if (result?.code === 'DUPLICATE') {
    return { claimed: false, alreadyClaimed: true };
  }
  if (!result?.success) {
    throw new Error(result?.message || '领取失败，请稍后再试');
  }
  return { claimed: true, alreadyClaimed: false };
}

/** 查询当前用户的已领券列表（数据库 RPC：按 auth.uid() 过滤，领取时间倒序） */
export async function fetchMyClaims(): Promise<ClaimedCoupon[]> {
  await ensureSession();
  const db: any = getApp().rdb();
  const { data, error } = await db.rpc('my_claims');
  if (error) throw new Error(error.message || '查询已领券失败');
  const rows: any[] = typeof data === 'string' ? JSON.parse(data) : data || [];
  return rows.map((r) => ({ ...mapRow(r), claimedAt: r.claimed_at }));
}

export interface ReverseGeocodeResult {
  status: number;
  address?: string;
  recommend?: string;
  message?: string;
  /** HTTP 401 时标记，用于触发会话重置后重试 */
  unauthorized?: boolean;
}

export interface NearbyPoi {
  id: string;
  title: string;
  address: string;
  category: string;
  location: { lat: number; lng: number };
  _distance: number;
  ad_info?: { district?: string; city?: string };
}

export interface NearbyStoresResult {
  status: number;
  count?: number;
  data?: NearbyPoi[];
  message?: string;
  unauthorized?: boolean;
}

/**
 * 周边真实门店搜索（云函数 nearbyStores 代理，腾讯位置服务）
 * Key 仅存云函数环境变量，前端不持有；与 reverseGeocode 同一鉴权链路
 */
export async function callNearbyStores(
  lat: number,
  lng: number,
  keyword = '美食',
  pageIndex = 1
): Promise<NearbyStoresResult> {
  const request = async (): Promise<NearbyStoresResult> => {
    await ensureSession();

    const auth = (getApp() as any).auth({ persistence: 'local' });
    const sessionState: any = await auth.getSession();
    const accessToken: string | undefined =
      sessionState?.data?.session?.accessToken ||
      sessionState?.data?.session?.access_token;

    if (!accessToken) {
      return { status: -2, message: 'no access token' };
    }

    const url = `https://${CLOUDBASE_ENV_ID}.api.tcloudbasegateway.com/v1/functions/nearbyStores`;
    try {
      const res: any = await Taro.request({
        url,
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        data: { lat, lng, keyword, pageIndex }
      });

      const statusCode = res.statusCode || res.status || 0;
      if (statusCode !== 200 && statusCode !== 204) {
        console.warn('[cloudbase] nearbyStores HTTP error:', statusCode, res.data);
        return { status: statusCode, message: `HTTP ${statusCode}`, unauthorized: statusCode === 401 };
      }

      return (res.data || {}) as NearbyStoresResult;
    } catch (err: any) {
      console.warn('[cloudbase] nearbyStores request failed:', err?.message || err);
      return { status: -3, message: err?.message || 'request failed' };
    }
  };

  const first = await request();
  if (first.unauthorized) {
    resetSessionCache();
    return request();
  }
  return first;
}

/** 逆地址解析（云函数 reverseGeocode 代理）
 * Key 仅存云函数环境变量，前端不持有；H5/小程序统一走此通道
 *
 * 实现说明：SDK callFunction 在 PG 环境下遭遇 EXCEED_AUTHORITY（函数安全规则
 * 对匿名会话的限制），改为直接 fetch Gateway 端点 /v1/functions/reverseGeocode，
 * 用 SDK auth 会话的 AccessToken 鉴权——与 RDB REST API 同一网关同一鉴权链路。
 */
export async function callReverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  const request = async (): Promise<ReverseGeocodeResult> => {
    await ensureSession();

    // 从 SDK auth 实例提取 AccessToken
    const auth = (getApp() as any).auth({ persistence: 'local' });
    const sessionState: any = await auth.getSession();
    const accessToken: string | undefined =
      sessionState?.data?.session?.accessToken ||
      sessionState?.data?.session?.access_token;

    if (!accessToken) {
      return { status: -2, message: 'no access token' };
    }

    // 直接调用 Gateway 函数端点（与 RDB REST API 同域名同鉴权）
    const url = `https://${CLOUDBASE_ENV_ID}.api.tcloudbasegateway.com/v1/functions/reverseGeocode`;
    const res: any = await Taro.request({
      url,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      data: { lat, lng }
    });

    const statusCode = res.statusCode || res.status || 0;
    if (statusCode !== 200 && statusCode !== 204) {
      console.warn('[cloudbase] reverseGeocode HTTP error:', statusCode, res.data);
      return { status: statusCode, message: `HTTP ${statusCode}`, unauthorized: statusCode === 401 };
    }

    const data = res.data || {};
    return data as ReverseGeocodeResult;
  };

  const first = await request();
  // 会话缓存里是失效 token（登录/登出后未重置等场景）→ 重置后重试一次
  if (first.unauthorized) {
    resetSessionCache();
    return request();
  }
  return first;
}
