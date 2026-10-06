/**
 * 平台跳转服务
 *
 * 两个入口，落地下单的语义不同：
 * 1. openPlatformOrder(platformCode, keyword?) —— 门店卡片「去下单」/品牌券「去使用」：
 *    - 传入品牌名（keyword）→ 直达该品牌在平台的「门店搜索结果页」，用户就近选店下单，
 *      不再落到平台首页让用户重新搜索；
 *    - 不传品牌名（平台通用入口、无门槛红包）→ 打开平台点餐首页。
 * 2. openCouponPlatform(coupon) —— 券「去使用/去领取」：若券配置了联盟 claimUrl，
 *    优先走联盟红包落地页（追踪佣金）；否则按券类型分流：
 *    品牌券 → 品牌门店搜索下单页；无门槛/平台红包 → 平台首页。
 *
 * 落地路径依据（2026-10 实测 / 美团 CPS 行业通行做法）：
 * - 美团 H5 品牌搜索：https://h5.waimai.meituan.com/waimai/mindex/search?keyword=xxx（可达）
 * - 饿了么 H5 品牌搜索：https://h5.ele.me/search/?keyword=xxx（自动跳转 minisearch/result 结果页）
 * - 美团微信小程序：内建 H5 容器 /index/pages/h5/h5?weburl=<h5.waimai.meituan.com 链接>，
 *   领券可直达红包页、下单可直开品牌附近门店列表（点门店即进点餐页）
 * - 饿了么/淘宝闪购微信小程序领券：commercialize/pages/taoke-guide/index?scene=xxx（淘客领券页）
 * - 品牌点餐页深链（如美团 packages/restaurant/restaurant/restaurant?poi_id=xxx、
 *   饿了么 pages/shop/shop/index?id=E...）均需平台内部门店 ID，第三方无法获得，
 *   非美团平台只能「官方小程序首页 + 复制品牌名引导粘贴搜索」
 */
import Taro from '@tarojs/taro';
import { PLATFORM_JUMP, PLATFORM_META } from '@/constants/platforms';
import type { Coupon, PlatformCode } from '@/types/coupon';

/** 平台自身的品牌名（出现在券 brand 字段时说明是平台通用红包，不是品牌门店券） */
const PLATFORM_BRANDS = new Set(['美团外卖', '饿了么', '淘宝闪购', '京东', '京东外卖']);

/** 复制文本 + 引导提示 */
async function copyAndToast(text: string, tip: string): Promise<void> {
  try {
    await Taro.setClipboardData({ data: text });
  } catch (err) {
    console.error('[platformJump] copy failed:', err);
  }
  Taro.showToast({ title: tip, icon: 'none', duration: 2500 });
}

/**
 * 构造品牌门店搜索 H5 落地页（打开后按用户定位展示该品牌附近门店，可直接进店下单）
 */
function buildBrandSearchUrl(platformCode: PlatformCode, brand: string): string {
  const kw = encodeURIComponent(brand);
  switch (platformCode) {
    case 'meituan':
      return `https://h5.waimai.meituan.com/waimai/mindex/search?keyword=${kw}`;
    case 'eleme':
      return `https://h5.ele.me/search/?keyword=${kw}`;
    case 'taobao':
      return `https://s.taobao.com/search?q=${kw}`;
    case 'jd':
      return `https://so.m.jd.com/ware/search.action?keyword=${kw}`;
    default:
      return `https://h5.waimai.meituan.com/waimai/mindex/search?keyword=${kw}`;
  }
}

/**
 * 从演示门店名中提取品牌关键词（店名格式：「品牌 · 商圈店」，取「·」之前的品牌部分）
 */
export function extractStoreBrand(storeName: string): string {
  return storeName.split(/\s*[·•｜|]\s*/)[0].trim() || storeName;
}

/**
 * 从平台小程序内嵌路径中提取 weburl 参数
 * 例：/index/pages/h5/h5?weburl=https%3A%2F%2F...&f_token=0 → https://...
 * 手工解析（不依赖 URL/URLSearchParams），兼容微信小程序运行时
 */
function extractWebUrl(miniPath: string): string {
  const m = miniPath.match(/[?&]weburl=([^&]+)/);
  if (!m) return '';
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return '';
  }
}

