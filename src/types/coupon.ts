// 优惠券数据类型定义

/** 投放平台编码：美团 / 饿了么 / 淘宝闪购 / 京东外卖 */
export type PlatformCode = 'meituan' | 'eleme' | 'taobao' | 'jd';

/** 品类编码（分类页筛选）：汉堡披萨 / 咖啡 / 茶饮 / 火锅 / 中式快餐 / 粉面小吃 */
/** 品类编码：'all' 表示全品类通用券（无门槛红包等），其余为具体品类 */
export type CategoryCode = 'burger' | 'coffee' | 'tea' | 'hotpot' | 'chinese' | 'snack' | 'all';

/** 已有官方/开源品牌图标的品牌标识（无图标的品牌回退为 emoji） */
export type BrandLogoKey =
  | 'kfc'
  | 'mcdonalds'
  | 'luckincoffee'
  | 'pizzahut'
  | 'mixue'
  | 'burgerking'
  | 'starbucks'
  | 'wallace'
  | 'guming'
  | 'chabaidao'
  | 'dicos'
  | 'heytea'
  | 'haidilao';

/**
 * 外卖优惠券
 */
export interface Coupon {
  /** 优惠券唯一 id */
  id: string;
  /** 品牌名称 */
  brand: string;
  /** 品牌图标 emoji */
  emoji: string;
  /** 品牌色块背景色（用于 emoji 兜底底色） */
  bgColor: string;
  /** 品牌官方 Logo 标识（存在时渲染 BrandIcon，否则回退 emoji） */
  brandLogo?: BrandLogoKey;
  /** 优惠标题，如「满 50 减 15」 */
  title: string;
  /** 优惠补充描述，如「全场通用」 */
  desc: string;
  /** 投放平台名称，如「美团外卖」 */
  platform: string;
  /** 投放平台编码（用于分类筛选） */
  platformCode: PlatformCode;
  /** 所属品类编码（分类页筛选用） */
  category?: CategoryCode;
  /** 角标标签，如「热门」「限时」 */
  tag?: string;
  /** 联盟推广/领券链接（存在时「去使用」优先复制引导；空则按平台默认跳转） */
  claimUrl?: string;
  /** 是否已领取 */
  claimed?: boolean;
}

/** 已领取的优惠券（我的页展示：券信息 + 领取时间） */
export interface ClaimedCoupon extends Coupon {
  /** 领取时间（ISO 字符串） */
  claimedAt: string;
}
