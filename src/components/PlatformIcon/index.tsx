import React from 'react';
import { View } from '@tarojs/components';
import classnames from 'classnames';
import type { PlatformCode } from '@/types/coupon';
import styles from './index.module.scss';

interface PlatformIconProps {
  /** 平台编码 */
  platform: PlatformCode;
  /** 图标尺寸：sm 卡片内小图标 / md 标签栏图标 */
  size?: 'sm' | 'md';
}

/**
 * 平台官方 Logo 图标（美团 / 饿了么 / 淘宝闪购）
 * 来源：Simple Icons（美团）、Element Plus 官方图标库（饿了么）、Ant Design 官方图标库（淘宝）
 * 使用 data URI 背景图渲染，兼容微信/支付宝小程序与 H5
 */
const PlatformIcon: React.FC<PlatformIconProps> = ({ platform, size = 'md' }) => {
  return (
    <View
      className={classnames(
        styles.icon,
        size === 'sm' ? styles.sm : styles.md,
        styles[platform]
      )}
    />
  );
};

export default PlatformIcon;
