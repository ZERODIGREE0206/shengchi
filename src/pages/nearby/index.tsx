import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Input, ScrollView } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import classnames from 'classnames';
import BrandIcon from '@/components/BrandIcon';
import PlatformIcon from '@/components/PlatformIcon';
import { locateWithAddress, type LocationResult } from '@/services/location';
import { callNearbyStores } from '@/services/cloudbase';
import { buildNearbyAllStores, mapPoisToStores, SHARED_PLATFORMS, type SharedStore } from '@/data/stores';
import { PLATFORM_LIST, PLATFORM_META } from '@/constants/platforms';
import type { CategoryCode, PlatformCode } from '@/types/coupon';
import styles from './index.module.scss';

/** 金刚区分类 */
const CATEGORY_TABS: Array<{ code: CategoryCode | ''; label: string; emoji: string }> = [
  { code: '', label: '全部', emoji: '🍱' },
  { code: 'burger', label: '汉堡', emoji: '🍔' },
  { code: 'chinese', label: '快餐', emoji: '🍚' },
  { code: 'snack', label: '粉面', emoji: '🍜' },
  { code: 'coffee', label: '咖啡', emoji: '☕' },
  { code: 'tea', label: '茶饮', emoji: '🧋' },
  { code: 'hotpot', label: '火锅', emoji: '🍲' }
];

/**
 * 点外卖页：展示美团/淘宝闪购/京东外卖「三平台共有」+「平台独家」的连锁品牌门店。
 * 门店卡仅告知用户该门店可在哪些平台下单（共有 / 独家），不提供直达下单按钮
 * （第三方平台小程序页面路径不公开，无法深链到具体门店，跳转只会落到平台首页）。
 * 点击门店卡进入菜品详情页选菜比价。
 */
