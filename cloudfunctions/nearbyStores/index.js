/**
 * nearbyStores：周边真实门店搜索（腾讯位置服务 place/v1/search 代理）
 *
 * 入参：
 *   lat      纬度（gcj02）
 *   lng      经度（gcj02）
 *   keyword  可选，搜索关键词，默认「美食」
 *   radius   可选，搜索半径（米），默认 3000
 *   pageIndex 可选，页码，默认 1
 *
 * 出参：{ status, count, data: [...] }（透传腾讯返回，data 为 POI 数组）
 * Key/SK 仅存云函数环境变量，前端不持有
 */
const crypto = require('crypto')

/** 清洗环境变量值：去首尾空白/换行/引号（控制台粘贴易混入） */
function cleanEnv(v) {
  return String(v || '').trim().replace(/^['"]+|['"]+$/g, '').trim()
}

const KEY = cleanEnv(process.env.TENCENT_MAP_KEY)
const SK = cleanEnv(process.env.TENCENT_MAP_SK)

/** 腾讯 WebServiceAPI 签名（GET）：参数名升序 + 未编码原始值 + 路径?串+SK 的 md5 */
function buildSignedUrl(path, params) {
  const keys = Object.keys(params).sort()
  const queryStr = keys.map((k) => `${k}=${params[k]}`).join('&')
  const sig = crypto.createHash('md5').update(`${path}?${queryStr}${SK}`).digest('hex')
  const encoded = keys.map((k) => `${k}=${encodeURIComponent(params[k])}`).join('&')
  return `https://apis.map.qq.com${path}?${encoded}&sig=${sig}`
}

exports.main = async (event = {}) => {
  try {
    if (!KEY || !SK) {
      return { status: -1, message: '未配置 TENCENT_MAP_KEY / TENCENT_MAP_SK 环境变量', data: [] }
    }

    const lat = Number(event.lat)
    const lng = Number(event.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return { status: -1, message: '缺少有效 lat/lng 参数', data: [] }
    }

    const keyword = String(event.keyword || '美食')
    const radius = Math.min(Math.max(Number(event.radius) || 3000, 500), 5000)
    const pageIndex = Math.max(Number(event.pageIndex) || 1, 1)

    const params = {
      keyword,
      boundary: `nearby(${lat},${lng},${radius},1)`,
      page_size: '20',
      page_index: String(pageIndex),
      orderby: '_distance',
      key: KEY
    }

    const url = buildSignedUrl('/ws/place/v1/search', params)
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    const json = await res.json()

    if (json.status !== 0) {
      console.warn('[nearbyStores] 腾讯接口错误:', json.status, json.message)
      // 附带 Key 长度诊断（不泄露完整值），便于排查环境变量粘贴问题
      return {
        status: json.status,
        message: `${json.message}（key长度=${KEY.length}，应为35；key前缀=${KEY.slice(0, 5)}）`,
        data: []
      }
    }

    return {
      status: 0,
      count: json.count || 0,
      data: json.data || []
    }
  } catch (err) {
    console.error('[nearbyStores] error:', err)
    return { status: -1, message: err.message || '请求失败', data: [] }
  }
}