import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classnames from 'classnames';
import BrandIcon from '@/components/BrandIcon';
import { fetchCoupons, claimCouponById } from '@/services/couponService';
import { requireLogin } from '@/services/auth';
import { CATEGORY_LIST } from '@/data/categories';
import type { Coupon } from '@/types/coupon';
import styles from './index.module.scss';

/**
 * 分类页：左侧品类栏 + 右侧品牌优惠列表
 * 数据来源：services/couponService（微信端走云函数 getCoupons，H5 预览自动回落 mock）
 */
const CategoryPage: React.FC = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  // 当前选中品类；'all' 表示全部
  const [active, setActive] = useState<string>('all');

  // 加载券源
  const loadCoupons = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const list = await fetchCoupons();
      setCoupons(list);
    } catch (err) {
      console.error('[CategoryPage] load coupons failed:', err);
      setErrorMsg('券源加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
  }, []);

  // 按品类筛选
  const filtered = useMemo(
    () => (active === 'all' ? coupons : coupons.filter((c) => c.category === active)),
    [coupons, active]
  );

  const countOf = (code: string) =>
    code === 'all' ? coupons.length : coupons.filter((c) => c.category === code).length;

  const activeName = CATEGORY_LIST.find((c) => c.code === active)?.name ?? '全部';

  const handleClaim = async (coupon: Coupon) => {
    if (!(await requireLogin('领取优惠券'))) return;
    try {
      const res = await claimCouponById(coupon.id);
      if (res.alreadyClaimed) {
        Taro.showToast({ title: '已领取过该券', icon: 'none' });
      } else {
        Taro.showToast({ title: '领取成功', icon: 'success' });
      }
      setCoupons((prev) =>
        prev.map((c) => (c.id === coupon.id ? { ...c, claimed: true } : c))
      );
    } catch (err) {
      console.error('[CategoryPage] claim failed:', err);
      Taro.showToast({ title: '领取失败，请重试', icon: 'none' });
    }
  };

  return (
    <View className={styles.page}>
      {/* 顶部渐变 Header */}
      <View className={styles.header}>
        <Text className={styles.title}>优惠分类</Text>
        <Text className={styles.subtitle}>按品类找到心仪的优惠 🍽️</Text>
      </View>

      <View className={styles.body}>
        {/* 左侧品类栏 */}
        <ScrollView scrollY className={styles.sidebar} enhanced showScrollbar={false}>
          {CATEGORY_LIST.map((cat) => {
            const isActive = active === cat.code;
            return (
              <View
                key={cat.code}
                className={classnames(styles.sideItem, isActive && styles.sideItemActive)}
                onClick={() => setActive(cat.code)}
              >
                <Text className={styles.sideIcon}>{cat.icon}</Text>
                <Text
                  className={classnames(styles.sideName, isActive && styles.sideNameActive)}
                >
                  {cat.name}
                </Text>
                <Text
                  className={classnames(
                    styles.sideCount,
                    isActive && styles.sideCountActive
                  )}
                >
                  {countOf(cat.code)} 张
                </Text>
              </View>
            );
          })}
        </ScrollView>

        {/* 右侧品牌优惠列表 */}
        <ScrollView scrollY className={styles.content} enhanced showScrollbar={false}>
          {/* 加载骨架屏 */}
          {loading && (
            <View className={styles.skeletonList}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} className={styles.skeletonCard}>
                  <View className={styles.skeletonLogo} />
                  <View className={styles.skeletonLines}>
                    <View className={styles.skeletonLine} style={{ width: '40%' }} />
                    <View className={styles.skeletonLine} style={{ width: '72%' }} />
                    <View className={styles.skeletonLine} style={{ width: '56%' }} />
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* 加载失败：错误提示 + 重试 */}
          {!loading && errorMsg && (
            <View className={styles.errorBox}>
              <Text className={styles.errorIcon}>📡</Text>
              <Text className={styles.errorText}>{errorMsg}</Text>
              <Text className={styles.errorTip}>请检查网络后重试</Text>
              <View className={styles.retryBtn} onClick={loadCoupons}>
                <Text className={styles.retryText}>重新加载</Text>
              </View>
            </View>
          )}

          {/* 券列表 */}
          {!loading && !errorMsg && (
            <View className={styles.card}>
              <View className={styles.cardHeader}>
                <View className={styles.titleBar} />
                <Text className={styles.cardTitle}>{activeName}</Text>
                <Text className={styles.cardCount}>共 {filtered.length} 张</Text>
              </View>

              {filtered.map((coupon) => (
                <View key={coupon.id} className={styles.brandRow}>
                  {/* 品牌 Logo（无 Logo 时回退 emoji 色块） */}
                  {coupon.brandLogo ? (
                    <BrandIcon brand={coupon.brandLogo} />
                  ) : (
                    <View
                      className={styles.logoFallback}
                      style={{ backgroundColor: coupon.bgColor }}
                    >
                      <Text className={styles.logoEmoji}>{coupon.emoji}</Text>
                    </View>
                  )}

                  <View className={styles.brandInfo}>
                    <View className={styles.brandLine}>
                      <Text className={styles.brandName}>{coupon.brand}</Text>
                      <Text className={styles.brandPlatform}>{coupon.platform}</Text>
                    </View>
                    <Text className={styles.offerTitle}>{coupon.title}</Text>
                    <Text className={styles.offerDesc}>{coupon.desc}</Text>
                  </View>

                  <View
                    className={classnames(
                      styles.claimBtn,
                      coupon.claimed && styles.claimBtnClaimed
                    )}
                    onClick={() => !coupon.claimed && handleClaim(coupon)}
                  >
                    <Text
                      className={classnames(
                        styles.claimText,
                        coupon.claimed && styles.claimTextClaimed
                      )}
                    >
                      {coupon.claimed ? '已领取' : '去领取'}
                    </Text>
                  </View>
                </View>
              ))}

              {filtered.length === 0 && (
                <View className={styles.emptyTipBox}>
                  <Text className={styles.emptyTipText}>该品类暂无优惠，去看看其他品类吧</Text>
                </View>
              )}
            </View>
          )}

          <View className={styles.listFooter}>
            <Text className={styles.listFooterText}>— 更多优惠持续更新中 —</Text>
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

export default CategoryPage;
