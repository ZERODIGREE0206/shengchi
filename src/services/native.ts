/**
 * Capacitor App 原生能力桥
 *
 * App 本质是把 Taro H5 产物装进 WebView（process.env.TARO_ENV === 'h5'），
 * 但浏览器 H5 的两个关键能力在 WebView 里不可靠：
 * - window.open 外链：WebView 默认不弹系统浏览器，页面会在 App 内被顶掉或静默失败
 * - navigator.geolocation：依赖系统定位权限与 WebView 开关，桌面降级的 8s 超时策略不适合手机
 *
 * 这里用 Capacitor 插件补上，并统一 isNativeApp() 判断（H5 浏览器里恒为 false，
 * 不影响纯 H5 / 微信小程序行为）
 */
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { Geolocation } from '@capacitor/geolocation';

/** 是否运行在 Capacitor App（Android WebView）中 */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** 打开外部链接：App 内用 Custom Tab（不顶掉 App），H5 浏览器新标签 */
export async function openExternalUrl(url: string): Promise<void> {
  if (isNativeApp()) {
    try {
      await Browser.open({ url });
      return;
    } catch (err) {
      console.warn('[native] Browser.open failed, fallback window.open:', err);
    }
  }
  if (typeof window !== 'undefined') {
    window.open(url, '_blank');
  }
}

export interface NativePosition {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

/** 原生 GPS 定位（仅 App；返回 WGS84 坐标，调用方负责转 GCJ02） */
export async function getNativePosition(timeoutMs = 15000): Promise<NativePosition> {
  const res = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: timeoutMs
  });
  return {
    latitude: res.coords.latitude,
    longitude: res.coords.longitude,
    accuracy: res.coords.accuracy
  };
}
