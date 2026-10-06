/**
 * 门店详情页：菜品级菜单 + 三平台比价 + 领券下单闭环
 *
 * 核心价值：用户选好菜 → 一眼看到哪个平台最便宜（含券后价）→
 * 点对应平台按钮自动领券 → 跳平台下单。无需离开本页去领券中心。
 */
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Image } from '@tarojs/components';
import Taro, { useRouter } from '@tarojs/taro';
import classnames from 'classnames';
import PlatformIcon from '@/components/PlatformIcon';
import { buildStoreMenu, hasBrandMenu, type Dish } from '@/data/menu';
import { fetchCoupons, fetchMyClaims, claimCouponById } from '@/services/couponService';
import { requireLogin } from '@/services/auth';
import { openPlatformOrder, extractStoreBrand } from '@/services/platformJump';
import { hashString } from '@/data/stores';
import { ZONE_THEME } from '@/components/PlatformZone/theme';
import type { Coupon, CategoryCode, PlatformCode } from '@/types/coupon';
import styles from './index.module.scss';

const PLATFORM_NAME: Record<PlatformCode, string> = {
  meituan: '美团',
  eleme: '饿了么',
  taobao: '闪购',
  jd: '京东'
};

/** 品类中文标签（真实门店信息卡用） */
const CATEGORY_LABEL: Record<CategoryCode, string> = {
  burger: '汉堡披萨',
  coffee: '咖啡',
  tea: '茶饮',
  hotpot: '火锅',
  chinese: '中式快餐',
  snack: '粉面小吃',
  all: '美食'
};

/** 平台配送费（与比价服务一致） */
const DELIVERY_FEE: Record<PlatformCode, number> = { meituan: 3, eleme: 3, taobao: 2.5, jd: 2 };

/** 从券标题/描述解析面额 */
function couponValue(c: Coupon): number {
  const text = `${c.title} ${c.desc || ''}`;
  const full = text.match(/满\s*\d+\s*减\s*(\d+(?:\.\d+)?)/);
  if (full) return parseFloat(full[1]);
  const m = text.match(/(\d+(?:\.\d+)?)\s*元/);
  if (m) return parseFloat(m[1]);
  return 0;
}

/** 菜品级比价：基准价 × 平台系数 ±5% − 最优券抵扣 + 配送费 */
function dishPlatformPrice(
  dish: Dish,
  platform: PlatformCode,
  claimed: Coupon[]
): { finalPrice: number; fromCoupon: boolean } {
  const factor = 0.95 + ((hashString(`${dish.name}-${platform}`) % 11) / 100);
  const mine = claimed.filter((c) => c.platformCode === platform);
  let discount = 2;
  let fromCoupon = false;
  if (mine.length > 0) {
    const maxFace = Math.max(...mine.map(couponValue), 0);
    discount = Math.max(3, Math.round(maxFace * 0.2));
    fromCoupon = maxFace > 0;
  }
  const finalPrice = Math.max(0.9, dish.basePrice * factor - discount + DELIVERY_FEE[platform]);
  return { finalPrice: Math.round(finalPrice * 10) / 10, fromCoupon };
}

/** 取某平台面额最大的可用券（用于一键领券/自动领券） */
function bestCouponForPlatform(coupons: Coupon[], platform: PlatformCode): Coupon | undefined {
  const list = coupons.filter((c) => c.platformCode === platform);
  if (list.length === 0) return undefined;
  return list.reduce((best, cur) => (couponValue(cur) > couponValue(best) ? cur : best), list[0]);
}

