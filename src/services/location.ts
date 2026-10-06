/**
 * 定位服务：「点外卖」以我的位置为准展示附近门店
 *
 * 策略：先快速定位（1-2 秒）展示给用户，再尝试高精度优化
 * - 微信端：getLocation(isHighAccuracy) 优先 GPS，超时 5s 回退普通 WiFi/基站定位
 * - 缓存 30 秒（换地方后较快刷新）；页面进入时若有缓存先展示，后台静默刷新
 * - 逆解析走 CloudBase 云函数代理（腾讯位置服务），失败不阻塞
 */
import Taro from '@tarojs/taro';
import { callReverseGeocode } from './cloudbase';

export interface LocationInfo {
  latitude: number;
  longitude: number;
}

export type LocationStatus = 'locating' | 'located' | 'denied' | 'failed';

export interface LocationResult {
  status: LocationStatus;
  location: LocationInfo | null;
  address: string | null;
  accuracy?: number;
}

const CACHE_KEY = 'app_location_cache';
const CACHE_TTL = 30 * 1000; // 30 秒缓存

/** 高精度定位超时（GPS 信号弱时不傻等） */
const HIGH_ACC_TIMEOUT = 5000;

/**
 * 获取当前位置
 * 优先高精度（GPS），超时回退普通模式（WiFi/基站，精度低但快）
 */
export async function getLocation(forceRefresh = false): Promise<{
  status: LocationStatus;
  location: LocationInfo | null;
  accuracy?: number;
}> {
  // 非强制刷新时优先读缓存
  if (!forceRefresh) {
    const cached = readCache();
    if (cached) {
      console.log('[location] 命中缓存:', cached.latitude.toFixed(5), cached.longitude.toFixed(5));
      return { status: 'located', location: cached };
    }
  }

  const isWeapp = process.env.TARO_ENV === 'weapp';
  const coordType = isWeapp ? 'gcj02' : 'wgs84';

  try {
    let location: LocationInfo;
    let accuracy: number | undefined;

    if (isWeapp) {
      // 优先高精度 GPS，超时回退普通 WiFi/基站
      try {
        const res = await Promise.race([
          Taro.getLocation({ type: coordType, isHighAccuracy: true, highAccuracyExpireTime: HIGH_ACC_TIMEOUT } as any),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('highAccuracy timeout')), HIGH_ACC_TIMEOUT + 1000))
        ]);
        location = { latitude: res.latitude, longitude: res.longitude };
        accuracy = (res as any).accuracy;
        console.log('[location] 高精度定位成功:', accuracy?.toFixed(0) + ' 米');
      } catch (e) {
        console.warn('[location] 高精度定位超时/失败，回退普通定位:', e?.message || e?.errMsg);
        const res = await Taro.getLocation({ type: coordType } as any);
        location = { latitude: res.latitude, longitude: res.longitude };
        accuracy = (res as any).accuracy;
        console.log('[location] 普通定位成功:', accuracy?.toFixed(0) + ' 米');
      }
    } else {
      // H5：enableHighAccuracy=false 走 IP/WiFi（桌面无 GPS 不挂起），8 秒超时
      const res = await Promise.race([
        Taro.getLocation({ type: coordType, enableHighAccuracy: false } as any),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('getLocation timeout')), 8000))
      ]);
      location = { latitude: res.latitude, longitude: res.longitude };
      accuracy = (res as any).accuracy;
    }

    console.log('[location] 定位结果:', {
      lat: location.latitude.toFixed(6),
      lng: location.longitude.toFixed(6),
      accuracy: accuracy != null ? `${accuracy.toFixed(0)} 米` : '未知'
    });

    writeCache(location);
    return { status: 'located', location, accuracy };
  } catch (err: any) {
    const msg = String(err?.errMsg || err?.message || err || '');
    console.warn('[location] getLocation failed:', msg);

    if (/auth|deny|permission/i.test(msg)) {
      return { status: 'denied', location: null };
    }

    // H5 桌面端无 GPS → 降级上海（开发环境兜底）
    if (!isWeapp) {
      const fallback: LocationInfo = { latitude: 31.2304, longitude: 121.4737 };
      writeCache(fallback);
      return { status: 'located', location: fallback };
    }

    return { status: 'failed', location: null };
  }
}

/** 读取缓存（30 秒内有效） */
function readCache(): LocationInfo | null {
  try {
    const raw =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem(CACHE_KEY)
        : (Taro.getStorageSync(CACHE_KEY) as string | null);
    if (!raw) return null;
    const cached = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return { latitude: cached.latitude, longitude: cached.longitude };
    }
  } catch {
    // 存储异常忽略
  }
  return null;
}

/** 写入缓存 */
function writeCache(location: LocationInfo) {
  try {
    const data = { ...location, ts: Date.now() };
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } else {
      Taro.setStorageSync(CACHE_KEY, data);
    }
  } catch { /* 忽略 */ }
}

/** 逆地址解析 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await callReverseGeocode(lat, lng);
    if (res.status === 0) {
      return res.address || res.recommend || null;
    }
    console.warn('[location] reverseGeocode error:', res.status, res.message);
    return null;
  } catch (err) {
    console.warn('[location] reverseGeocode failed:', err);
    return null;
  }
}

/** 一步到位：定位 + 逆解析 */
export async function locateWithAddress(forceRefresh = false): Promise<LocationResult> {
  const { status, location, accuracy } = await getLocation(forceRefresh);
  if (status !== 'located' || !location) {
    return { status, location: null, address: null };
  }
  const address = await reverseGeocode(location.latitude, location.longitude);
  return { status: 'located', location, address, accuracy };
}
