import type { CategoryCode } from '@/types/coupon';

/** 分类项 */
export interface CategoryItem {
  /** 品类编码；'all' 表示全部 */
  code: CategoryCode | 'all';
  /** 品类名称 */
  name: string;
  /** 品类图标 emoji */
  icon: string;
}

/**
 * 分类页左侧品类栏
 * 与优惠券数据的 category 字段对应
 */
export const CATEGORY_LIST: CategoryItem[] = [
  { code: 'all', name: '全部', icon: '🍽️' },
  { code: 'burger', name: '汉堡披萨', icon: '🍔' },
  { code: 'coffee', name: '咖啡', icon: '☕' },
  { code: 'tea', name: '茶饮', icon: '🧋' },
  { code: 'chinese', name: '中式快餐', icon: '🍚' },
  { code: 'snack', name: '粉面小吃', icon: '🍜' },
  { code: 'hotpot', name: '火锅', icon: '🍲' }
];
