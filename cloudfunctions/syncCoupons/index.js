/**
 * syncCoupons：券源同步（CloudBase PostgreSQL HTTP API 版）
 *
 * 【模式 1：内置种子同步】不带参数调用 → 将内置 13 张默认券 upsert 进 coupons 表
 *   （首次部署后手动调用一次即可完成初始化；重复调用安全，按 coupon_id 合并去重）
 *
 * 【模式 2：自定义券源】传 event.coupons（数组）→ upsert 自定义批次
 *
 * 【模式 3：联盟自动同步】
 *   3.1 折淘客聚合转链（已联调通过）：
 *     ZTK_APPKEY / ZTK_SID / ZTK_PID  → 美团外卖红包专用转链（actId=33, linkType=4）
 *     返回美团小程序内嵌路径，weapp 端 navigateToMiniProgram(path) 直达红包落地页
 *   3.2 单平台直连联盟（凭据未到位，骨架预留）：
 *     MT_UNION_APP_KEY / MT_UNION_SECRET          （美团联盟 openapi.dianping.com）
 *     TBK_APP_KEY / TBK_SECRET / TBK_ADZONE_ID    （淘宝联盟 TOP，含饿了么/淘宝闪购物料）
 *     JD_UNION_APP_KEY / JD_UNION_SECRET          （京东联盟 api.jd.com）
 *   任一平台凭据缺失或请求失败 → 跳过该平台；全部为空时回退内置种子
 *   ⚠️ 3.2 接口名/签名/返回结构按官方文档实现，凭据到位后需联调核对（标有 TODO-VERIFY）
 */
const crypto = require('crypto')
const ENV_ID = process.env.CLOUDBASE_ENV_ID || 'shengchi-d3g1ayd7kf9c0a013'
const API_KEY = process.env.CLOUDBASE_API_KEY || ''
const BASE = `https://${ENV_ID}.api.tcloudbasegateway.com/v1/rdb/rest`

