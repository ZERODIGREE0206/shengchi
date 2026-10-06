/**
 * getCoupons：券池查询（CloudBase PostgreSQL HTTP API 版）
 *
 * 入参：
 *   platform  可选，平台筛选 meituan/eleme/taobao
 *   category  可选，品类筛选 burger/coffee/tea/hotpot/all
 *   keyword   可选，关键词（标题/描述/品牌模糊匹配）
 *   page      可选，页码，默认 1
 *   pageSize  可选，每页条数，默认 20
 *
 * 出参：{ success, data: { list: Coupon[], total, page, pageSize } }
 */
const ENV_ID = process.env.CLOUDBASE_ENV_ID || 'shengchi-d3g1ayd7kf9c0a013'
const API_KEY = process.env.CLOUDBASE_API_KEY || ''
const BASE = `https://${ENV_ID}.api.tcloudbasegateway.com/v1/rdb/rest`

/** PG 行（snake_case）→ 前端 Coupon 结构（camelCase） */
function mapCoupon(r) {
  return {
    id: r.coupon_id,
    brand: r.brand,
    emoji: r.emoji || '🍽️',
    bgColor: r.bg_color || '#fde8e8',
    brandLogo: r.brand_logo || '',
    category: r.category,
    title: r.title,
    desc: r.description || '',
    platform: r.platform || '',
    platformCode: r.platform_code,
    tag: r.tag || '',
    stock: r.remaining_count,
    weight: r.weight
  }
}

async function pgFetch(path, extraHeaders = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: 'application/json',
      ...extraHeaders
    }
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`PG ${res.status}: ${text}`)
  return { rows: text ? JSON.parse(text) : [], contentRange: res.headers.get('content-range') || '' }
}

exports.main = async (event = {}) => {
  try {
    if (!API_KEY) throw new Error('未配置 CLOUDBASE_API_KEY 环境变量')

    const { platform = '', category = '', keyword = '', page = 1, pageSize = 20 } = event
    const params = new URLSearchParams()
    params.set('select', '*')
    params.set('status', 'eq.active')
    if (platform) params.set('platform_code', `eq.${platform}`)
    if (category && category !== 'all') params.set('category', `eq.${category}`)
    if (keyword) {
      const kw = String(keyword).replace(/[(),*]/g, '')
      params.set('or', `(title.ilike.*${kw}*,description.ilike.*${kw}*,brand.ilike.*${kw}*)`)
    }
    params.set('order', 'weight.desc,created_at.desc')
    params.set('limit', String(pageSize))
    params.set('offset', String((page - 1) * pageSize))

    // Prefer: count=exact 让响应头 Content-Range 携带总数（如 0-12/13）
    const { rows, contentRange } = await pgFetch(`/coupons?${params}`, { Prefer: 'count=exact' })
    let total = rows.length
    const m = contentRange.match(/\/(\d+)$/)
    if (m) total = Number(m[1])

    return {
      success: true,
      data: { list: rows.map(mapCoupon), total, page, pageSize }
    }
  } catch (err) {
    console.error('[getCoupons] error:', err)
    return { success: false, message: err.message || '查询失败', data: { list: [], total: 0 } }
  }
}
