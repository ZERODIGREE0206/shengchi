/**
 * 平台外卖专区 · 模拟附近门店数据（按平台随机生成，四平台互不重复）
 *
 * 背景：无各平台商家 API，门店为品牌连锁演示数据；下单行为跳转对应平台官方小程序/APP完成。
 * 生成规则：
 * 1. 品牌池按品类分组，组内固定种子打散后「轮发」到四平台 → 品牌互不重复，
 *    品牌数 ≥4 的品类每平台至少 1 家（金刚区筛选基本不空缺）
 * 2. 各平台用自身种子（平台名哈希）驱动随机数，生成商圈店名、评分/月售/配送费等字段
 *    → 同一平台多次进入结果稳定（便于演示与验证），四平台数据彼此不同
 * 3. 「以我的位置为准」：每家门店随机分配方位角/偏移，定位成功后按坐标差值
 *    计算距离并就近排序；未定位时使用兜底距离按默认顺序展示
 */
import type { BrandLogoKey, CategoryCode, PlatformCode } from '@/types/coupon';
import type { LocationInfo } from '@/services/location';

export interface Store {
  id: string;
  /** 店名（品牌 + 商圈） */
  name: string;
  /** 品牌官方 Logo 标识（无 Logo 的品牌留空，页面回退 emoji 色块） */
  brandLogo?: BrandLogoKey;
  emoji: string;
  bgColor: string;
  category: CategoryCode;
  /** 评分 4.5 ~ 5 */
  rating: number;
  /** 月售 */
  monthlySales: number;
  /** 配送费（元，0 表示免配送费） */
  deliveryFee: number;
  /** 配送时长（分钟） */
  deliveryTime: number;
  /** 起送价（元，0 表示无起送限制） */
  minOrder: number;
  /** 以用户定位为中心的方位角（度，0=正北顺时针），用于生成门店坐标 */
  bearing: number;
  /** 距定位点的偏移（km），未定位时作为兜底距离 */
  offsetKm: number;
}

export interface NearbyStore extends Store {
  /** 展示距离（km） */
  distanceKm: number;
}

/** 品牌池（品类分组；品牌数 ≥4 的品类可保证四平台各分到至少 1 家） */
export interface BrandDef {
  name: string;
  brandLogo?: BrandLogoKey;
  emoji: string;
  bgColor: string;
  category: CategoryCode;
}