/** 内置种子券（与前端 mock 数据一致，首次初始化用） */
const DEFAULT_SEED = [
  { coupon_id: 'c001', brand: '肯德基', emoji: '🍗', bg_color: '#fde8e8', brand_logo: 'kfc', category: 'burger', title: '满 50 减 15', description: '全场通用 · 今日有效', platform: '美团外卖', platform_code: 'meituan', tag: '热门', min_price: 50, total_count: 1000, remaining_count: 1000, weight: 100, status: 'active', claim_url: '' },
  { coupon_id: 'c002', brand: '麦当劳', emoji: '🍔', bg_color: '#fff3e0', brand_logo: 'mcdonalds', category: 'burger', title: '满 40 减 10', description: '指定套餐可用', platform: '饿了么', platform_code: 'eleme', tag: '热门', min_price: 40, total_count: 1000, remaining_count: 1000, weight: 99, status: 'active', claim_url: '' },
  { coupon_id: 'c003', brand: '瑞幸咖啡', emoji: '☕', bg_color: '#e8f1fd', brand_logo: 'luckincoffee', category: 'coffee', title: '指定饮品 9.9 元', description: '每日限领 1 张', platform: '美团外卖', platform_code: 'meituan', tag: '限时', min_price: 9.9, total_count: 1000, remaining_count: 1000, weight: 98, status: 'active', claim_url: '' },
  { coupon_id: 'c004', brand: '必胜客', emoji: '🍕', bg_color: '#fdeef0', brand_logo: 'pizzahut', category: 'burger', title: '满 100 减 30', description: '披萨专享 · 可叠会员红包', platform: '淘宝闪购', platform_code: 'taobao', tag: '', min_price: 100, total_count: 1000, remaining_count: 1000, weight: 90, status: 'active', claim_url: '' },
  { coupon_id: 'c005', brand: '华莱士', emoji: '🍟', bg_color: '#fff7e0', brand_logo: 'wallace', category: 'burger', title: '满 30 减 8', description: '全场通用 · 免配送费', platform: '美团外卖', platform_code: 'meituan', tag: '', min_price: 30, total_count: 1000, remaining_count: 1000, weight: 85, status: 'active', claim_url: '' },
  { coupon_id: 'c006', brand: '蜜雪冰城', emoji: '🍦', bg_color: '#fde8f0', brand_logo: 'mixue', category: 'tea', title: '满 20 减 5', description: '冰饮专场 · 新品尝鲜', platform: '饿了么', platform_code: 'eleme', tag: '限时', min_price: 20, total_count: 1000, remaining_count: 1000, weight: 84, status: 'active', claim_url: '' },
  { coupon_id: 'c007', brand: '古茗', emoji: '🧋', bg_color: '#e9f7ec', brand_logo: 'guming', category: 'tea', title: '满 25 减 6', description: '新品奶茶可用', platform: '淘宝闪购', platform_code: 'taobao', tag: '', min_price: 25, total_count: 1000, remaining_count: 1000, weight: 82, status: 'active', claim_url: '' },
  { coupon_id: 'c008', brand: '茶百道', emoji: '🥤', bg_color: '#e6f4fb', brand_logo: 'chabaidao', category: 'tea', title: '满 28 减 7', description: '指定果茶饮品', platform: '美团外卖', platform_code: 'meituan', tag: '', min_price: 28, total_count: 1000, remaining_count: 1000, weight: 80, status: 'active', claim_url: '' },
  { coupon_id: 'c009', brand: '德克士', emoji: '🍛', bg_color: '#fdece4', brand_logo: 'dicos', category: 'burger', title: '满 45 减 12', description: '午餐特惠 · 11:00-14:00', platform: '饿了么', platform_code: 'eleme', tag: '', min_price: 45, total_count: 1000, remaining_count: 1000, weight: 78, status: 'active', claim_url: '' },
  { coupon_id: 'c010', brand: '汉堡王', emoji: '👑', bg_color: '#f3ecfd', brand_logo: 'burgerking', category: 'burger', title: '满 60 减 18', description: '皇堡套餐专享', platform: '淘宝闪购', platform_code: 'taobao', tag: '热门', min_price: 60, total_count: 1000, remaining_count: 1000, weight: 75, status: 'active', claim_url: '' },
  { coupon_id: 'c011', brand: '星巴克', emoji: '🌟', bg_color: '#e8f0fd', brand_logo: 'starbucks', category: 'coffee', title: '满 60 减 20', description: '全场饮品通用 · 下午茶专享', platform: '淘宝闪购', platform_code: 'taobao', tag: '热门', min_price: 60, total_count: 1000, remaining_count: 1000, weight: 65, status: 'active', claim_url: '' },
  { coupon_id: 'c012', brand: '喜茶', emoji: '🍵', bg_color: '#eafaf0', brand_logo: 'heytea', category: 'tea', title: '指定饮品 12.9 元', description: '当季新品 · 每日限量', platform: '饿了么', platform_code: 'eleme', tag: '限时', min_price: 12.9, total_count: 1000, remaining_count: 1000, weight: 60, status: 'active', claim_url: '' },
  { coupon_id: 'c013', brand: '海底捞', emoji: '🍲', bg_color: '#fdeeee', brand_logo: 'haidilao', category: 'hotpot', title: '满 150 减 40', description: '火锅到家 · 含锅底套餐', platform: '美团外卖', platform_code: 'meituan', tag: '', min_price: 150, total_count: 1000, remaining_count: 1000, weight: 55, status: 'active', claim_url: '' }
]

