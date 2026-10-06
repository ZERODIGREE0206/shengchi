import React from 'react';
import { View } from '@tarojs/components';
import classnames from 'classnames';
import type { BrandLogoKey } from '@/types/coupon';
import styles from './index.module.scss';

interface BrandIconProps {
  /** 品牌 Logo 标识 */
  brand: BrandLogoKey;
}

/**
 * 餐饮品牌 Logo 图标
 * 图标来源（开源品牌库，可追溯）：
 * - KFC / 麦当劳 / 汉堡王 / 星巴克：Simple Icons（CC0）
 * - 蜜雪冰城：thesvg-color（MIT）
 * - 必胜客 / 瑞幸咖啡：Arcticons（CC BY-SA 4.0），已着品牌色
 * 使用 data URI 背景图渲染，兼容微信/支付宝小程序与 H5
 */
const BrandIcon: React.FC<BrandIconProps> = ({ brand }) => {
  return <View className={classnames(styles.brandIcon, styles.md, styles[brand])} />;
};

export default BrandIcon;
