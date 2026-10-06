import type { PlatformCode } from '@/types/coupon';

/** 平台元数据（官方 Logo 由 PlatformIcon 组件按 code 渲染） */
export interface PlatformMeta {
  /** 平台编码 */
  code: PlatformCode;
  /** 平台全称（卡片展示） */
  name: string;
  /** 平台短名（标签栏展示） */
  shortName: string;
}

/** 平台跳转配置（「去使用/去领取」落地下单用） */
export interface PlatformJumpMeta {
  /** 微信小程序 appId（微信端 navigateToMiniProgram；微信无法互跳的平台不配置） */
  miniAppId?: string;
  /** 微信小程序页面路径（空则打开目标小程序首页） */
  miniPath?: string;
  /** H5 落地页（H5 端 / 兜底复制引导用） */
  h5Url: string;
  /** 复制链接后的引导文案 */
  copyTip: string;
}

export const PLATFORM_META: Record<PlatformCode, PlatformMeta> = {
  meituan: {
    code: 'meituan',
    name: '美团外卖',
    shortName: '美团'
  },
  eleme: {
    code: 'eleme',
    name: '饿了么',
    shortName: '饿了么'
  },
  taobao: {
    code: 'taobao',
    name: '淘宝闪购',
    shortName: '淘宝闪购'
  },
  jd: {
    code: 'jd',
    name: '京东外卖',
    shortName: '京东'
  }
};

/**
 * 平台跳转配置
 * - 美团/饿了么/淘宝闪购/京东：微信端跳官方小程序（appId 为官方公开值），H5 端复制官方落地页
 *   （淘宝闪购与饿了么同属阿里本地生活，appId 相同：wxece3a9a4c82f58c9；
 *     京东外卖入口在京东官方购物小程序内：wx91d27dbf599dff74「京东购物丨点外卖领国补」）
 */
export const PLATFORM_JUMP: Record<PlatformCode, PlatformJumpMeta> = {
  meituan: {
    miniAppId: 'wxde8ac0a21135c07d',
    miniPath: '',
    h5Url: 'https://h5.waimai.meituan.com/waimai/mindex/home',
    copyTip: '美团链接已复制，请打开美团APP下单'
  },
  eleme: {
    miniAppId: 'wxece3a9a4c82f58c9',
    miniPath: '',
    h5Url: 'https://h5.ele.me',
    copyTip: '饿了么链接已复制，请打开饿了么APP下单'
  },
  taobao: {
    miniAppId: 'wxece3a9a4c82f58c9',
    miniPath: '',
    h5Url: 'https://h5.m.taobao.com',
    copyTip: '淘宝链接已复制，请打开淘宝APP下单'
  },
  jd: {
    miniAppId: 'wx91d27dbf599dff74',
    miniPath: '',
    h5Url: 'https://waimai.jd.com/',
    copyTip: '京东链接已复制，请打开京东APP下单'
  }
};

/** 平台列表（用于标签栏遍历） */
export const PLATFORM_LIST: PlatformMeta[] = [
  PLATFORM_META.meituan,
  PLATFORM_META.eleme,
  PLATFORM_META.taobao,
  PLATFORM_META.jd
];
