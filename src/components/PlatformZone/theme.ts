/**
 * 平台外卖专区主题配置
 * 三平台同构页面（定位 + 金刚区 + 券横幅 + 附近门店），仅品牌色与文案不同。
 * 颜色通过 CSS 自定义属性注入组件根节点，样式见 index.module.scss。
 */
import type { PlatformCode } from '@/types/coupon';

export interface ZoneTheme {
  /** Header 渐变背景（完整 CSS gradient） */
  headerGradient: string;
  /** 定位栏主文字色 */
  headerText: string;
  /** 定位栏弱化文字色（定位中/失败） */
  headerTextDim: string;
  /** 定位栏箭头色 */
  headerArrow: string;
  /** 「重新定位」按钮底色 */
  relocateBg: string;
  /** 「重新定位」文字色 */
  relocateText: string;
  /** 金刚区文字色 */
  kkLabel: string;
  /** 金刚区选中项底色 */
  kkActiveBg: string;
  /** 金刚区选中项文字色 */
  kkActiveText: string;
  /** 券卡片底色 */
  chipBg: string;
  /** 券卡片描边色 */
  chipBorder: string;
  /** 「去下单」按钮底色 */
  orderBg: string;
  /** 「去下单」按钮文字色 */
  orderText: string;
  /** 「去下单」按钮阴影 */
  orderShadow: string;
  /** 搜索框 placeholder 颜色 */
  placeholderColor: string;
}

export const ZONE_THEME: Record<PlatformCode, ZoneTheme> = {
  meituan: {
    headerGradient: 'linear-gradient(170deg, #ffe14d 0%, #ffc300 70%, #ffb300 100%)',
    headerText: '#4a3200',
    headerTextDim: '#8a6d1f',
    headerArrow: '#6b5312',
    relocateBg: 'rgba(255, 255, 255, 0.75)',
    relocateText: '#a16b00',
    kkLabel: '#5c4400',
    kkActiveBg: 'rgba(255, 255, 255, 0.55)',
    kkActiveText: '#e8590c',
    chipBg: '#fff7e0',
    chipBorder: '#ffd100',
    orderBg: '#ffd100',
    orderText: '#4a3200',
    orderShadow: '0 4rpx 12rpx rgba(255, 195, 0, 0.4)',
    placeholderColor: '#9b7b2e'
  },
  eleme: {
    headerGradient: 'linear-gradient(170deg, #2fa9ff 0%, #0090ff 70%, #0080ee 100%)',
    headerText: '#ffffff',
    headerTextDim: 'rgba(255, 255, 255, 0.85)',
    headerArrow: 'rgba(255, 255, 255, 0.9)',
    relocateBg: 'rgba(255, 255, 255, 0.25)',
    relocateText: '#ffffff',
    kkLabel: 'rgba(255, 255, 255, 0.95)',
    kkActiveBg: 'rgba(255, 255, 255, 0.25)',
    kkActiveText: '#ffffff',
    chipBg: '#eaf5ff',
    chipBorder: '#9fd0ff',
    orderBg: '#0097ff',
    orderText: '#ffffff',
    orderShadow: '0 4rpx 12rpx rgba(0, 151, 255, 0.35)',
    placeholderColor: '#7aa6c9'
  },
  taobao: {
    headerGradient: 'linear-gradient(170deg, #ff8a00 0%, #ff5a00 60%, #ff3d00 100%)',
    headerText: '#ffffff',
    headerTextDim: 'rgba(255, 255, 255, 0.85)',
    headerArrow: 'rgba(255, 255, 255, 0.9)',
    relocateBg: 'rgba(255, 255, 255, 0.25)',
    relocateText: '#ffffff',
    kkLabel: 'rgba(255, 255, 255, 0.95)',
    kkActiveBg: 'rgba(255, 255, 255, 0.25)',
    kkActiveText: '#ffffff',
    chipBg: '#fff1eb',
    chipBorder: '#ffc2a8',
    orderBg: '#ff5000',
    orderText: '#ffffff',
    orderShadow: '0 2px 6px rgba(255, 80, 0, 0.35)',
    placeholderColor: '#c98a70'
  },
  jd: {
    headerGradient: 'linear-gradient(170deg, #f03a3a 0%, #e1251b 60%, #c81623 100%)',
    headerText: '#ffffff',
    headerTextDim: 'rgba(255, 255, 255, 0.85)',
    headerArrow: 'rgba(255, 255, 255, 0.9)',
    relocateBg: 'rgba(255, 255, 255, 0.25)',
    relocateText: '#ffffff',
    kkLabel: 'rgba(255, 255, 255, 0.95)',
    kkActiveBg: 'rgba(255, 255, 255, 0.25)',
    kkActiveText: '#ffffff',
    chipBg: '#fff0f0',
    chipBorder: '#ffc4c4',
    orderBg: '#e1251b',
    orderText: '#ffffff',
    orderShadow: '0 4rpx 12rpx rgba(225, 37, 27, 0.35)',
    placeholderColor: '#c98a8a'
  }
};