/**
 * 直达品牌门店下单
 * - 微信端·美团：官方小程序内建 H5 容器（/index/pages/h5/h5，本项目领券链路已实测可用），
 *   直接加载品牌搜索 H5 → 小程序内打开「品牌附近门店列表」，点门店即进点餐页，
 *   无需落首页/手动粘贴；容器跳转失败再回退「首页 + 复制品牌名与链接」
 * - 微信端·饿了么/淘宝闪购/京东：无可用的公开深链（点餐页需平台内部门店 ID），
 *   跳官方小程序 + 复制「品牌名 + 搜索链接」，用户粘贴搜索后进店
 * - H5 端：当前标签直接打开品牌搜索页；失败则复制兜底
 */
async function openBrandOrder(platformCode: PlatformCode, brand: string): Promise<void> {
  const meta = PLATFORM_JUMP[platformCode] ?? PLATFORM_JUMP.meituan;
  const platformName = PLATFORM_META[platformCode]?.name ?? '外卖平台';
  const searchUrl = buildBrandSearchUrl(platformCode, brand);

  if (process.env.TARO_ENV === 'weapp' && meta.miniAppId) {
    // 美团小程序 H5 容器：直开搜索结果（附近门店列表），比「首页+粘贴搜索」少两步。
    // 点餐页 URL 需要 mtShopId（平台内部 ID，腾讯 POI 无法获得），搜索结果是当前可达的最近位置。
    if (platformCode === 'meituan') {
      const containerPath = `/index/pages/h5/h5?weburl=${encodeURIComponent(searchUrl)}`;
      try {
        await Taro.navigateToMiniProgram({
          appId: meta.miniAppId,
          path: containerPath,
          envVersion: 'release'
        });
        Taro.showToast({
          title: '选择附近门店进入点餐页',
          icon: 'none',
          duration: 2500
        });
        return;
      } catch (err) {
        // 用户取消或容器路径失效 → 落到下面的「首页 + 复制」兜底
        console.warn('[platformJump] meituan h5-container failed, fallback:', err);
      }
    }

    // 兜底：跳官方小程序首页；同时把品牌名 + 搜索链接复制到剪贴板：
    // - 在平台内搜索框粘贴品牌名 → 搜到品牌门店
    // - 在浏览器粘贴链接 → 打开 H5 门店搜索页
    try {
      await Taro.navigateToMiniProgram({
        appId: meta.miniAppId,
        path: '',
        envVersion: 'release'
      });
      // 跳转成功后才复制（提前复制会被小程序跳转打断提示）
      try {
        await Taro.setClipboardData({ data: `${brand}\n${searchUrl}` });
        Taro.showToast({
          title: `${brand}门店链接已复制，粘贴到${platformName}搜索框即可`,
          icon: 'none',
          duration: 2500
        });
      } catch { /* 复制失败不阻塞 */ }
      return;
    } catch (err) {
      console.warn('[platformJump] brand navigateToMiniProgram failed:', err);
      await copyAndToast(`${brand}\n${searchUrl}`, `${brand}门店链接已复制，请打开${platformName}下单`);
      return;
    }
  }

  if (process.env.TARO_ENV === 'h5' && typeof window !== 'undefined') {
    try {
      window.open(searchUrl, '_blank');
      return;
    } catch (err) {
      console.warn('[platformJump] open brand url failed:', err);
    }
  }

  // 微信端淘宝闪购/京东（禁止互跳小程序）→ 打开 H5 品牌搜索页，
  // H5 页内自带「打开APP」按钮，用户点一下即可拉起 APP 直达门店搜索
  if (process.env.TARO_ENV === 'weapp' && typeof window !== 'undefined') {
    try {
      window.open(searchUrl, '_blank');
      return;
    } catch (err) {
      console.warn('[platformJump] weapp open brand url failed:', err);
    }
  }
  // 兜底：复制品牌名 + 品牌下单链接
  await copyAndToast(`${brand}\n${searchUrl}`, `${brand}门店链接已复制，请打开${platformName}下单`);
}

/**
 * 直达平台点餐：
 * - 传入品牌名（keyword）→ 品牌门店搜索结果页，就近进店下单
 * - 未传品牌名 → 微信端跳官方小程序点餐首页，H5 端/淘宝系复制点餐落地页
 */