/** 自定义批次字段标准化（ camelCase → snake_case，缺省补默认值） */
function normalizeRow(raw) {
  return {
    coupon_id: raw.coupon_id || raw.id,
    brand: raw.brand,
    emoji: raw.emoji || '🍽️',
    bg_color: raw.bg_color || raw.bgColor || '#fde8e8',
    brand_logo: raw.brand_logo || raw.brandLogo || '',
    category: raw.category || 'all',
    title: raw.title,
    description: raw.description || raw.desc || '',
    platform: raw.platform || '',
    platform_code: raw.platform_code || raw.platformCode || 'meituan',
    tag: raw.tag || '',
    min_price: raw.min_price != null ? raw.min_price : raw.minPrice != null ? raw.minPrice : null,
    total_count: raw.total_count || raw.totalCount || 1000,
    remaining_count: raw.remaining_count != null ? raw.remaining_count : raw.remainingCount != null ? raw.remainingCount : raw.total_count || raw.totalCount || 1000,
    weight: raw.weight || 0,
    status: raw.status || 'active',
    claim_url: raw.claim_url || raw.claimUrl || '',
    updated_at: new Date().toISOString()
  }
}

/** upsert：按 coupon_id 唯一键合并（merge-duplicates） */
async function upsert(rows) {
  const res = await fetch(`${BASE}/coupons?on_conflict=coupon_id`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(rows)
  })
  if (!res.ok) throw new Error(`upsert ${res.status}: ${await res.text()}`)
  return rows.length
}

// ===== 联盟 API 通用工具 =====

/** MD5 大写（各联盟签名通用） */
function md5Upper(text) {
  return crypto.createHash('md5').update(text, 'utf8').digest('hex').toUpperCase()
}