export const BRAND_POOL: BrandDef[] = [
  // —— 汉堡披萨 ——
  { name: '肯德基宅急送', brandLogo: 'kfc', emoji: '🍗', bgColor: '#fde8e8', category: 'burger' },
  { name: '麦当劳', brandLogo: 'mcdonalds', emoji: '🍔', bgColor: '#fff3e0', category: 'burger' },
  { name: '必胜客宅急送', brandLogo: 'pizzahut', emoji: '🍕', bgColor: '#fdeef0', category: 'burger' },
  { name: '华莱士', brandLogo: 'wallace', emoji: '🍟', bgColor: '#fff7e0', category: 'burger' },
  { name: '德克士', brandLogo: 'dicos', emoji: '🍛', bgColor: '#fdece4', category: 'burger' },
  { name: '汉堡王', brandLogo: 'burgerking', emoji: '👑', bgColor: '#f3ecfd', category: 'burger' },
  { name: '塔斯汀中国汉堡', emoji: '🍔', bgColor: '#fde4e4', category: 'burger' },
  // —— 咖啡 ——
  { name: '瑞幸咖啡', brandLogo: 'luckincoffee', emoji: '☕', bgColor: '#e8f1fd', category: 'coffee' },
  { name: '星巴克', brandLogo: 'starbucks', emoji: '🌟', bgColor: '#e8f0fd', category: 'coffee' },
  { name: '库迪咖啡', emoji: '☕', bgColor: '#e8f0fd', category: 'coffee' },
  // —— 茶饮 ——
  { name: '蜜雪冰城', brandLogo: 'mixue', emoji: '🍦', bgColor: '#fde8f0', category: 'tea' },
  { name: '古茗', brandLogo: 'guming', emoji: '🧋', bgColor: '#e9f7ec', category: 'tea' },
  { name: '茶百道', brandLogo: 'chabaidao', emoji: '🥤', bgColor: '#e6f4fb', category: 'tea' },
  { name: '喜茶', brandLogo: 'heytea', emoji: '🍵', bgColor: '#eafaf0', category: 'tea' },
  { name: '沪上阿姨', emoji: '🧋', bgColor: '#f6e8fb', category: 'tea' },
  { name: '书亦烧仙草', emoji: '🌿', bgColor: '#e9f5ec', category: 'tea' },
  { name: 'CoCo都可', emoji: '🥤', bgColor: '#e6f0fb', category: 'tea' },
  { name: '奈雪的茶', emoji: '🍰', bgColor: '#fdeaf0', category: 'tea' },
  // —— 火锅 ——
  { name: '海底捞火锅', brandLogo: 'haidilao', emoji: '🍲', bgColor: '#fdeeee', category: 'hotpot' },
  { name: '呷哺呷哺', emoji: '🍢', bgColor: '#fdf0e6', category: 'hotpot' },
  { name: '小龙坎火锅', emoji: '🌶️', bgColor: '#fde8e8', category: 'hotpot' },
  { name: '巴奴毛肚火锅', emoji: '🥘', bgColor: '#fdeee6', category: 'hotpot' },
  // —— 中式快餐 ——
  { name: '老乡鸡', emoji: '🐔', bgColor: '#fdf0e6', category: 'chinese' },
  { name: '米村拌饭', emoji: '🍚', bgColor: '#f3f7e8', category: 'chinese' },
  { name: '黄焖鸡米饭', emoji: '🍛', bgColor: '#fdeee0', category: 'chinese' },
  { name: '真功夫', emoji: '🥟', bgColor: '#fde8e8', category: 'chinese' },
  { name: '永和大王', emoji: '🥣', bgColor: '#fff6e0', category: 'chinese' },
  { name: '吉野家', emoji: '🍱', bgColor: '#fde9e4', category: 'chinese' },
  // —— 粉面小吃 ——
  { name: '杨国福麻辣烫', emoji: '🍢', bgColor: '#fdeee6', category: 'snack' },
  { name: '张亮麻辣烫', emoji: '🍲', bgColor: '#fdf3e3', category: 'snack' },
  { name: '沙县小吃', emoji: '🥟', bgColor: '#f5f0e6', category: 'snack' },
  { name: '兰州拉面', emoji: '🍜', bgColor: '#fdeee8', category: 'snack' },
  { name: '螺狮粉', emoji: '🌶️', bgColor: '#fde8e8', category: 'snack' }
];

/** 商圈池（长度 ≥ 任一平台门店数，保证平台内商圈不重复） */
export const MALL_POOL = [
  '万达广场店', '中心广场店', '写字楼店', '万象城店', '大学城店', '步行街店',
  '老城根店', '汇金天地店', '高铁站店', '环球港店', '滨江店', '印象城店',
  '中央公园店', '华茂店', '科技园店', '社区店', '商场店', '旗舰体验店',
  '夜市店', '街角店', '王府井店', '小吃街店', '创意园店', '奥体店', '机场店'
];

const PLATFORMS: PlatformCode[] = ['meituan', 'eleme', 'taobao', 'jd'];

/** 品牌分配用固定种子（结果稳定，可复现） */
const GLOBAL_SEED = 20260910;

// ===== 随机工具 =====