export async function openPlatformOrder(
  platformCode: PlatformCode,
  keyword?: string
): Promise<void> {
  const meta = PLATFORM_JUMP[platformCode] ?? PLATFORM_JUMP.meituan;

  // 品牌门店券：直达品牌门店列表，不落到平台首页
  if (keyword && keyword.trim()) {
    await openBrandOrder(platformCode, keyword.trim());
    return;
  }

  // 微信小程序端：直接跳官方小程序（H5 端无此 API，靠 TARO_ENV 编译期裁剪）
  if (process.env.TARO_ENV === 'weapp' && meta.miniAppId) {
    try {
      await Taro.navigateToMiniProgram({
        appId: meta.miniAppId,
        path: meta.miniPath || '',
        envVersion: 'release'
      });
      return;
    } catch (err) {
      // 用户取消官方确认弹窗属正常操作，不打扰；其余失败给出可感知提示
      console.warn('[platformJump] navigateToMiniProgram failed:', err);
      Taro.showToast({ title: '未能打开点餐小程序，请稍后重试', icon: 'none', duration: 2000 });
      return;
    }
  }

  // 兜底：H5 端 / 微信无法互跳的平台（淘宝系）→ 复制点餐落地页
  await copyAndToast(meta.h5Url, meta.copyTip);
}

/** 判断是否为无门槛/平台通用券（这类券跳平台首页，不按品牌进店） */
function isPlatformWideCoupon(
  coupon: Pick<Coupon, 'brand' | 'tag' | 'title'>
): boolean {
  if (coupon.tag === '无门槛') return true;
  if (coupon.title && coupon.title.includes('无门槛')) return true;
  if (coupon.brand && PLATFORM_BRANDS.has(coupon.brand)) return true;
  return false;
}

/** 判断是否为淘口令（＄xxx＄ 全角 / $xxx$ 半角，需复制后打开淘宝/淘宝闪购 APP 识别） */
function isTaobaoCode(text: string): boolean {
  return /^[＄$][^＄$]+[＄$]/.test(text.trim());
}

/**
 * 判断领券链接是否为「口令类」（mp:// 微信如意口令 / ＄淘口令），
 * 这类链接无法解析出小程序页面路径，只能复制后由对应 APP 识别直达。
 */
export function isCodeCouponUrl(url: string): boolean {
  const u = (url || '').trim();
  if (!u) return false;
  if (u.startsWith('mp://')) return true;
  if (isTaobaoCode(u)) return true;
  return false;
}

/**
 * 「帮用户打开」口令类链接（mp:// 如意口令 / ＄淘口令）：
 * 微信未开放直接打开此类口令的 JS API，采用最接近直达的交互——
 * 复制口令 → 弹窗引导 → 用户点「去打开」后退出小程序（exitMiniProgram），
 * 由微信顶部气泡（如意口令）或淘宝/淘宝闪购 APP 启动识别（淘口令）完成直达，全程无需粘贴。
 */
async function copyCodeAndGuideExit(code: string, modalContent: string): Promise<void> {
  try {
    await Taro.setClipboardData({ data: code });
  } catch (err) {
    console.warn('[platformJump] copy code failed:', err);
  }
  try {
    const res = await Taro.showModal({
      title: '领券口令已复制',
      content: modalContent,
      confirmText: '去打开',
      cancelText: '留在此页',
      showCancel: true
    });
    if (res.confirm) {
      // 低版本基础库无此 API 时静默失败，用户可自行点返回，口令仍已在剪贴板
      const exit = (Taro as unknown as { exitMiniProgram?: (opts: object) => void }).exitMiniProgram;
      if (typeof exit === 'function') {
        exit.call(Taro, {});
      }
    }
  } catch { /* 用户取消弹窗等情况不处理 */ }
}

/**
 * 券「去使用 / 去领取」：按 claim_url 真实类型直达各平台领券页
 *
 * 微信端（navigateToMiniProgramAppIdList 已在 app.config.ts 声明）：
 * - claim_url 以「/」开头：平台官方小程序内部页面路径，直接带 path 跳 = 领券页
 *   · 美团：/index/pages/h5/h5?weburl=<click.meituan.com 短链>（美团官方小程序内建 H5 容器）
 *   · 饿了么/淘宝闪购：/commercialize/pages/taoke-guide/index?scene=xxx（淘客领券引导页）
 * - mp:// 开头（微信口令）/ 淘口令（＄xxx＄）：加密短链无法解析出页面路径，跳小程序首页
 *   到不了领券页，故复制口令 → 退出小程序，由微信顶部气泡 / 淘宝 APP 识别直达精确页面
 * - http(s) 链接（京东 u.jd.com 等）：复制后发送到微信聊天点击，唤起对应 APP 领券
 * - 无链接：品牌券进店下单；平台通用红包跳官方小程序首页（首页有红包入口）
 *
 * H5 / 其它端：优先打开联盟红包活动页（claimUrl），无链接时按品牌券/平台券分流
 */