const NearbyPage: React.FC = () => {
  const [locating, setLocating] = useState<LocationResult>({
    status: 'locating', location: null, address: null
  });
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<CategoryCode | ''>('');
  const [platformFilter, setPlatformFilter] = useState<PlatformCode | ''>('');

  // 首次进入 + 每次页面显示时刷新定位（useDidShow 首次 onShow 也会触发，无需再挂 mount effect）
  useDidShow(() => {
    handleLocate(false);
  });

  usePullDownRefresh(async () => {
    await handleLocate(true);
    Taro.stopPullDownRefresh();
  });

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
      // 精度过低提示（粗定位，距离可能不准）
      Taro.showToast({ title: `定位精度约 ${Math.round(res.accuracy)} 米，到室外可更精确`, icon: 'none', duration: 3000 });
    }
  };

  // 共有门店 + 平台独家门店（模拟兜底）；定位成功后优先拉腾讯真实门店
  const [realStores, setRealStores] = useState<SharedStore[] | null>(null);

  // 定位变化 → 拉腾讯周边真实门店；失败回退模拟
  useEffect(() => {
    const loc = locating.location;
    if (!loc) {
      setRealStores(null);
      return;
    }
    let cancelled = false;
    callNearbyStores(loc.latitude, loc.longitude)
      .then((res) => {
        if (cancelled) return;
        if (res.status === 0 && res.data && res.data.length > 0) {
          setRealStores(mapPoisToStores(res.data));
        } else {
          console.warn('[nearby] 真实门店为空，回退模拟:', res.status, res.message);
          setRealStores(null);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[nearby] 真实门店请求失败，回退模拟:', err?.message || err);
        setRealStores(null);
      });
    return () => { cancelled = true; };
  }, [locating.location]);

  const stores = useMemo(
    () => realStores ?? buildNearbyAllStores(locating.location),
    [realStores, locating.location]
  );
  const isRealStores = realStores !== null;

  // 分类 + 关键词 + 平台过滤
  const filteredStores = useMemo(() => {
    const kw = keyword.trim();
    return stores.filter((s) => {
      const matchCategory = !category || s.category === category;
      const matchKeyword = !kw || s.name.includes(kw);
      // 平台筛选：保留该平台的共有门店 + 该平台的独家门店
      const matchPlatform = !platformFilter || s.platforms.includes(platformFilter);
      return matchCategory && matchKeyword && matchPlatform;
    });
  }, [stores, category, keyword, platformFilter]);

  const handleSearchInput = (e: { detail: { value: string } }) => {
    setKeyword(e.detail.value);
  };

  const handleAddressTap = () => {
    if (locating.status === 'located') {
      handleLocate(true);
    } else if (locating.status === 'denied') {
      if (process.env.TARO_ENV === 'weapp') Taro.openSetting();
      else handleLocate(true);
    } else if (locating.status !== 'locating') {
      handleLocate(true);
    }
  };

  // 点击门店卡：进入菜品级详情页（选菜+比价）
  // 真实 POI 门店透传 isPoi/menuBrand/address，详情页据此决定展示品牌标准菜单还是引导去平台看真实菜单
  const handleStoreTap = (store: SharedStore) => {
    const params = [
      `storeId=${store.id}`,
      `storeName=${encodeURIComponent(store.name)}`,
      `category=${store.category}`,
      `platforms=${store.platforms.join(',')}`,
      `isPoi=${store.isPoi ? 1 : 0}`,
      `distanceKm=${store.distanceKm ?? ''}`
    ];
    if (store.menuBrand) params.push(`menuBrand=${encodeURIComponent(store.menuBrand)}`);
    if (store.address) params.push(`address=${encodeURIComponent(store.address)}`);
    Taro.navigateTo({ url: `/pages/store-detail/index?${params.join('&')}` });
  };

  const addressText = (() => {
    switch (locating.status) {
      case 'locating': return '定位中…';
      case 'located': return locating.address || '我的位置';
      case 'denied': return '未授权定位 · 点击设置';
      default: return '定位失败 · 点击重试';
    }
  })();

  // 定位成功时显示经纬度，方便用户核对位置是否正确
  const coordText = locating.status === 'located' && locating.location
    ? `${locating.location.latitude.toFixed(5)}, ${locating.location.longitude.toFixed(5)}`
    : '';

  return (
    <View className={styles.page}>
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
              onClick={(e) => { e.stopPropagation(); handleLocate(true); }}
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
            placeholder='搜索附近门店'
            placeholderStyle='color: #86909c; font-size: 26rpx;'
            value={keyword}
            onInput={handleSearchInput}
            confirmType='search'
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
        {/* 平台筛选条（选中后门店卡只显示该平台的下单按钮） */}
        <ScrollView scrollX className={styles.platformFilter} enhanced showScrollbar={false}>
          <View
            className={classnames(styles.filterChip, !platformFilter && styles.filterChipActive)}
            onClick={() => setPlatformFilter('')}
          >
            <Text className={styles.filterChipText}>全部平台</Text>
          </View>
          {PLATFORM_LIST.filter((p) => SHARED_PLATFORMS.includes(p.code)).map((p) => {
            const active = platformFilter === p.code;
            return (
              <View
                key={p.code}
                className={classnames(styles.filterChip, active && styles.filterChipActive)}
                onClick={() => setPlatformFilter(active ? '' : p.code)}
              >
                <PlatformIcon platform={p.code} size='sm' />
                <Text className={styles.filterChipText}>{p.shortName}</Text>
              </View>
            );
          })}
        </ScrollView>

        <View className={styles.sectionHeader}>
          <Text className={styles.sectionTitle}>附近门店</Text>
          <Text className={styles.sectionTip}>
            {locating.location ? '按距离排序 · 共有+独家门店' : '连锁品牌 + 平台独家 · 定位后按距离排序'}
          </Text>
        </View>

        {filteredStores.length > 0 && (
          <View className={styles.storeList}>
            {filteredStores.map((store) => {
              const isShared = store.platforms.length > 1;
              const platformNames = store.platforms.map((p) => PLATFORM_META[p].shortName);
              return (
                <View key={store.id} className={styles.storeCard} onClick={() => handleStoreTap(store)}>
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
                    <View className={styles.sharedRow}>
                      {store.platforms.map((p) => (
                        <PlatformIcon key={p} platform={p} size='sm' />
                      ))}
                      <Text className={styles.sharedText}>
                        {isShared
                          ? `${platformNames.join(' · ')} 均可下单`
                          : `${platformNames[0]}独家`}
                      </Text>
                    </View>
                    <Text className={styles.storeMeta}>
                      {isRealStores
                        ? `${store.address || ''} · ${store.distanceKm}km`
                        : `${store.rating}分 · 月售${store.monthlySales}`}
                    </Text>
                    {!isRealStores && (
                      <Text className={styles.storeMeta}>
                        起送¥{store.minOrder} · 配送¥{store.deliveryFee} · {store.deliveryTime}分钟 · {store.distanceKm}km
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {filteredStores.length === 0 && (
          <View className={styles.empty}>
            <Text className={styles.emptyIcon}>🍜</Text>
            <Text className={styles.emptyText}>未找到相关门店</Text>
            <Text className={styles.emptyTip}>换个分类或关键词试试吧</Text>
          </View>
        )}

        <View className={styles.listFooter}>
          <Text className={styles.listFooterText}>— 连锁品牌三平台共有门店 · 下单由美团/淘宝闪购/京东官方承接 —</Text>
        </View>
      </View>
    </View>
  );
};

export default NearbyPage;
