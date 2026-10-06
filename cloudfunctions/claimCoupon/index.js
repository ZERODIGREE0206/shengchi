/**
 * claimCoupon：领券（CloudBase PostgreSQL HTTP API 版）
 *
 * 防重复：user_claims 表 (coupon_id, openid) 唯一索引，重复插入返回 409 → 提示已领取
 * 扣库存：乐观锁（读取 remaining_count 后带条件扣减，失败重试最多 3 次）
 *
 * 入参：{ couponId, openid }  // openid 为调用方用户标识（小程序端传登录态 uid）
 * 出参：{ success, code, message, data }
 *   code: OK / PARAM_MISSING / NOT_FOUND / NOT_ACTIVE / SOLD_OUT / DUPLICATE / SERVER_ERROR
 */
const ENV_ID = process.env.CLOUDBASE_ENV_ID || 'shengchi-d3g1ayd7kf9c0a013'
const API_KEY = process.env.CLOUDBASE_API_KEY || ''
const BASE = `https://${ENV_ID}.api.tcloudbasegateway.com/v1/rdb/rest`

function ok(data, code = 'OK', message = '领取成功') {
  return { success: true, code, message, data }
}
function fail(code, message) {
  return { success: false, code, message, data: null }
}

async function pgFetch(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {})
    }
  })
  const text = await res.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch (e) { body = text }
  return { status: res.status, ok: res.ok, body }
}

exports.main = async (event = {}) => {
  try {
    if (!API_KEY) throw new Error('未配置 CLOUDBASE_API_KEY 环境变量')

    const { couponId, openid } = event
    if (!couponId || !openid) return fail('PARAM_MISSING', '缺少 couponId 或 openid')

    // 1. 查询券状态与库存
    const q = await pgFetch(
      `/coupons?coupon_id=eq.${encodeURIComponent(couponId)}&select=id,remaining_count,status`
    )
    const coupon = Array.isArray(q.body) ? q.body[0] : null
    if (!coupon) return fail('NOT_FOUND', '优惠券不存在或已下架')
    if (coupon.status !== 'active') return fail('NOT_ACTIVE', '该券暂不可领取')
    if (coupon.remaining_count <= 0) return fail('SOLD_OUT', '今日名额已抢完，明天再来吧')

    // 2. 写领取记录：唯一索引 (coupon_id, openid) 原子防重
    const ins = await pgFetch('/user_claims', {
      method: 'POST',
      body: JSON.stringify({ coupon_id: couponId, openid }),
      headers: { Prefer: 'return=minimal' }
    })
    if (ins.status === 409) return fail('DUPLICATE', '已领取过该券')
    if (!ins.ok) throw new Error(`insert claim ${ins.status}: ${JSON.stringify(ins.body)}`)

    // 3. 扣减库存（乐观锁：带 remaining_count=eq.<读取值> 条件，失败重试）
    let remaining = coupon.remaining_count
    for (let i = 0; i < 3; i++) {
      const patch = await pgFetch(
        `/coupons?coupon_id=eq.${encodeURIComponent(couponId)}&remaining_count=eq.${remaining}&status=eq.active`,
        {
          method: 'PATCH',
          body: JSON.stringify({ remaining_count: remaining - 1, updated_at: new Date().toISOString() }),
          headers: { Prefer: 'return=representation' }
        }
      )
      if (patch.ok && Array.isArray(patch.body) && patch.body.length === 1) {
        return ok({ remainingCount: patch.body[0].remaining_count })
      }
      // 条件未命中（并发扣减）→ 重新读取后再试
      const r = await pgFetch(
        `/coupons?coupon_id=eq.${encodeURIComponent(couponId)}&select=remaining_count`
      )
      remaining = Array.isArray(r.body) && r.body[0] ? r.body[0].remaining_count : -1
      if (remaining <= 0) {
        // 领取记录已写入但库存耗尽：极端并发下的兜底，保留记录并如实返回
        return ok({ remainingCount: 0 }, 'OK', '领取成功（名额已被抢完，请尽快使用）')
      }
    }
    return ok({ remainingCount: remaining })
  } catch (err) {
    console.error('[claimCoupon] error:', err)
    return fail('SERVER_ERROR', err.message || '领取失败，请稍后再试')
  }
}
