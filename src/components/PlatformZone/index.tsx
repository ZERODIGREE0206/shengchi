import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Input, ScrollView } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import classnames from 'classnames';
import BrandIcon from '@/components/BrandIcon';
import { fetchCoupons, claimCouponById } from '@/services/couponService';
import { requireLogin } from '@/services/auth';
import { openPlatformOrder, extractStoreBrand } from '@/services/platformJump';
import { locateWithAddress, type LocationResult } from '@/services/location';
import { buildNearbyStores, type NearbyStore } from '@/data/stores';
import { PLATFORM_META } from '@/constants/platforms';
import type { Coupon, CategoryCode, PlatformCode } from '@/types/coupon';
import type { ZoneTheme } from './theme';
import styles from './index.module.scss';

/** 金刚区分类（复用品类编码，空串为全部） */
const CATEGORY_TABS: Array<{ code: CategoryCode | ''; label: string; emoji: string }> = [
  { code: '', label: '全部', emoji: '🍱' },
  { code: 'burger', label: '汉堡', emoji: '🍔' },
  { code: 'chinese', label: '快餐', emoji: '🍚' },
  { code: 'snack', label: '粉面', emoji: '🍜' },
  { code: 'coffee', label: '咖啡', emoji: '☕' },
  { code: 'tea', label: '茶饮', emoji: '🧋' },
  { code: 'hotpot', label: '火锅', emoji: '🍲' }
];

interface PlatformZoneProps {
  /** 平台编码：meituan / eleme / taobao */
  platformCode: PlatformCode;
  /** 平台主题（见 theme.ts） */
  theme: ZoneTheme;
}

/**
 * 平台外卖专区（美团/饿了么/淘宝闪购三平台同构）：
 * 仿平台点外卖首页（引流页）——定位以「我的位置」为准 → 计算附近门店距离；
 * 券为库中该平台真实券；「去下单」统一跳平台官方小程序/APP 完成真实下单
 */