/** mulberry32 伪随机数生成器（种子 → [0,1) 稳定序列） */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 字符串 → 32 位种子 */
export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Fisher-Yates 打散（不改变原数组） */
export function seededShuffle<T>(list: T[], rand: () => number): T[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 从候选数组随机取一个 */
export function pick<T>(list: T[], rand: () => number): T {
  return list[Math.floor(rand() * list.length)];
}

// ===== 平台门店生成 =====

/**
 * 每平台专属门店列表（模块加载时生成一次并缓存）：
 * 品牌轮发保证四平台互不重复 + 品类保底；平台种子生成经营字段
 */
const PLATFORM_STORES: Record<PlatformCode, Store[]> = (() => {
  // 1. 品类分组 → 组内打散 → 轮发四平台（起始平台按品类序号轮转，数量更均衡）
  const assigned: Record<PlatformCode, BrandDef[]> = {
    meituan: [], eleme: [], taobao: [], jd: []
  };
  const categories = [...new Set(BRAND_POOL.map((b) => b.category))];
  categories.forEach((cat, catIdx) => {
    const brands = seededShuffle(
      BRAND_POOL.filter((b) => b.category === cat),
      mulberry32(GLOBAL_SEED + catIdx * 97)
    );
    brands.forEach((brand, i) => {
      assigned[PLATFORMS[(i + catIdx) % PLATFORMS.length]].push(brand);
    });
  });

  // 2. 各平台用自身种子生成商圈店名与经营字段
  const result = {} as Record<PlatformCode, Store[]>;
  PLATFORMS.forEach((platform) => {
    const rand = mulberry32(hashString(`waimai-${platform}`));
    const brands = seededShuffle(assigned[platform], rand);
    const malls = seededShuffle(MALL_POOL, rand);
    result[platform] = brands.map((brand, i) => ({
      id: `${platform}-${i + 1}`,
      name: `${brand.name} · ${malls[i]}`,
      brandLogo: brand.brandLogo,
      emoji: brand.emoji,
      bgColor: brand.bgColor,
      category: brand.category,
      rating: 4.5 + Math.round(rand() * 4) / 10, // 4.5 ~ 4.9
      monthlySales: (8 + Math.floor(rand() * 80)) * 100, // 800 ~ 8700
      deliveryFee: pick([0, 1, 2, 3, 4], rand),
      deliveryTime: 20 + Math.floor(rand() * 26), // 20 ~ 45 分钟
      minOrder: pick([0, 10, 15, 20, 25, 30], rand),
      bearing: Math.round(i * (360 / brands.length) + rand() * 24) % 360, // 全向均匀分布
      offsetKm: Math.round((0.4 + rand() * 3.4) * 10) / 10 // 0.4 ~ 3.8km
    }));
  });
  return result;
})();

/**
 * 生成「附近门店」列表
 * - 定位成功：每家门店坐标 = 定位点 + 方位角/偏移换算的坐标差，
 *   距离 = 偏移距离，按距离升序（体现「以我的位置为准」）
 * - 未定位：使用兜底距离，按默认顺序
 */
export function buildNearbyStores(
  location: LocationInfo | null,
  platformCode: PlatformCode
): NearbyStore[] {
  const stores = (PLATFORM_STORES[platformCode] ?? []).map((s) => ({
    ...s,
    distanceKm: s.offsetKm
  }));
  if (!location) return stores;

  // 方位角/偏移 → 经纬度差（1° 纬度 ≈ 111km；经度按 cos(纬度) 修正）
  const rad = (d: number) => (d * Math.PI) / 180;
  const kmPerDegLat = 111;
  const kmPerDegLng = 111 * Math.cos(rad(location.latitude));

  return stores
    .map((s) => {
      const dx = s.offsetKm * Math.sin(rad(s.bearing));
      const dy = s.offsetKm * Math.cos(rad(s.bearing));
      // 挂坐标供后续扩展（当前仅用于体现距离与定位相关）
      return {
        ...s,
        latitude: location.latitude + dy / kmPerDegLat,
        longitude: location.longitude + dx / kmPerDegLng,
        distanceKm: s.offsetKm
      };
    })
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

// ===== 三平台共有门店（点外卖页用） =====

/**
 * 点外卖「共有门店」覆盖的平台（饿了么已下线）
 * 同一批连锁品牌在美团/淘宝闪购/京东外卖三平台均可下单
 */
export const SHARED_PLATFORMS: PlatformCode[] = ['meituan', 'taobao', 'jd'];

/** 共有门店：一个品牌一张卡，标注可下单的全部平台 */
export interface SharedStore extends NearbyStore {
  /** 该品牌门店可下单的平台列表 */
  platforms: PlatformCode[];
  /** 真实门店地址（POI 模式存在） */
  address?: string;
  /** 是否为腾讯 POI 真实门店（区别于模拟兜底门店） */
  isPoi?: boolean;
  /** 可确定的连锁标准菜单品牌（对应 menu.ts BRAND_MENU 键）；非连锁小店为空 */
  menuBrand?: string;
}

/**
 * 三平台共有的连锁品牌门店（模块加载时生成一次并缓存）
 * 每个品牌稳定对应一家附近门店（商圈/评分/距离由品牌名种子决定，多次进入结果一致）
 */
const SHARED_STORES: Store[] = (() => {
  return BRAND_POOL.map((brand, i) => {
    const rand = mulberry32(hashString(`shared-${brand.name}`));
    const mall = MALL_POOL[Math.floor(rand() * MALL_POOL.length)];
    return {
      id: `shared-${i + 1}`,
      name: `${brand.name} · ${mall}`,
      brandLogo: brand.brandLogo,
      emoji: brand.emoji,
      bgColor: brand.bgColor,
      category: brand.category,
      rating: 4.5 + Math.round(rand() * 4) / 10, // 4.5 ~ 4.9
      monthlySales: (8 + Math.floor(rand() * 80)) * 100, // 800 ~ 8700
      deliveryFee: pick([0, 1, 2, 3, 4], rand),
      deliveryTime: 20 + Math.floor(rand() * 26), // 20 ~ 45 分钟
      minOrder: pick([0, 10, 15, 20, 25, 30], rand),
      bearing: Math.floor(rand() * 360), // 全向均匀分布
      offsetKm: Math.round((0.4 + rand() * 3.4) * 10) / 10 // 0.4 ~ 3.8km
    };
  });
})();

/** haversine 公式：计算两点间球面距离（km） */
function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371; // 地球半径 km
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * 固定参考点（上海人民广场）：门店虚拟坐标基于此生成，
 * 这样用户在上海不同位置时，到各门店的真实距离和排序会随定位变化。
 */
const ANCHOR: LocationInfo = { latitude: 31.2304, longitude: 121.4737 };

/**
 * 由方位角 + 偏移距离，从参考点推算门店固定经纬度
 * （门店坐标一旦生成即固定，不随用户位置变化）
 */
function projectStoreCoords(bearing: number, offsetKm: number, anchor: LocationInfo) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const kmPerDegLat = 111;
  const kmPerDegLng = 111 * Math.cos(rad(anchor.latitude));
  const dx = offsetKm * Math.sin(rad(bearing));
  const dy = offsetKm * Math.cos(rad(bearing));
  return {
    latitude: anchor.latitude + dy / kmPerDegLat,
    longitude: anchor.longitude + dx / kmPerDegLng
  };
}

/** 定位点 + 方位角/偏移 → 带距离/坐标的门店列表（就近升序，泛型保留 platform 等扩展字段） */
function attachNearbyInfo<T extends Store>(
  stores: T[],
  location: LocationInfo | null
): Array<T & { distanceKm: number; latitude?: number; longitude?: number }> {
  if (!location) {
    return stores.map((s) => ({ ...s, distanceKm: s.offsetKm }));
  }

  // 先按固定参考点生成门店坐标，计算用户到门店的真实距离
  const withFixedCoords = stores.map((s) => {
    const { latitude, longitude } = projectStoreCoords(s.bearing, s.offsetKm, ANCHOR);
    const distanceKm = haversineKm(
      location.latitude, location.longitude,
      latitude, longitude
    );
    return { ...s, latitude, longitude, distanceKm: Math.round(distanceKm * 10) / 10 };
  });

  // 如果用户离参考点太远（所有门店 > 50km），说明不在上海，
  // 回退到"门店围绕用户"的模拟模式，保证任何城市都能看到附近门店
  const maxDist = Math.max(...withFixedCoords.map((s) => s.distanceKm));
  if (maxDist > 50) {
    const rad = (d: number) => (d * Math.PI) / 180;
    const kmPerDegLat = 111;
    const kmPerDegLng = 111 * Math.cos(rad(location.latitude));
    return stores
      .map((s) => {
        const dx = s.offsetKm * Math.sin(rad(s.bearing));
        const dy = s.offsetKm * Math.cos(rad(s.bearing));
        const storeLat = location.latitude + dy / kmPerDegLat;
        const storeLng = location.longitude + dx / kmPerDegLng;
        return {
          ...s,
          latitude: storeLat,
          longitude: storeLng,
          distanceKm: s.offsetKm
        };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  // 用户在上海附近：按真实距离排序
  return withFixedCoords.sort((a, b) => a.distanceKm - b.distanceKm);
}

/**
 * 生成三平台共有「附近门店」列表（点外卖页用）
 * - 每个连锁品牌一张卡片，三平台均可下单
 * - 定位成功后按距离就近排序
 */
export function buildNearbySharedStores(location: LocationInfo | null): SharedStore[] {
  return attachNearbyInfo(SHARED_STORES, location).map((s) => ({
    ...s,
    platforms: [...SHARED_PLATFORMS]
  }));
}

// ===== 各平台独家门店（仅单平台可下单） =====

/**
 * 平台独家品牌池：该品牌只在对应平台有外卖店
 * （美团独家商家 / 淘宝闪购商超 / 京东七鲜等自营业态）
 */
const UNIQUE_BRANDS: Array<BrandDef & { platform: PlatformCode }> = [
  // —— 美团独家 ——
  { name: '夸父炸串', emoji: '🍢', bgColor: '#fdf0e6', category: 'snack', platform: 'meituan' },
  { name: '袁记云饺', emoji: '🥟', bgColor: '#f3f7e8', category: 'chinese', platform: 'meituan' },
  { name: '柠季手打柠檬茶', emoji: '🍋', bgColor: '#f5fbe8', category: 'tea', platform: 'meituan' },
  { name: 'Manner咖啡', emoji: '☕', bgColor: '#eef2f5', category: 'coffee', platform: 'meituan' },
  // —— 淘宝闪购独家（商超零售业态） ——
  { name: '盒马鲜生', emoji: '🦛', bgColor: '#e8f4fd', category: 'chinese', platform: 'taobao' },
  { name: '大润发优鲜', emoji: '🛒', bgColor: '#fdeee6', category: 'snack', platform: 'taobao' },
  { name: 'Tims咖啡', emoji: '🍁', bgColor: '#fdeaea', category: 'coffee', platform: 'taobao' },
  { name: '好利来', emoji: '🍰', bgColor: '#fdf0f5', category: 'snack', platform: 'taobao' },
  // —— 京东外卖独家（自营/七鲜业态） ——
  { name: '七鲜美食超市', emoji: '🥗', bgColor: '#e9f7ec', category: 'chinese', platform: 'jd' },
  { name: '京东便利店', emoji: '🏪', bgColor: '#eef0f3', category: 'snack', platform: 'jd' },
  { name: 'Seesaw咖啡', emoji: '🌊', bgColor: '#e8f0fb', category: 'coffee', platform: 'jd' },
  { name: '眉州东坡', emoji: '🍖', bgColor: '#fdf0e8', category: 'chinese', platform: 'jd' }
];

/** 各平台独家门店（模块加载时生成一次并缓存，字段由品牌名种子稳定生成） */
const UNIQUE_STORES: Array<Store & { platform: PlatformCode }> = UNIQUE_BRANDS.map((brand, i) => {
  const rand = mulberry32(hashString(`uniq-${brand.platform}-${brand.name}`));
  const mall = MALL_POOL[(i * 7 + Math.floor(rand() * 5)) % MALL_POOL.length];
  return {
    id: `uniq-${brand.platform}-${i + 1}`,
    name: `${brand.name} · ${mall}`,
    brandLogo: brand.brandLogo,
    emoji: brand.emoji,
    bgColor: brand.bgColor,
    category: brand.category,
    rating: 4.5 + Math.round(rand() * 4) / 10,
    monthlySales: (8 + Math.floor(rand() * 80)) * 100,
    deliveryFee: pick([0, 1, 2, 3, 4], rand),
    deliveryTime: 20 + Math.floor(rand() * 26),
    minOrder: pick([0, 10, 15, 20, 25, 30], rand),
    bearing: Math.floor(rand() * 360),
    offsetKm: Math.round((0.4 + rand() * 3.4) * 10) / 10,
    platform: brand.platform
  };
});

/**
 * 生成「共有门店 + 平台独家门店」完整附近门店列表（点外卖页用）
 * - 共有门店：三平台均可下单；独家门店：仅单平台可下单
 * - 定位成功后统一按距离就近排序（共有/独家混排）
 */
export function buildNearbyAllStores(location: LocationInfo | null): SharedStore[] {
  const shared = buildNearbySharedStores(location);
  const unique = attachNearbyInfo(UNIQUE_STORES, location).map((s) => ({
    ...s,
    platforms: [s.platform] as PlatformCode[]
  }));
  // attachNearbyInfo 已分别排序，合并后整体再按距离排序
  return [...shared, ...unique].sort((a, b) => a.distanceKm - b.distanceKm);
}

// ===== 四平台混合门店（AI 点餐助手等场景用） =====

/** 混合门店：在共有门店基础上标注来源平台（同品牌在三平台各一条） */
export interface MixedStore extends NearbyStore {
  platformCode: PlatformCode;
}

/**
 * 生成三平台混合「附近门店」列表
 * - 共有门店按平台展开（同一品牌三平台各一条），相邻排列
 * - 保持按距离就近排序，供 AI 点餐助手等「单平台卡片」场景复用
 */
export function buildNearbyStoresMixed(location: LocationInfo | null): MixedStore[] {
  return buildNearbySharedStores(location).flatMap((s) =>
    s.platforms.map((p) => ({
      ...s,
      id: `${s.id}-${p}`,
      platformCode: p
    }))
  );
}

// ===== 腾讯 POI 真实门店映射 =====

import type { NearbyPoi } from '@/services/cloudbase';

/** 腾讯 category（"美食:小吃快餐"）→ 前端品类 */
function mapPoiCategory(cat: string): CategoryCode {
  if (/咖啡|星巴克|瑞幸/.test(cat)) return 'coffee';
  if (/茶饮|奶茶|果汁|甜品|冰淇淋/.test(cat)) return 'tea';
  if (/火锅|串串/.test(cat)) return 'hotpot';
  if (/汉堡|披萨|炸鸡|西式/.test(cat)) return 'burger';
  if (/粉|面|麻辣烫|小吃|快餐|便当|饺子|馄饨/.test(cat)) return 'snack';
  return 'chinese';
}

/** 连锁品牌 → 平台归属（三平台共有）；非连锁 → 仅美团
 * menuBrand：连锁菜单全国标准化，命中时可使用 menu.ts 中该品牌的标准菜单；
 * 缺省（如无对应菜单数据）则不展示菜品，避免把品类通用菜伪装成门店菜单 */
const KNOWN_CHAIN_BRANDS: Array<{
  match: RegExp;
  brandLogo?: BrandLogoKey;
  emoji: string;
  bgColor: string;
  menuBrand?: string;
}> = [
  { match: /肯德基|KFC/i, brandLogo: 'kfc', emoji: '🍗', bgColor: '#fde8e8', menuBrand: '肯德基宅急送' },
  { match: /麦当劳|McDonald/i, brandLogo: 'mcdonalds', emoji: '🍔', bgColor: '#fff3e0', menuBrand: '麦当劳' },
  { match: /必胜客|Pizza\s*Hut/i, brandLogo: 'pizzahut', emoji: '🍕', bgColor: '#fdeef0', menuBrand: '必胜客宅急送' },
  { match: /华莱士/i, brandLogo: 'wallace', emoji: '🍟', bgColor: '#fff7e0', menuBrand: '华莱士' },
  { match: /德克士|Dicos/i, brandLogo: 'dicos', emoji: '🍛', bgColor: '#fdece4', menuBrand: '德克士' },
  { match: /汉堡王|Burger\s*King/i, brandLogo: 'burgerking', emoji: '👑', bgColor: '#f3ecfd', menuBrand: '汉堡王' },
  { match: /瑞幸|luckin/i, brandLogo: 'luckincoffee', emoji: '☕', bgColor: '#e8f1fd', menuBrand: '瑞幸咖啡' },
  { match: /星巴克|Starbucks/i, brandLogo: 'starbucks', emoji: '🌟', bgColor: '#e8f0fd', menuBrand: '星巴克' },
  { match: /蜜雪冰城/i, brandLogo: 'mixue', emoji: '🍦', bgColor: '#fde8f0', menuBrand: '蜜雪冰城' },
  { match: /古茗/i, brandLogo: 'guming', emoji: '🧋', bgColor: '#e9f7ec', menuBrand: '古茗' },
  { match: /茶百道/i, brandLogo: 'chabaidao', emoji: '🥤', bgColor: '#e6f4fb', menuBrand: '茶百道' },
  { match: /喜茶/i, brandLogo: 'heytea', emoji: '🍵', bgColor: '#eafaf0', menuBrand: '喜茶' },
  { match: /海底捞/i, brandLogo: 'haidilao', emoji: '🍲', bgColor: '#fdeeee', menuBrand: '海底捞火锅' },
  { match: /奈雪/i, emoji: '🍰', bgColor: '#fdeaf0', menuBrand: '奈雪的茶' },
  { match: /塔斯汀/i, emoji: '🍔', bgColor: '#fde4e4', menuBrand: '塔斯汀中国汉堡' },
  { match: /库迪|Cotti/i, emoji: '☕', bgColor: '#e8f0fd', menuBrand: '库迪咖啡' },
  { match: /沪上阿姨/i, emoji: '🧋', bgColor: '#f6e8fb', menuBrand: '沪上阿姨' },
  { match: /书亦烧仙草/i, emoji: '🌿', bgColor: '#e9f5ec', menuBrand: '书亦烧仙草' },
  { match: /CoCo/i, emoji: '🥤', bgColor: '#e6f0fb', menuBrand: 'CoCo都可' },
  { match: /呷哺呷哺/i, emoji: '🍢', bgColor: '#fdf0e6', menuBrand: '呷哺呷哺' },
  { match: /小龙坎/i, emoji: '🌶️', bgColor: '#fde8e8', menuBrand: '小龙坎火锅' },
  { match: /老乡鸡/i, emoji: '🐔', bgColor: '#fdf0e6', menuBrand: '老乡鸡' },
  { match: /真功夫/i, emoji: '🥟', bgColor: '#fde8e8', menuBrand: '真功夫' },
  { match: /永和大王/i, emoji: '🥣', bgColor: '#fff6e0', menuBrand: '永和大王' },
  { match: /吉野家/i, emoji: '🍱', bgColor: '#fde9e4', menuBrand: '吉野家' },
  { match: /杨国福/i, emoji: '🍢', bgColor: '#fdeee6', menuBrand: '杨国福麻辣烫' },
  { match: /张亮麻辣烫/i, emoji: '🍲', bgColor: '#fdf3e3', menuBrand: '张亮麻辣烫' },
  { match: /沙县小吃/i, emoji: '🥟', bgColor: '#f5f0e6', menuBrand: '沙县小吃' },
  { match: /兰州拉面|兰州牛肉面/i, emoji: '🍜', bgColor: '#fdeee8', menuBrand: '兰州拉面' }
];

const CATEGORY_EMOJI: Record<CategoryCode, string> = {
  burger: '🍔', coffee: '☕', tea: '🧋', hotpot: '🍲',
  chinese: '🍚', snack: '🍜', all: '🍽️'
};

/**
 * 腾讯 POI 数组 → 前端 SharedStore 列表
 * 连锁品牌识别成功 → 三平台共有；非连锁 → 仅美团
 * 评分/月售等外卖字段不存在，由 UI 隐藏
 */
export function mapPoisToStores(pois: NearbyPoi[]): SharedStore[] {
  return pois.map((poi) => {
    const chain = KNOWN_CHAIN_BRANDS.find((b) => b.match.test(poi.title));
    const category = mapPoiCategory(poi.category || '');
    const isChain = !!chain;
    return {
      id: `poi-${poi.id}`,
      name: poi.title,
      brandLogo: chain?.brandLogo,
      emoji: chain?.emoji || CATEGORY_EMOJI[category] || '🍽️',
      bgColor: chain?.bgColor || '#f5f5f5',
      category,
      rating: 0,
      monthlySales: 0,
      deliveryFee: 0,
      deliveryTime: 0,
      minOrder: 0,
      bearing: 0,
      offsetKm: 0,
      distanceKm: Math.round((poi._distance / 1000) * 10) / 10,
      latitude: poi.location.lat,
      longitude: poi.location.lng,
      address: poi.address,
      isPoi: true,
      menuBrand: chain?.menuBrand,
      platforms: isChain ? [...SHARED_PLATFORMS] : ['meituan' as PlatformCode]
    };
  });
}
