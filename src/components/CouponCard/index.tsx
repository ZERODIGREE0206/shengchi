import React from 'react';
import { View, Text } from '@tarojs/components';
import classnames from 'classnames';
import type { Coupon } from '@/types/coupon';
import BrandIcon from '@/components/BrandIcon';
import PlatformIcon from '@/components/PlatformIcon';
import styles from './index.module.scss';

interface CouponCardProps {
  /** 优惠券数据 */
  coupon: Coupon;
  /** 点击「去领取」回调 */
  onClaim: (coupon: Coupon) => void;
}

/**
 * 优惠券卡片：品牌信息 + 优惠描述 + 领取按钮（票券式布局）
 */
const CouponCard: React.FC<CouponCardProps> = ({ coupon, onClaim }) => {
  const handleClaim = () => {
    if (coupon.claimed) return;
    console.log('[CouponCard] claim coupon:', coupon.id, coupon.brand);
    onClaim(coupon);
  };

  return (
    <View className={styles.card}>
      {/* 品牌区：有官方 Logo 渲染 BrandIcon，否则回退 emoji 色块 */}
      <View className={styles.brandArea}>
        {coupon.brandLogo ? (
          <BrandIcon brand={coupon.brandLogo} />
        ) : (
          <View className={styles.logo} style={{ backgroundColor: coupon.bgColor }}>
            <Text className={styles.logoEmoji}>{coupon.emoji}</Text>
          </View>
        )}
        <View className={styles.brandInfo}>
          <View className={styles.brandRow}>
            <Text className={styles.brandName}>{coupon.brand}</Text>
            {coupon.tag ? <Text className={styles.tag}>{coupon.tag}</Text> : null}
          </View>
          <View className={styles.platformRow}>
            <PlatformIcon platform={coupon.platformCode} size="sm" />
            <Text className={styles.platform}>{coupon.platform}</Text>
          </View>
        </View>
      </View>

      {/* 票券虚线分隔 */}
      <View className={styles.divider} />

      {/* 优惠信息 + 领取按钮 */}
      <View className={styles.offerArea}>
        <View className={styles.offerText}>
          <Text className={styles.offerTitle}>{coupon.title}</Text>
          <Text className={styles.offerDesc}>{coupon.desc}</Text>
        </View>
        <View
          className={classnames(styles.claimBtn, coupon.claimed && styles.claimed)}
          onClick={handleClaim}
        >
          <Text className={styles.claimBtnText}>{coupon.claimed ? '已领取' : '去领取'}</Text>
        </View>
      </View>
    </View>
  );
};

export default CouponCard;
