/**
 * 登录态状态store（模块级单例 + 订阅，不用 React Context）
 * - Taro tab 页常驻不重挂载，Context 全树 re-render 代价大；模块单例 + useSyncExternalStore 更轻
 * - 匿名浏览与手机号登录共存：未登录走 CloudBase 匿名会话（ensureSession 兜底），
 *   登录后切手机号会话，券领取/已领列表自动跟随 auth.uid()
 * - 页面在 useDidShow 中调 refreshAuthState() 兜底（H5 多标签页事件不可靠）
 */
import { useSyncExternalStore } from 'react';
import Taro from '@tarojs/taro';
import { getApp, ensureSession, resetSessionCache, signOut } from './cloudbase';

/** 手机号本地缓存 key（SDK user 上 phone 字段缺失时兜底展示） */
const PHONE_STORAGE_KEY = 'shengchi_user_phone';

export type AuthStatus = 'loading' | 'anonymous' | 'phone';

export interface AuthState {
  /** loading=首次刷新中；anonymous=匿名浏览；phone=手机号登录 */
  status: AuthStatus;
  /** 当前会话 uid（CloudBase auth.uid，券按此隔离） */
  uid: string | null;
  /** 登录用户的手机号（匿名时为 null） */
  phone: string | null;
}

let state: AuthState = { status: 'loading', uid: null, phone: null };
const listeners = new Set<() => void>();

function setState(next: Partial<AuthState>): void {
  state = { ...state, ...next };
  listeners.forEach((fn) => fn());
}

/** 读取当前登录态快照（useSyncExternalStore getSnapshot 用，返回引用必须稳定） */
export function getAuthState(): AuthState {
  return state;
}

/** 订阅登录态变化，返回取消订阅函数 */
export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** React hook：组件内订阅登录态（tab 页需配合 useDidShow 里调 refreshAuthState） */
export function useAuthState(): AuthState {
  return useSyncExternalStore(subscribeAuth, getAuthState, getAuthState);
}

/** 拉取会话并刷新状态（无会话时自动匿名登录兜底，保证浏览/领券不中断） */
export async function refreshAuthState(): Promise<AuthState> {
  try {
    await ensureSession();
    const auth = getApp().auth({ persistence: 'local' });
    const sessionRes: any = await auth.getSession();
    const user = sessionRes?.data?.session?.user;
    const uid: string | null = user?.id ?? null;
    const phone: string | null =
      user?.phone_number || user?.phone || Taro.getStorageSync(PHONE_STORAGE_KEY) || null;
    setState({ status: phone ? 'phone' : 'anonymous', uid, phone });
  } catch (err) {
    console.error('[auth] refresh state failed:', err);
    setState({ status: 'anonymous', uid: null, phone: null });
  }
  return state;
}

/** 发送短信验证码（返回 SDK 响应，data.verifyOtp 回调供登录使用） */
export async function sendPhoneCode(phone: string): Promise<any> {
  const auth = getApp().auth({ persistence: 'local' });
  return auth.signInWithOtp({ phone });
}

/**
 * 验证码登录（注册/登录一体）+ 匿名领取迁移
 * @param otp sendPhoneCode 返回的 data（含 verifyOtp 回调）
 * @param phone 登录手机号
 * @param code 用户输入的验证码
 * @param oldUid 登录前的匿名 uid（用于迁移匿名期间的领取记录）
 */
export async function loginWithPhoneCode(
  otp: { verifyOtp: (p: { token: string }) => Promise<any> },
  phone: string,
  code: string,
  oldUid: string | null
): Promise<{ ok: boolean; migrated: number; errorMsg?: string }> {
  // 1. 校验验证码完成登录（verifyOtp 是 signInWithOtp 返回对象上的回调，勿调独立 auth.verifyOtp）
  const res = await otp.verifyOtp({ token: code });
  if (res?.error) {
    return { ok: false, migrated: 0, errorMsg: res.error.message || '验证码校验失败' };
  }

  // 2. 重置会话缓存（旧匿名 token 已失效）并记录手机号
  resetSessionCache();
  Taro.setStorageSync(PHONE_STORAGE_KEY, phone);
  await refreshAuthState();

  // 3. 迁移匿名期间的领取记录到手机号账号（失败不阻塞登录）
  let migrated = 0;
  const newUid = state.uid;
  if (oldUid && newUid && oldUid !== newUid) {
    try {
      const db: any = getApp().rdb();
      const { data, error } = await db.rpc('migrate_claims', { p_old_uid: oldUid });
      if (!error) {
        const r = typeof data === 'string' ? JSON.parse(data) : data;
        migrated = r?.migrated || 0;
      } else {
        console.error('[auth] migrate_claims error:', error);
      }
    } catch (err) {
      console.error('[auth] migrate_claims failed:', err);
    }
  }
  return { ok: true, migrated };
}

/** 退出登录：清会话与本地手机号，回匿名会话（券保留在手机号账号中） */
export async function signOutAccount(): Promise<void> {
  try {
    await signOut();
  } finally {
    Taro.removeStorageSync(PHONE_STORAGE_KEY);
  }
  await refreshAuthState();
}

/**
 * 登录拦截（领券/下单等需登录操作的统一入口）：
 * - 已手机号登录 → 直接放行
 * - 未登录/状态未知 → 先刷新一次登录态（避免首屏 loading 误判），仍未登录则弹窗引导去登录页
 *
 * @param actionText 受保护的动作描述，如「领券」「下单」
 * @returns true=已登录可继续；false=未登录（已弹引导，调用方应中止后续动作）
 */
export async function requireLogin(actionText = '领券'): Promise<boolean> {
  // 首次进入状态可能还是 loading，拉取一次真实登录态再判定
  if (state.status === 'loading') {
    await refreshAuthState();
  }
  if (state.status === 'phone') return true;

  try {
    const res = await Taro.showModal({
      title: '请先登录',
      content: `登录后才能${actionText}，登录后优惠券还会同步到你的账号，换设备也不丢失。`,
      confirmText: '去登录',
      cancelText: '再看看',
      showCancel: true
    });
    if (res.confirm) {
      Taro.navigateTo({ url: '/pages/login/index' });
    }
  } catch { /* 用户取消等情况静默处理 */ }
  return false;
}

/** 手机号脱敏：138****5678 */
export function maskPhone(phone: string): string {
  return phone.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}
