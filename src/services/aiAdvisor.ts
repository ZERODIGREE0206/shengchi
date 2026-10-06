/**
 * AI 点餐顾问服务
 *
 * 与 reverseGeocode 同一通道：直接 fetch 云函数网关端点
 * /v1/functions/aiAdvisor，用 SDK auth 会话的 accessToken 作 Bearer。
 * Key 只存在云函数环境变量，前端不接触。
 */
import { getApp, ensureSession, CLOUDBASE_ENV_ID } from './cloudbase';
import type { PlatformCode } from '@/types/coupon';

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** 喂给大模型的门店快照（MixedStore 子集） */
export interface AiStoreSnapshot {
  platformCode: string;
  name: string;
  category: string;
  rating: number;
  monthlySales: number;
  deliveryFee: number;
  minOrder: number;
  distanceKm: number;
}

export interface AiCouponSnapshot {
  platformCode: string;
  brand: string;
  title: string;
  desc: string;
}

export interface AiPick {
  platformCode: PlatformCode;
  storeName: string;
  reason: string;
  estPrice: number | null;
}

export interface AiAdviceResult {
  success: boolean;
  message?: string;
  reply: string;
  picks: AiPick[];
}

interface CallAiParams {
  messages: AiChatMessage[];
  stores: AiStoreSnapshot[];
  coupons: AiCouponSnapshot[];
  address?: string | null;
}

async function getSessionAccessToken(): Promise<string | undefined> {
  // 复用 cloudbase 模块的单例会话（getSession 返回 Promise，需 await）
  const auth = (getApp() as any).auth({ persistence: 'local' });
  const session: any = await auth.getSession();
  return session?.data?.session?.accessToken || session?.data?.session?.access_token;
}

export async function askOrderAdvisor(params: CallAiParams): Promise<AiAdviceResult> {
  await ensureSession();
  const accessToken = await getSessionAccessToken();
  if (!accessToken) {
    return { success: false, message: '登录态准备中，请稍后再试', reply: '', picks: [] };
  }

  const url = `https://${CLOUDBASE_ENV_ID}.api.tcloudbasegateway.com/v1/functions/aiAdvisor`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(params)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    console.warn('[aiAdvisor] HTTP error:', res.status, errText);
    return { success: false, message: `服务暂不可用（${res.status}）`, reply: '', picks: [] };
  }

  const data = await res.json().catch(() => null);
  if (!data || data.success === false) {
    return {
      success: false,
      message: data?.message || '顾问暂时不可用',
      reply: data?.reply || '',
      picks: Array.isArray(data?.picks) ? data.picks : []
    };
  }
  return {
    success: true,
    reply: data.reply || '',
    picks: Array.isArray(data.picks) ? data.picks : []
  };
}