export default function StoreDetailPage() {
  const router = useRouter();
  const {
    storeId = '',
    storeName = '',
    category = 'chinese',
    platforms = '',
    isPoi = '0',
    menuBrand = '',
    address = '',
    distanceKm = ''
  } = router.params;

  const [claimedCoupons, setClaimedCoupons] = useState<Coupon[]>([]);
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
  const [claiming, setClaiming] = useState<PlatformCode | null>(null);

  const storePlatforms = useMemo<PlatformCode[]>(
    () => (platforms ? (platforms.split(',') as PlatformCode[]) : ['meituan', 'taobao', 'jd']),
    [platforms]
  );

  const decodedName = decodeURIComponent(storeName);
  const decodedMenuBrand = menuBrand ? decodeURIComponent(menuBrand) : '';
  const decodedAddress = address ? decodeURIComponent(address) : '';
  const isRealPoi = isPoi === '1';

  /**
   * 真实 POI 门店：
   * - 识别出的连锁品牌且存在品牌标准菜单 → 用标准菜单（连锁全国统一，基本可信）
   * - 非连锁小店 → 没有任何菜单数据源，返回空列表，UI 引导去平台看真实菜单，
   *   绝不再把品类通用菜伪装成「本店菜品」
   * 模拟兜底门店：沿用品牌专属菜单 / 品类池
   */
  const menu = useMemo(() => {
    if (isRealPoi) {
      return hasBrandMenu(decodedMenuBrand)
        ? buildStoreMenu(storeId, decodedName, category as CategoryCode, decodedMenuBrand)
        : [];
    }
    return buildStoreMenu(storeId, decodedName, category as CategoryCode);
  }, [storeId, decodedName, category, isRealPoi, decodedMenuBrand]);

  /** 平台内搜索词：去掉「(xx 店)」分店后缀，用字号/品牌部分搜索命中率更高 */
  const poiSearchKeyword = useMemo(() => {
    const base = decodedName.split(/[（(【\[]/)[0].trim();
    return base || decodedName;
  }, [decodedName]);

  // 加载已领券 + 可用券
  const loadData = () => {
    Promise.all([fetchMyClaims(), fetchCoupons()])
      .then(([claimed, available]) => {
        setClaimedCoupons(claimed as unknown as Coupon[]);
        setAvailableCoupons(available);
      })
      .catch(() => {
        setClaimedCoupons([]);
        setAvailableCoupons([]);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  // 某平台是否已领券
  const hasCoupon = (platform: PlatformCode) =>
    claimedCoupons.some((c) => c.platformCode === platform);

  // 领取某平台最优券 → 刷新已领券列表
  const claimPlatformCoupon = async (platform: PlatformCode): Promise<boolean> => {
    const coupon = bestCouponForPlatform(availableCoupons, platform);
    if (!coupon) return false;
    try {
      setClaiming(platform);
      await claimCouponById(coupon.id);
      // 刷新已领券（比价会自动用新券）
      const claimed = await fetchMyClaims();
      setClaimedCoupons(claimed as unknown as Coupon[]);
      return true;
    } catch {
      return false;
    } finally {
      setClaiming(null);
    }
  };

  // 一键领本店所有可用平台的券（登录后才能领）
  const handleClaimAll = async () => {
    if (!(await requireLogin('领取优惠券'))) return;
    const platformsNeeding = storePlatforms.filter((p) => !hasCoupon(p));
    if (platformsNeeding.length === 0) {
      Taro.showToast({ title: '各平台券已领齐', icon: 'success' });
      return;
    }
    Taro.showLoading({ title: '领券中…' });
    let ok = 0;
    for (const p of platformsNeeding) {
      if (await claimPlatformCoupon(p)) ok++;
    }
    Taro.hideLoading();
    Taro.showToast({
      title: ok > 0 ? `已领 ${ok} 个平台券` : '暂无可领券',
      icon: ok > 0 ? 'success' : 'none'
    });
  };

  // 点平台下单：先登录 → 未领券则自动领券 → 跳平台（定位→登录→领券→下单 严格链路）
  // keyword：真实门店用字号搜索词，模拟门店沿用品牌提取
  const handleOrder = async (platform: PlatformCode, keyword?: string) => {
    if (!(await requireLogin('下单'))) return;
    if (!hasCoupon(platform)) {
      const ok = await claimPlatformCoupon(platform);
      if (ok) {
        Taro.showToast({ title: `已领${PLATFORM_NAME[platform]}券，正在下单`, icon: 'none' });
      }
    }
    openPlatformOrder(platform, (keyword ?? extractStoreBrand(decodedName)).trim());
    Taro.showToast({ title: `正在打开${PLATFORM_NAME[platform]}…`, icon: 'none' });
  };

  // 计算本店各平台「平均券后价」用于汇总推荐
  const platformAvgPrice = useMemo(() => {
    const map: Record<string, number> = {};
    storePlatforms.forEach((p) => {
      const prices = menu.map((d) => dishPlatformPrice(d, p, claimedCoupons).finalPrice);
      map[p] = prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    });
    return map;
  }, [menu, storePlatforms, claimedCoupons]);

  // 本店最划算平台
  const bestPlatform = useMemo(() => {
    if (storePlatforms.length === 0) return null;
    return storePlatforms.reduce((best, p) =>
      platformAvgPrice[p] < platformAvgPrice[best] ? p : best
    , storePlatforms[0]);
  }, [platformAvgPrice, storePlatforms]);

  // 本店平均每单省钱（最贵平台均价 − 最便宜平台均价）
  const avgSaving = useMemo(() => {
    const prices = Object.values(platformAvgPrice);
    if (prices.length < 2) return 0;
    return Math.round((Math.max(...prices) - Math.min(...prices)) * 10) / 10;
  }, [platformAvgPrice]);

  const claimedCount = storePlatforms.filter(hasCoupon).length;

  return (
    <View className={styles.page}>
      {/* 门店信息头 */}
      <View className={styles.storeHeader}>
        {menu[0]?.imageUrl ? (
          <Image className={styles.storeCover} src={menu[0].imageUrl} mode='aspectFill' />
        ) : (
          <Text className={styles.storeEmoji}>🍽️</Text>
        )}
        <View className={styles.storeInfo}>
          <Text className={styles.storeName}>{decodedName}</Text>
          <View className={styles.platformRow}>
            {storePlatforms.map((p) => (
              <PlatformIcon key={p} platform={p} size='sm' />
            ))}
            <Text className={styles.platformTip}>
              {storePlatforms.length > 1 ? '三平台均可下单' : '平台独家'}
            </Text>
          </View>
        </View>
      </View>

      {/* 比价汇总横幅：一眼告诉用户哪个平台最划算（无菜单的真实门店不做无依据的推荐） */}
      {bestPlatform && storePlatforms.length > 1 && menu.length > 0 && (
        <View className={styles.summaryBar}>
          <View className={styles.summaryLeft}>
            <PlatformIcon platform={bestPlatform} size='sm' />
            <Text className={styles.summaryText}>
              本店<Text className={styles.summaryHighlight}>{PLATFORM_NAME[bestPlatform]}</Text>最划算
            </Text>
            {avgSaving > 0 && (
              <Text className={styles.summarySaving}>平均每单省¥{avgSaving}</Text>
            )}
          </View>
          <View
            className={classnames(styles.claimAllBtn, claimedCount === storePlatforms.length && styles.claimAllDone)}
            onClick={handleClaimAll}
          >
            <Text className={styles.claimAllText}>
              {claimedCount === storePlatforms.length ? '券已领齐' : `一键领券 (${claimedCount}/${storePlatforms.length})`}
            </Text>
          </View>
        </View>
      )}

      {/* 有可信菜单（连锁标准菜单 / 模拟门店）→ 菜品级比价；
          非连锁真实 POI → 下方引导面板，去平台看真实菜单 */}
      {menu.length > 0 ? (
      <View className={styles.menuList}>
        <Text className={styles.sectionTitle}>
          {isRealPoi
            ? '🍽️ 品牌连锁标准菜单 · 以平台实际在售为准'
            : '🍽️ 全部菜品 · 点平台自动领券下单'}
        </Text>
        {menu.map((dish) => {
          const prices = storePlatforms.map((p) => ({
            platform: p,
            ...dishPlatformPrice(dish, p, claimedCoupons)
          }));
          const cheapest = prices.reduce(
            (min, cur) => (cur.finalPrice < min.finalPrice ? cur : min),
            prices[0]
          );
          const priciest = prices.reduce(
            (max, cur) => (cur.finalPrice > max.finalPrice ? cur : max),
            prices[0]
          );
          const saving = Math.round((priciest.finalPrice - cheapest.finalPrice) * 10) / 10;

          return (
            <View key={dish.id} className={styles.dishCard}>
              <View className={styles.dishLeft}>
                <Image className={styles.dishImage} src={dish.imageUrl} mode='aspectFill' />
              </View>
              <View className={styles.dishInfo}>
                <View className={styles.dishTitleRow}>
                  <Text className={styles.dishName}>{dish.name}</Text>
                  {dish.isSignature && <Text className={styles.signatureTag}>招牌</Text>}
                </View>
                <Text className={styles.dishDesc}>{dish.desc}</Text>
                <Text className={styles.dishMeta}>月售{dish.monthlySales} · 原价 ¥{dish.basePrice}</Text>
              </View>
              <View className={styles.dishPrices}>
                {prices.map((item) => {
                  const isCheapest = storePlatforms.length > 1 && item.platform === cheapest.platform;
                  const claimed = hasCoupon(item.platform);
                  const isClaiming = claiming === item.platform;
                  return (
                    <View
                      key={item.platform}
                      className={classnames(
                        styles.priceBtn,
                        isCheapest && styles.priceBtnCheapest
                      )}
                      style={({
                        '--btn-bg': ZONE_THEME[item.platform].orderBg,
                        '--btn-text': ZONE_THEME[item.platform].orderText
                      } as Record<string, string>)}
                      onClick={() => handleOrder(item.platform)}
                    >
                      {isCheapest && (
                        <Text className={styles.cheapestTag}>
                          {saving > 0 ? `省¥${saving}` : '最便宜'}
                        </Text>
                      )}
                      <Text className={styles.pricePlatform}>{PLATFORM_NAME[item.platform]}</Text>
                      <Text className={styles.priceValue}>
                        {isClaiming ? '领券中…' : `¥${item.finalPrice}`}
                      </Text>
                      {!claimed && !isClaiming && (
                        <Text className={styles.needCouponTag}>未领券</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
      ) : (
        <View className={styles.realPanel}>
          {/* 真实门店信息（仅展示可核实的字段） */}
          <View className={styles.realCard}>
            <View className={styles.realAddressRow}>
              <Text className={styles.realPin}>📍</Text>
              <Text className={styles.realAddressText}>{decodedAddress || '地址未收录'}</Text>
            </View>
            <Text className={styles.realMeta}>
              {CATEGORY_LABEL[category as CategoryCode] || '美食'}
              {distanceKm ? ` · 距你 ${distanceKm}km` : ''}
            </Text>
          </View>

          {/* 诚实声明：不提供可能误导的模拟菜品 */}
          <View className={styles.noticeCard}>
            <Text className={styles.noticeText}>
              平台未向第三方开放门店菜单，本页不展示可能误导的模拟菜品
            </Text>
            <Text className={styles.noticeSub}>
              点下方按钮，领券后跳转平台查看本店真实菜单并下单
            </Text>
          </View>

          {/* 各平台入口：自动领券 → 平台内搜索本店 */}
          {storePlatforms.map((p) => (
            <View key={p} className={styles.orderRow}>
              <PlatformIcon platform={p} size='sm' />
              <View className={styles.orderRowInfo}>
                <Text className={styles.orderRowName}>{PLATFORM_NAME[p]}</Text>
                <Text className={styles.orderRowStatus}>
                  {hasCoupon(p) ? '券已领取 · 可直接下单' : '未领券 · 点击自动领取'}
                </Text>
              </View>
              <View
                className={styles.orderRowBtn}
                style={({
                  '--btn-bg': ZONE_THEME[p].orderBg,
                  '--btn-text': ZONE_THEME[p].orderText
                } as Record<string, string>)}
                onClick={() => handleOrder(p, poiSearchKeyword)}
              >
                <Text className={styles.orderRowBtnText}>去下单</Text>
              </View>
            </View>
          ))}

          {/* 一键领券 */}
          <View className={styles.claimAllRow}>
            <View
              className={classnames(
                styles.claimAllRowBtn,
                claimedCount === storePlatforms.length && styles.claimAllDone
              )}
              onClick={handleClaimAll}
            >
              <Text className={styles.claimAllRowText}>
                {claimedCount === storePlatforms.length
                  ? '各平台券已领齐'
                  : `一键领取全部平台券 (${claimedCount}/${storePlatforms.length})`}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* 底部提示 */}
      <View className={styles.footer}>
        <Text className={styles.footerText}>
          {menu.length > 0
            ? '💡 价格为预估券后价（含配送费），点平台按钮自动领券后跳转下单'
            : '💡 真实菜单与价格请以美团/淘宝闪购/京东 App 内门店页为准'}
        </Text>
      </View>
    </View>
  );
}