export async function openCouponPlatform(
  coupon: Pick<Coupon, 'platformCode' | 'claimUrl' | 'brand' | 'tag' | 'title'>
): Promise<void> {
  const meta = PLATFORM_JUMP[coupon.platformCode] ?? PLATFORM_JUMP.meituan;
  const claimUrl = (coupon.claimUrl || '').trim();

  // ===== 微信端：按领券链接类型分发，尽量直达领券页 =====
  if (process.env.TARO_ENV === 'weapp') {
    // 1) 平台官方小程序内部领券路径（/ 开头）→ 带 path 跳官方小程序，直达领券页
    if (claimUrl.startsWith('/') && meta.miniAppId) {
      try {
        await Taro.navigateToMiniProgram({
          appId: meta.miniAppId,
          path: claimUrl,
          envVersion: 'release'
        });
        return;
      } catch (err) {
        console.warn('[platformJump] coupon navigateToMiniProgram failed:', err);
        // 失败继续走下面的兜底
      }
    }

    // 2) 口令类券（mp:// 微信口令 / ＄xxx＄ 淘口令）：
    //    口令是加密短链，代码里解析不出对应的小程序页面路径（微信也不提供解析 API），
    //    直接跳官方小程序只能到首页、到不了领券页，因此保留「复制口令 + 退出小程序」
    //    由微信顶部气泡 / 淘宝 APP 识别口令直达精确页面；若券配置了真实小程序路径
    //    （/ 开头，走上面分支 1）则优先直达。
    if (claimUrl.startsWith('mp://')) {
      await copyCodeAndGuideExit(
        claimUrl,
        '点击「去打开」返回微信，顶部出现「打开」提示时点一下，即可直达领券页'
      );
      return;
    }

    if (isTaobaoCode(claimUrl)) {
      await copyCodeAndGuideExit(
        claimUrl,
        '点击「去打开」后打开淘宝或淘宝闪购 APP，将自动弹出领券卡片'
      );
      return;
    }

    // 3) http(s) 领券短链（京东 u.jd.com 等）：复制后发到微信聊天点击，唤起 APP 领券
    if (/^https?:\/\//.test(claimUrl)) {
      await copyAndToast(claimUrl, `领券链接已复制，发送到微信聊天点击即可在${PLATFORM_META[coupon.platformCode]?.name ?? '对应 APP'}领券`);
      return;
    }

    // 4) 无领券链接：品牌券进店下单，平台通用红包跳官方小程序首页
    if (!isPlatformWideCoupon(coupon) && coupon.brand) {
      await openBrandOrder(coupon.platformCode, coupon.brand);
      return;
    }
    await openPlatformOrder(coupon.platformCode);
    return;
  }

  // ===== H5 / 其它端 =====
  // mp:// 微信如意口令：复制后打开微信，顶部「打开」气泡点一下即可直达
  if (claimUrl.startsWith('mp://')) {
    await copyAndToast(claimUrl, '领券口令已复制，请打开微信点击顶部「打开」提示');
    return;
  }

  // 淘口令：复制后打开淘宝/淘宝闪购 APP 自动识别
  if (isTaobaoCode(claimUrl)) {
    await copyAndToast(claimUrl, '淘口令已复制，打开淘宝/淘宝闪购即可领券');
    return;
  }

  // 其它联盟推广链接
  if (claimUrl) {
    // 小程序内嵌路径（以 / 开头，如 /index/pages/h5/h5?weburl=xxx）：
    // H5 端无法跳小程序，提取 weburl 参数直接打开联盟落地页；提取不到再回退平台首页
    if (claimUrl.startsWith('/')) {
      if (typeof window !== 'undefined') {
        const webUrl = extractWebUrl(claimUrl);
        if (webUrl) {
          window.open(webUrl, '_blank');
          return;
        }
      }
      await openPlatformOrder(coupon.platformCode);
      return;
    }
    // H5 端：http/https 联盟链接直接打开，让用户看到真实领券页面
    if (typeof window !== 'undefined' && /^https?:\/\//.test(claimUrl)) {
      window.open(claimUrl, '_blank');
      return;
    }
    await copyAndToast(claimUrl, meta.copyTip);
    return;
  }

  // 无联盟链接：品牌券直达品牌门店下单页；无门槛/平台红包才跳平台首页
  if (!isPlatformWideCoupon(coupon) && coupon.brand) {
    await openBrandOrder(coupon.platformCode, coupon.brand);
    return;
  }

  await openPlatformOrder(coupon.platformCode);
}
