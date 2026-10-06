import React, { useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import BrandIcon from '@/components/BrandIcon';
import PlatformIcon from '@/components/PlatformIcon';
import { fetchMyClaims } from '@/services/couponService';
import { openCouponPlatform } from '@/services/platformJump';
import {
  useAuthState,
  refreshAuthState,
  signOutAccount,
  maskPhone
} from '@/services/auth';
import type { ClaimedCoupon } from '@/types/coupon';
import styles from './index.module.scss';

/** 格式化领取时间：MM-DD HH:mm */
function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 我的页：用户信息 + 已领优惠券列表（真实云端数据，按登录身份过滤）
 */
const MinePage: React.FC = () => {
  const [claims, setClaims] = useState<ClaimedCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const auth = useAuthState();

  const loadClaims = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const list = await fetchMyClaims();
      setClaims(list);
    } catch (err) {
      console.error('[MinePage] load claims failed:', err);
      setErrorMsg('已领券加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 首次进入 + 每次页面显示（如从首页领券后切回本 tab）时刷新登录态与列表
  // 页面在 tab 场景下不会重新挂载，useEffect 只会执行一次，必须用 useDidShow
  useDidShow(() => {
    refreshAuthState();
    loadClaims();
  });

  // 下拉刷新
  usePullDownRefresh(async () => {
    try {
      await loadClaims();
    } finally {
      Taro.stopPullDownRefresh();
    }
  });

  // 去使用：优先复制联盟推广链接引导打开 APP，微信端跳对应平台官方小程序
  const handleUse = (coupon: ClaimedCoupon) => {
    openCouponPlatform(coupon);
  };

  // 去首页逛逛（空状态引导）
  const goHome = () => {
    Taro.switchTab({ url: '/pages/index/index' });
  };

  // 未登录：跳登录页
  const goLogin = () => {
    Taro.navigateTo({ url: '/pages/login/index' });
  };

  // 已登录：头像显示手机尾号两位，底色按 uid 哈希从暖色系取
  const phoneTail = auth.phone ? auth.phone.slice(-2) : '';
  const avatarPalette = ['#ffb340', '#ff8a3c', '#ff6b2c', '#f0654a', '#e8590c'];
  const avatarColor =
    avatarPalette[
      (auth.uid ? auth.uid.charCodeAt(0) + auth.uid.length : 0) % avatarPalette.length
    ];

  // 退出登录：确认后清会话回匿名态（券保留在手机号账号中）
  const handleLogout = () => {
    Taro.showModal({
      title: '退出登录',
      content: '领取的优惠券仍保存在你的手机号账号中，重新登录即可找回。确定退出吗？',
      confirmText: '退出',
      confirmColor: '#ff6b2c',
      success: async (res) => {
        if (!res.confirm) return;
        try {
          await signOutAccount();
          Taro.showToast({ title: '已退出登录', icon: 'none' });
        } catch (err) {
          console.error('[MinePage] sign out failed:', err);
          Taro.showToast({ title: '退出失败，请重试', icon: 'none' });
        }
      }
    });
  };

  return (
    <View className={styles.page}>
      {/* 顶部渐变 Header：用户信息 */}
      <View className={styles.header}>
        <View
          className={styles.userRow}
          onClick={auth.status === 'phone' ? undefined : goLogin}
        >
          {auth.status === 'phone' ? (
            <View className={styles.avatar} style={{ backgroundColor: avatarColor }}>
              <Text className={styles.avatarTail}>{phoneTail}</Text>
            </View>
          ) : (
            <View className={styles.avatar}>
              <Text className={styles.avatarEmoji}>👤</Text>
            </View>
          )}
          <View className={styles.userInfo}>
            {auth.status === 'phone' ? (
              <>
                <Text className={styles.userName}>{maskPhone(auth.phone || '')}</Text>
                <Text className={styles.userTip}>手机号账号 · 优惠券已同步保存</Text>
              </>
            ) : (
              <>
                <Text className={styles.userName}>未登录</Text>
                <Text className={styles.userTip}>点击登录 · 领取记录同步到账号不丢失</Text>
              </>
            )}
          </View>
          {auth.status === 'phone' ? (
            <View className={styles.logoutBtn} onClick={handleLogout}>
              <Text className={styles.logoutText}>退出</Text>
            </View>
          ) : (
            <View className={styles.loginBtn}>
              <Text className={styles.loginBtnText}>去登录</Text>
            </View>
          )}
        </View>
        <View className={styles.statCard}>
          <Text className={styles.statNum}>{claims.length}</Text>
          <Text className={styles.statLabel}>已领优惠券（张）</Text>
        </View>
      </View>

      {/* 内容区：我的优惠券列表 */}
      <View className={styles.content}>
        <View className={styles.sectionHeader}>
          <View className={styles.sectionTitleBar} />
          <Text className={styles.sectionTitle}>我的优惠券</Text>
          {!loading && !errorMsg && claims.length > 0 && (
            <Text className={styles.sectionCount}>共 {claims.length} 张</Text>
          )}
        </View>

        {/* 加载骨架屏 */}
        {loading && (
          <View className={styles.skeletonList}>
            {[0, 1, 2].map((i) => (
              <View key={i} className={styles.skeletonCard}>
                <View className={styles.skeletonLogo} />
                <View className={styles.skeletonLines}>
                  <View className={styles.skeletonLine} style={{ width: '36%' }} />
                  <View className={styles.skeletonLine} style={{ width: '64%' }} />
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
            <View className={styles.retryBtn} onClick={loadClaims}>
              <Text className={styles.retryText}>重新加载</Text>
            </View>
          </View>
        )}

        {/* 已领券列表 */}
        {!loading && !errorMsg && claims.length > 0 && (
          <View className={styles.claimList}>
            {claims.map((coupon) => (
              <View key={coupon.id} className={styles.claimCard}>
                <View className={styles.claimLeft}>
                  {coupon.brandLogo ? (
                    <BrandIcon brand={coupon.brandLogo} />
                  ) : (
                    <View className={styles.logoFallback} style={{ backgroundColor: coupon.bgColor }}>
                      <Text className={styles.logoEmoji}>{coupon.emoji}</Text>
                    </View>
                  )}
                </View>
                <View className={styles.claimInfo}>
                  <View className={styles.claimTopRow}>
                    <Text className={styles.claimBrand}>{coupon.brand}</Text>
                    {coupon.tag ? <Text className={styles.claimTag}>{coupon.tag}</Text> : null}
                  </View>
                  <Text className={styles.claimTitle}>{coupon.title}</Text>
                  <View className={styles.claimMetaRow}>
                    <PlatformIcon platform={coupon.platformCode} size="sm" />
                    <Text className={styles.claimPlatform}>{coupon.platform}</Text>
                    <Text className={styles.claimTime}>{formatTime(coupon.claimedAt)} 领取</Text>
                  </View>
                </View>
                <View className={styles.useBtn} onClick={() => handleUse(coupon)}>
                  <Text className={styles.useBtnText}>去使用</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 空状态 */}
        {!loading && !errorMsg && claims.length === 0 && (
          <View className={styles.empty}>
            <Text className={styles.emptyIcon}>🎫</Text>
            <Text className={styles.emptyText}>还没有领取过优惠券</Text>
            <Text className={styles.emptyTip}>去首页领几张，下单立减哦</Text>
            <View className={styles.goHomeBtn} onClick={goHome}>
              <Text className={styles.goHomeText}>去首页逛逛</Text>
            </View>
          </View>
        )}

        {!loading && !errorMsg && claims.length > 0 && (
          <View className={styles.listFooter}>
            <Text className={styles.listFooterText}>— 下单时选择对应平台即可抵扣 —</Text>
          </View>
        )}
      </View>
    </View>
  );
};

export default MinePage;