const PlatformZone: React.FC<PlatformZoneProps> = ({ platformCode, theme }) => {
  const platformMeta = PLATFORM_META[platformCode];
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState<LocationResult>({ status: 'locating', location: null, address: null });
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<CategoryCode | ''>('');

  // 主题 CSS 变量注入根节点（Taro 内联样式不支持 rpx，阴影等已在 theme 中用 px）
  const themeVars = {
    '--zone-grad': theme.headerGradient,
    '--zone-header-text': theme.headerText,
    '--zone-header-text-dim': theme.headerTextDim,
    '--zone-header-arrow': theme.headerArrow,
    '--zone-relocate-bg': theme.relocateBg,
    '--zone-relocate-text': theme.relocateText,
    '--zone-kk-label': theme.kkLabel,
    '--zone-kk-active-bg': theme.kkActiveBg,
    '--zone-kk-active-text': theme.kkActiveText,
    '--zone-chip-bg': theme.chipBg,
    '--zone-chip-border': theme.chipBorder,
    '--zone-order-bg': theme.orderBg,
    '--zone-order-text': theme.orderText,
    '--zone-order-shadow': theme.orderShadow
  } as React.CSSProperties;

  // 首次进入：加载平台券 + 自动定位
  useEffect(() => {
    loadCoupons();
    handleLocate(false);
  }, []);

  // 每次页面显示时刷新定位
  useDidShow(() => {
    handleLocate(false);
  });

  const loadCoupons = async () => {
    setLoading(true);
    try {
      const list = await fetchCoupons({ platformCode });
      setCoupons(list);
    } catch (err) {
      console.error('[PlatformZone] load coupons failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // 定位（首次自动 + 重新定位共用；denied 时引导去设置页开权限）
  const handleLocate = async (forceRefresh: boolean) => {
    setLocating((prev) => ({ ...prev, status: 'locating' }));
    const res = await locateWithAddress(forceRefresh);
    setLocating(res);
    if (res.status === 'denied' && process.env.TARO_ENV === 'weapp') {
      const { confirm } = await Taro.showModal({
        title: '未授权定位',
        content: '开启定位可按您的位置展示附近门店距离',
        confirmText: '去设置'
      });
      if (confirm) Taro.openSetting();
    } else if (res.status === 'failed') {
      Taro.showToast({ title: '无法获取位置，请检查定位权限或到室外重试', icon: 'none', duration: 3000 });
    } else if (res.status === 'located' && res.accuracy != null && res.accuracy > 200) {
      Taro.showToast({ title: `定位精度约 ${Math.round(res.accuracy)} 米，到室外可更精确`, icon: 'none', duration: 3000 });
    }
  };

  // 附近门店：按平台随机生成（三平台互不重复），以定位点为基准生成距离并就近排序
  const stores = useMemo(
    () => buildNearbyStores(locating.location, platformCode),
    [locating.location, platformCode]
  );

  // 金刚区分类 + 关键词过滤门店
  const filteredStores = useMemo(() => {
    const kw = keyword.trim();
    return stores.filter((s) => {
      const matchCategory = !category || s.category === category;
      const matchKeyword = !kw || s.name.includes(kw);
      return matchCategory && matchKeyword;
    });
  }, [stores, category, keyword]);

  // 门店优惠标签：品牌专属券优先 → 同品类券 → 全平台无门槛红包兜底
  const storeCoupon = (store: NearbyStore): Coupon | undefined => {
    const brandCoupon = coupons.find((c) => c.brand && store.name.includes(c.brand));
    if (brandCoupon) return brandCoupon;
    const catCoupon = coupons.find((c) => c.category === store.category);
    if (catCoupon) return catCoupon;
    return coupons.find((c) => c.category === 'all');
  };

  const addressText = (() => {
    switch (locating.status) {
      case 'locating':
        return '定位中…';
      case 'located':
        return locating.address || '我的位置';
      case 'denied':
        return '未授权定位 · 点击设置';
      default:
        return '定位失败 · 点击重试';
    }
  })();

  // 定位成功时显示经纬度，方便用户核对位置是否正确
  const coordText = locating.status === 'located' && locating.location
    ? `${locating.location.latitude.toFixed(5)}, ${locating.location.longitude.toFixed(5)}`
    : '';

  const handleAddressTap = () => {
    if (locating.status === 'located') {
      handleLocate(true); // 已定位 → 刷新位置
    } else if (locating.status === 'denied') {
      if (process.env.TARO_ENV === 'weapp') Taro.openSetting();
      else handleLocate(true);
    } else if (locating.status !== 'locating') {
      handleLocate(true);
    }
  };

  const handleSearchInput = (e: { detail: { value: string } }) => {
    setKeyword(e.detail.value);
  };

  // 领取平台券（登录后才能领；已领状态本地标记）
  const handleClaim = async (coupon: Coupon) => {
    if (coupon.claimed) return;
    if (!(await requireLogin('领取优惠券'))) return;
    try {
      const res = await claimCouponById(coupon.id);
      Taro.showToast({ title: res.alreadyClaimed ? '已领取过该券' : '领取成功', icon: 'none' });
      setCoupons((prev) =>
        prev.map((c) => (c.id === coupon.id ? { ...c, claimed: true } : c))
      );
    } catch (err) {
      console.error('[PlatformZone] claim failed:', err);
      Taro.showToast({ title: '领取失败，请重试', icon: 'none' });
    }
  };

  // 门店「去下单」→ 登录校验后直达该品牌在平台官方小程序的附近门店页（品牌搜索结果）
  const handleOrder = async (store: NearbyStore) => {
    if (!(await requireLogin('下单'))) return;
    openPlatformOrder(platformCode, extractStoreBrand(store.name));
  };

  return (
    <View className={styles.page} style={themeVars}>
      {/* 平台色渐变 Header：定位栏 + 搜索框 + 金刚区 */}
      <View className={styles.header}>
        <View className={styles.locationBar} onClick={handleAddressTap}>
          <Text className={styles.locationIcon}>📍</Text>
          <View className={styles.locationTextWrap}>
            <Text className={classnames(styles.locationText, locating.status !== 'located' && styles.locationTextDim)}>
              {addressText}
            </Text>
            {coordText ? (
              <Text className={styles.locationCoord}>{coordText}</Text>
            ) : null}
          </View>
          <Text className={styles.locationArrow}>▾</Text>
          {locating.status === 'located' && (
            <View
              className={styles.relocateBtn}
              onClick={(e) => {
                e.stopPropagation();
                handleLocate(true);
              }}
            >
              <Text className={styles.relocateText}>重新定位</Text>
            </View>
          )}
        </View>

        <View className={styles.searchBar}>
          <Text className={styles.searchIcon}>🔍</Text>
          <Input
            className={styles.searchInput}
            type="text"
            placeholder={`搜索${platformMeta.shortName}附近门店`}
            placeholderStyle={`color: ${theme.placeholderColor}; font-size: 26rpx;`}
            value={keyword}
            onInput={handleSearchInput}
            confirmType="search"
          />
        </View>

        {/* 金刚区分类 */}
        <ScrollView scrollX className={styles.kingkong} enhanced showScrollbar={false}>
          {CATEGORY_TABS.map((tab) => {
            const active = category === tab.code;
            return (
              <View
                key={tab.label}
                className={classnames(styles.kkItem, active && styles.kkItemActive)}
                onClick={() => setCategory(tab.code)}
              >
                <Text className={styles.kkEmoji}>{tab.emoji}</Text>
                <Text className={styles.kkLabel}>{tab.label}</Text>
              </View>
            );
          })}
        </ScrollView>
      </View>

      <View className={styles.content}>
        {/* 「更多外卖优惠」平台券横幅 */}
        {!loading && coupons.length > 0 && (
          <View className={styles.couponSection}>
            <View className={styles.sectionHeader}>
              <Text className={styles.sectionTitle}>更多外卖优惠</Text>
              <Text className={styles.sectionTip}>{platformMeta.name}官方券 · 免费领</Text>
            </View>
            <ScrollView scrollX className={styles.couponScroll} enhanced showScrollbar={false}>
              {coupons.map((c) => (
                <View key={c.id} className={styles.couponChip}>
                  <View className={styles.couponInfo}>
                    <View className={styles.couponTitleRow}>
                      <Text className={styles.couponTitle}>{c.title}</Text>
                      {c.tag ? (
                        <Text
                          className={classnames(
                            styles.couponChipTag,
                            c.tag === '无门槛' && styles.couponChipTagHot
                          )}
                        >
                          {c.tag}
                        </Text>
                      ) : null}
                    </View>
                    <Text className={styles.couponBrand} numberOfLines={1}>
                      {c.brand} · {c.desc}
                    </Text>
                  </View>
                  <View
                    className={classnames(styles.claimBtn, c.claimed && styles.claimBtnDisabled)}
                    onClick={() => handleClaim(c)}
                  >
                    <Text className={styles.claimBtnText}>{c.claimed ? '已领取' : '领取'}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 附近门店列表 */}
        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>附近门店</Text>
          <Text className={styles.sectionTip}>
            {locating.location ? '按距离排序' : '定位后按距离排序'}
          </Text>
        </View>

        {/* 骨架屏 */}
        {loading && (
          <View className={styles.skeletonList}>
            {[0, 1, 2].map((i) => (
              <View key={i} className={styles.skeletonCard}>
                <View className={styles.skeletonLogo} />
                <View className={styles.skeletonLines}>
                  <View className={styles.skeletonLine} style={{ width: '52%' }} />
                  <View className={styles.skeletonLine} style={{ width: '76%' }} />
                  <View className={styles.skeletonLine} style={{ width: '44%' }} />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 门店卡片 */}
        {!loading && filteredStores.length > 0 && (
          <View className={styles.storeList}>
            {filteredStores.map((store) => {
              const coupon = storeCoupon(store);
              return (
                <View key={store.id} className={styles.storeCard}>
                  {store.brandLogo ? (
                    <BrandIcon brand={store.brandLogo} />
                  ) : (
                    <View
                      className={styles.storeLogoFallback}
                      style={{ backgroundColor: store.bgColor }}
                    >
                      <Text className={styles.storeLogoEmoji}>{store.emoji}</Text>
                    </View>
                  )}
                  <View className={styles.storeInfo}>
                    <Text className={styles.storeName}>{store.name}</Text>
                    <Text className={styles.storeMeta}>
                      {store.rating}分 · 月售{store.monthlySales}
                    </Text>
                    <Text className={styles.storeMeta}>
                      起送¥{store.minOrder} · 配送¥{store.deliveryFee} · {store.deliveryTime}分钟 · {store.distanceKm}km
                    </Text>
                    {coupon && (
                      <View className={styles.couponTag}>
                        <Text className={styles.couponTagText}>{coupon.title}</Text>
                      </View>
                    )}
                  </View>
                  <View className={styles.orderBtn} onClick={() => handleOrder(store)}>
                    <Text className={styles.orderBtnText}>去下单</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* 空状态 */}
        {!loading && filteredStores.length === 0 && (
          <View className={styles.empty}>
            <Text className={styles.emptyIcon}>🍜</Text>
            <Text className={styles.emptyText}>未找到相关门店</Text>
            <Text className={styles.emptyTip}>换个分类或关键词试试吧</Text>
          </View>
        )}

        <View className={styles.listFooter}>
          <Text className={styles.listFooterText}>— 门店为品牌演示数据 · 下单由{platformMeta.name}官方承接 —</Text>
        </View>
      </View>
    </View>
  );
};

export default PlatformZone;