/** 安全 POST JSON（10s 超时，非 2xx 抛错） */
async function postJson(url, payload, headers = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => '')}`)
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

/** 从「满30减8」/「满 30 减 8」类券文案解析门槛与面额 */
function parseCouponText(text) {
  const m = /满\s*(\d+(?:\.\d+)?)\s*减\s*(\d+(?:\.\d+)?)/.exec(String(text || ''))
  if (!m) return null
  return { min: parseFloat(m[1]), amount: parseFloat(m[2]) }
}

/** 联盟券 → coupons 表行（platform_code 须与前端 PlatformCode 一致） */
function unionRow({ platform, platformCode, bizId, brand, title, desc, claimUrl, min, emoji, bgColor, tag, category, weight }) {
  return {
    coupon_id: `${platformCode}_${bizId}`,
    brand,
    emoji: emoji || '🍽️',
    bg_color: bgColor || '#fde8e8',
    brand_logo: '',
    category: category || 'all',
    title,
    description: desc || '',
    platform,
    platform_code: platformCode,
    tag: tag || '',
    min_price: min != null ? min : null,
    // 联盟券无库存概念，置 0（前端不展示余量）
    total_count: 0,
    remaining_count: 0,
    weight: weight || 50,
    status: 'active',
    claim_url: claimUrl || '',
    updated_at: new Date().toISOString()
  }
}

/**
 * 折淘客聚合转链（已联调通过）
 * 接口：open_meituan_generateLink.ashx（美团外卖红包专用转链）
 *   actId=33   美团外卖红包活动（实测可用，其它 actId 4/31/137 全部失败）
 *   linkType=4 返回美团小程序内嵌 H5 跳转路径（/index/pages/h5/h5?weburl=...），
 *             weapp 端 navigateToMiniProgram(appId=美团外卖小程序, path=claim_url) 直达
 *   linkType=1 返回 H5 短链，仅作 H5 端兜底/调试使用（这里不取）
 */
async function fetchFromZtk() {
  const APPKEY = process.env.ZTK_APPKEY
  const SID = process.env.ZTK_SID
  const PID = process.env.ZTK_PID
  if (!APPKEY || !SID || !PID) return []
  const url = new URL('https://api.zhetaoke.com:10001/api/open_meituan_generateLink.ashx')
  url.searchParams.set('appkey', APPKEY)
  url.searchParams.set('sid', SID)
  url.searchParams.set('pid', PID)
  url.searchParams.set('actId', '33')
  url.searchParams.set('linkType', '4')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  let json
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    json = await res.json()
  } finally {
    clearTimeout(timer)
  }
  if (json?.status !== 0 || !json?.successful || !json?.data) {
    throw new Error(`ztk generateLink failed: ${JSON.stringify(json).slice(0, 500)}`)
  }
  const claimUrl = String(json.data)
  return [
    unionRow({
      platform: '美团外卖',
      platformCode: 'meituan',
      bizId: 'mt_hongbao_33',
      brand: '美团外卖红包',
      title: '美团外卖红包 · 天天领',
      desc: '美团外卖通用红包 · 下单立减',
      claimUrl,
      emoji: '🛵',
      bgColor: '#ffc9a8',
      tag: '红包',
      category: 'all',
      weight: 120
    })
  ]
}

/**
 * 折淘客饿了么转链（已联调通过）
 * 接口：open_eleme_generateLink.ashx（淘宝闪购联盟官方活动查询，折淘客代理）
 *   activity_id=10144 饿了么天天领红包（最高抢66元大红包，全场景通用，长期有效）
 *   返回 wx_appid(wxece3a9a4c82f58c9) + wx_path（微信小程序内嵌路径）
 *   weapp 端 navigateToMiniProgram(appId=wx_appid, path=wx_path) 直达红包落地页
 *   另返回 h5_short_link（H5 短链兜底）+ ele_scheme_url（饿了么 APP 唤端）
 *   注：旧版 activity_id=1571715733668 已废弃返回 402；新版用短数字 ID（10144/12688 等）
 */
async function fetchFromElemeZtk() {
  const APPKEY = process.env.ZTK_APPKEY
  const SID = process.env.ZTK_SID
  const PID = process.env.ZTK_PID
  if (!APPKEY || !SID || !PID) return []
  const url = new URL('https://api.zhetaoke.com:10001/api/open_eleme_generateLink.ashx')
  url.searchParams.set('appkey', APPKEY)
  url.searchParams.set('sid', SID)
  url.searchParams.set('pid', PID)
  url.searchParams.set('activity_id', '10144')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  let json
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    json = await res.json()
  } finally {
    clearTimeout(timer)
  }
  const data = json?.alibaba_alsc_union_eleme_promotion_officialactivity_get_response?.data
  if (!data || !data.link) throw new Error(`eleme generateLink failed: ${JSON.stringify(json).slice(0, 500)}`)
  const link = data.link
  // wx_path 规范化为以 / 开头（platformJump.ts weapp 端据此跳小程序内嵌页）
  const wxPath = link.wx_path
    ? (link.wx_path.startsWith('/') ? link.wx_path : '/' + link.wx_path)
    : (link.h5_short_link || '')
  return [
    unionRow({
      platform: '饿了么',
      platformCode: 'eleme',
      bizId: 'ele_hongbao_10144',
      brand: '饿了么红包',
      title: '饿了么红包 · 天天领',
      desc: data.description || '饿了么天天领红包 · 最高抢66元',
      claimUrl: wxPath,
      emoji: '🐝',
      bgColor: '#02a3ff',
      tag: '红包',
      category: 'all',
      weight: 118
    })
  ]
}

/**
 * 美团联盟（openapi.dianping.com）
 * 接口：waimai.qqjd.coupon.list（外卖券列表）→ POST /api/v1/waimai/qqjd/coupon/list
 * 签名：通用参数+业务参数按 key 升序 k=v&... 前后拼 secret，MD5 大写（TODO-VERIFY 联调）
 */
async function fetchFromMeituan() {
  const APP_KEY = process.env.MT_UNION_APP_KEY
  const SECRET = process.env.MT_UNION_SECRET
  if (!APP_KEY || !SECRET) return []
  const params = {
    app_id: APP_KEY,
    timestamp: Math.floor(Date.now() / 1000),
    v: 1,
    sign_method: 'MD5',
    // TODO-VERIFY: 业务参数（分页/类目）按官方文档补充
    page_size: 20,
    page: 1
  }
  const sorted = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&')
  params.sign = md5Upper(`${SECRET}${sorted}${SECRET}`)
  const json = await postJson('https://openapi.dianping.com/api/v1/waimai/qqjd/coupon/list', params)
  const list = json?.data?.list || json?.data?.data || []
  return list.map((item) => {
    const title = item.couponDesc || item.title || '美团外卖券'
    const parsed = parseCouponText(title)
    return unionRow({
      platform: '美团外卖',
      platformCode: 'meituan',
      bizId: item.couponId || item.id || `${Date.now()}_${Math.random()}`,
      brand: item.brandName || '美团外卖',
      title,
      desc: item.desc || '美团外卖 · 联盟推广',
      claimUrl: item.link || item.url || '',
      min: parsed ? parsed.min : null,
      tag: '联盟',
      category: 'all'
    })
  })
}

/**
 * 折淘客淘宝商品转链（高佣转链API）
 * 接口：open_gaoyongzhuanlian.ashx
 *   appkey/sid/pid 必填（折淘客三件套，与美团/饿了么共用）
 *   ⚠️ 2023-08 起淘宝联盟关闭纯数字商品ID转链，必须传 content（淘口令/商品链接）
 *      或字符型商品ID（淘宝联盟新版 item_id，非纯数字）
 *   环境变量优先级：TB_CONTENT（淘口令/链接）> TB_NUM_IID（字符型商品ID）
 *   signurl=5 返回整合结果（高佣转链+解析+详情+淘口令创建，自动拼 G/S 券）
 *   返回 content[0]：coupon_click_url（二合一推广链接）、tkl（淘口令）、
 *     title、coupon_info、pict_url、shop_title、tkrate3（佣金率）
 *   claim_url 用 coupon_click_url（https 链接，H5/微信端复制引导手淘打开追踪佣金）
 */
async function fetchFromTaobao() {
  const APPKEY = process.env.ZTK_APPKEY
  const SID = process.env.ZTK_SID
  const PID = process.env.ZTK_PID
  if (!APPKEY || !SID || !PID) return []
  // 优先用淘口令/商品链接（TB_CONTENT），其次用字符型商品ID（TB_NUM_IID）
  const CONTENT = process.env.TB_CONTENT || ''
  const NUM_IID = process.env.TB_NUM_IID || ''
  if (!CONTENT && !NUM_IID) {
    console.warn('[taobao] 未配置 TB_CONTENT（淘口令/链接）或 TB_NUM_IID，跳过')
    return []
  }
  const url = new URL('https://api.zhetaoke.com:10001/api/open_gaoyongzhuanlian.ashx')
  url.searchParams.set('appkey', APPKEY)
  url.searchParams.set('sid', SID)
  url.searchParams.set('pid', PID)
  if (CONTENT) url.searchParams.set('content', CONTENT)
  if (NUM_IID) url.searchParams.set('num_iid', NUM_IID)
  url.searchParams.set('signurl', '5')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  let json
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    json = await res.json()
  } finally {
    clearTimeout(timer)
  }
  if (json?.status !== 200 || !Array.isArray(json.content) || !json.content.length) {
    throw new Error(`taobao generateLink failed: ${JSON.stringify(json).slice(0, 500)}`)
  }
  const item = json.content[0]
  const parsed = parseCouponText(item.coupon_info || '')
  const title = parsed ? `满${parsed.min}减${parsed.amount}` : (item.title || '淘宝商品券')
  // bizId 用返回的商品ID（tao_id）兜底，避免无 num_iid 时 bizId 为 "tb_"
  const itemId = item.tao_id || NUM_IID || 'content'
  return [
    unionRow({
      platform: '淘宝闪购',
      platformCode: 'taobao',
      bizId: `tb_${itemId}`,
      brand: item.shop_title || item.nick || '淘宝商品',
      title,
      desc: item.jianjie || item.title || '淘宝商品 · 高佣推广',
      claimUrl: item.coupon_click_url || item.shorturl || item.tkl || '',
      min: parsed ? parsed.min : null,
      emoji: '🛒',
      bgColor: '#ff4400',
      tag: '高佣',
      category: 'all',
      weight: 110
    })
  ]
}

/**
 * 京东联盟（api.jd.com/routerjson）
 * 接口：jd.union.open.goods.coupon.query（券商品列表）
 * 签名：参数按 key 升序 k=v&... 前后拼 secret，MD5 大写；业务参数走 360buy_param_json（TODO-VERIFY 联调）
 */
async function fetchFromJd() {
  const APP_KEY = process.env.JD_UNION_APP_KEY
  const SECRET = process.env.JD_UNION_SECRET
  if (!APP_KEY || !SECRET) return []
  const body = JSON.stringify({
    goodsReqDTO: { pageIndex: 1, pageSize: 20 },
    // TODO-VERIFY: 可加 eliteId 品类池筛选外卖生鲜类目
    reqId: `${Date.now()}`
  })
  const params = {
    method: 'jd.union.open.goods.coupon.query',
    app_key: APP_KEY,
    timestamp: new Date().toISOString().slice(0, 19).replace('T', ' '),
    format: 'json',
    v: '1.0',
    sign_method: 'md5',
    '360buy_param_json': body
  }
  const sorted = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&')
  params.sign = md5Upper(`${SECRET}${sorted}${SECRET}`)
  const json = await postJson('https://api.jd.com/routerjson', params)
  const list =
    json?.jd_union_open_goods_coupon_query_responce?.queryResult?.data || []
  return list.map((item) => {
    const couponList = item.couponList || []
    const first = couponList[0] || {}
    const parsed = parseCouponText(first.title || first.couponInfo || '')
    const title = first.title || (parsed ? `满${parsed.min}减${parsed.amount}` : '京东外卖券')
    return unionRow({
      platform: '京东外卖',
      platformCode: 'jd',
      bizId: item.skuId || item.goodsId || `${Date.now()}_${Math.random()}`,
      brand: item.brandName || '京东外卖',
      title,
      desc: item.goodsName || '京东外卖 · 联盟推广',
      claimUrl: first.link || item.materialUrl || '',
      min: parsed ? parsed.min : null,
      tag: '联盟',
      category: 'all'
    })
  })
}

exports.main = async (event = {}) => {
  try {
    if (!API_KEY) throw new Error('未配置 CLOUDBASE_API_KEY 环境变量')

    const custom = Array.isArray(event.coupons) ? event.coupons.map(normalizeRow) : []

    // 联盟平台逐个拉取，单平台失败不影响其它平台与种子兜底
    const batches = []
    const safePull = async (name, fn) => {
      try {
        const rows = (await fn()).map(normalizeRow)
        if (rows.length) batches.push({ name, rows })
        return rows.length
      } catch (err) {
        console.error(`[syncCoupons][${name}] pull failed:`, err.message)
        return 0
      }
    }
    const [ztk, mt, tb, jd] = await Promise.all([
      safePull('ztk', fetchFromZtk),
      // safePull('eleme_ztk', fetchFromElemeZtk),  // 饿了么板块暂时停用
      safePull('meituan', fetchFromMeituan),
      safePull('taobao', fetchFromTaobao),
      safePull('jd', fetchFromJd)
    ])

    const customCount = custom.length ? await upsert(custom) : 0
    const batchCounts = {}
    for (const b of batches) {
      batchCounts[b.name] = await upsert(b.rows)
    }

    // 全部来源为空 → 种子兜底（保证券池不为空）
    let seeded = 0
    if (event.seed !== false && custom.length === 0 && batches.length === 0) {
      seeded = await upsert(DEFAULT_SEED)
    }

    return {
      success: true,
      message: '同步完成',
      data: {
        seeded,
        custom: customCount,
        union: { ztk, meituan: mt, taobao: tb, jd, upserted: batchCounts }
      }
    }
  } catch (err) {
    console.error('[syncCoupons] error:', err)
    return { success: false, message: err.message || '同步失败', data: null }
  }
}
