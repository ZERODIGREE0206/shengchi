/**
 * aiAdvisor：省吃小助手 · AI 点餐顾问
 *
 * 入参（前端 JSON body / event）：
 *   {
 *     messages: [{ role: 'user' | 'assistant', content: string }],  // 对话历史（最近若干轮）
 *     stores:   [...附近门店快照],   // 可选，平台随机门店数据
 *     coupons:  [...券快照]          // 可选，可领的券
 *     address?: string               // 可选，定位地址
 *   }
 *
 * 出参：
 *   { success: true, reply: string, picks: [{ platformCode, storeName, reason, estPrice }] }
 *
 * 大模型：DeepSeek（OpenAI 兼容 /chat/completions）。Key 仅从环境变量 DEEPSEEK_API_KEY 读取。
 */

const API_KEY = process.env.DEEPSEEK_API_KEY || process.env.LLM_API_KEY || '';
// 默认 DeepSeek；切换智谱/硅基流动等 OpenAI 兼容厂商时只需改环境变量
const BASE_URL = process.env.LLM_BASE_URL || 'https://api.deepseek.com';
const MODEL = process.env.DEEPSEEK_MODEL || process.env.LLM_MODEL || 'deepseek-chat';
// 个别免费模型不支持 response_format，可用 LLM_JSON_MODE=0 关闭（仍有 JSON 提取兜底）
const JSON_MODE = process.env.LLM_JSON_MODE !== '0';
const TIMEOUT_MS = 25000;
/** 支持的外卖平台编码（与前端 PlatformCode 保持一致） */
const VALID_PLATFORMS = ['meituan', 'eleme', 'taobao', 'jd'];
const isValidPlatform = (code) => VALID_PLATFORMS.includes(code);

function ok(payload) {
  return { success: true, ...payload };
}
function fail(code, message) {
  return { success: false, code, message, reply: '', picks: [] };
}

/** 从大模型文本中提取最后一个 JSON 对象（兼容 ```json 包裹） */
function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  const slice = raw.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch (e) {
    // 容忍尾部逗号 / 轻微噪声
    try {
      return JSON.parse(slice.replace(/,\s*([}\]])/g, '$1'));
    } catch (e2) {
      console.warn('[aiAdvisor] JSON parse failed:', slice.slice(0, 200));
      return null;
    }
  }
}

function buildSystemPrompt(stores, coupons, address) {
  const storeLines = (stores || []).slice(0, 12).map((s, i) => {
    const price = s.estPrice != null ? s.estPrice : '';
    return `${i + 1}. [${s.platformCode || ''}] ${s.name}｜品类:${s.category || ''}｜评分${s.rating || '-'}｜月售${s.monthlySales || '-'}｜配送费¥${s.deliveryFee != null ? s.deliveryFee : '-'}｜起送¥${s.minOrder != null ? s.minOrder : '-'}｜距离${s.distanceKm != null ? s.distanceKm + 'km' : '-'}${price ? `｜预估人均¥${price}` : ''}`;
  });
  const couponLines = (coupons || []).slice(0, 12).map((c) =>
    `- [${c.platformCode || ''}] ${c.title}（${c.brand || ''}）${c.desc || ''}`
  );

  return [
    '你是「省吃小助手」的 AI 点餐顾问，目标是帮用户在美团/饿了么/淘宝闪购/京东外卖四个平台里，用最少的钱点到满意的一餐。',
    address ? `用户当前位置参考：${address}。` : '',
    '工作要求：',
    '1. 结合用户说的人数、预算、口味偏好、忌口、场景（工作餐/夜宵/聚餐），从候选门店中挑店；',
    '2. 优先考虑：距离近、评分高、配送费/起送价低、有可用券、人均贴合预算；',
    '3. 回复口语化、像朋友建议，分点简短说明，正文不超过 120 字；',
    '4. picks 必须从「候选门店」中挑选，最多 3 家，按推荐度排序；estPrice 为预估人均整数元；',
    '5. 若候选门店为空或都不合适，picks 返回空数组，正文直接给点餐思路。',
    '输出必须且只能是一个 JSON 对象，格式：',
    '{"reply":"给用户看的简短建议","picks":[{"platformCode":"meituan|eleme|taobao|jd","storeName":"必须与候选门店名称完全一致","reason":"一句话理由","estPrice":25}]}',
    '不要输出 JSON 以外的任何文字。',
    storeLines.length ? `候选门店：\n${storeLines.join('\n')}` : '本次没有候选门店数据。',
    couponLines.length ? `当前可领的券：\n${couponLines.join('\n')}` : ''
  ].filter(Boolean).join('\n');
}

exports.main = async (event = {}) => {
  try {
    if (!API_KEY) return fail('NO_KEY', 'AI 服务未配置 DEEPSEEK_API_KEY');

    const messages = Array.isArray(event.messages) ? event.messages : [];
    const recent = messages.slice(-10).filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string');
    if (!recent.length) return fail('PARAM_MISSING', '还没有对话内容');
    if (recent[recent.length - 1].role !== 'user') {
      return fail('PARAM_MISSING', '最后一条消息需来自用户');
    }

    const system = buildSystemPrompt(event.stores, event.coupons, event.address);
    const payload = {
      model: MODEL,
      messages: [{ role: 'system', content: system }, ...recent],
      temperature: 0.6,
      max_tokens: 1500,
      stream: false
    };
    if (JSON_MODE) payload.response_format = { type: 'json_object' };

    const res = await fetch(`${BASE_URL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });

    const text = await res.text();
    if (!res.ok) {
      console.error('[aiAdvisor] upstream error:', res.status, text.slice(0, 300));
      return fail('UPSTREAM_ERROR', `AI 服务暂时不可用（${res.status}）`);
    }

    let data;
    try { data = JSON.parse(text); } catch (e) { return fail('BAD_RESPONSE', 'AI 返回解析失败'); }
    const content = data?.choices?.[0]?.message?.content || '';
    const parsed = extractJson(content);

    const candidateStores = Array.isArray(event.stores) ? event.stores : [];
    let reply;
    if (parsed && typeof parsed.reply === 'string') {
      reply = parsed.reply.slice(0, 300);
    } else {
      const raw = String(content).trim();
      // 小模型偶发吐出 JSON 残片/数组：不直接展示原始符号，给友好提示
      reply = (raw.startsWith('[') || raw.startsWith('{'))
        ? '我这边没太想好，换个说法再问我一次吧～'
        : raw.slice(0, 300) || '我这边没太想好，换个说法试试？';
    }

    const picks = normalizePicks(parsed && Array.isArray(parsed.picks) ? parsed.picks : [], candidateStores);
    // 小模型偶发不按结构给 picks：从回复正文里匹配候选门店兜底
    if (picks.length === 0) {
      picks.push(...pickStoresFromText(reply, candidateStores));
    }

    return ok({ reply, picks });
  } catch (err) {
    console.error('[aiAdvisor] error:', err);
    return fail('SERVER_ERROR', err.name === 'AbortError' ? 'AI 请求超时，请重试' : '点餐顾问开小差了，请重试');
  }
};

/** 在候选门店中对齐模型给的店名：完全一致 → 双向包含 → 品牌主体（· 之前）匹配 */
function matchStore(rawName, stores) {
  if (!rawName) return null;
  const q = String(rawName).trim();
  const brandOf = (n) => String(n).split('·')[0].trim();
  return (
    stores.find((s) => s.name === q) ||
    stores.find((s) => s.name.indexOf(q) >= 0 || q.indexOf(s.name) >= 0) ||
    stores.find((s) => {
      const b = brandOf(s.name);
      const qb = brandOf(q);
      return (b && b.length >= 2 && (q.indexOf(b) >= 0 || b.indexOf(qb) >= 0));
    }) ||
    null
  );
}

/** 规范化模型返回的 picks：对齐候选全名、丢弃幻觉门店、去重，最多 3 家 */
function normalizePicks(rawPicks, stores) {
  const picks = [];
  const used = new Set();
  rawPicks.forEach((p) => {
    if (!p || typeof p.storeName !== 'string' || picks.length >= 3) return;
    const matched = matchStore(p.storeName, stores);
    if (!matched || used.has(matched.name)) return;
    used.add(matched.name);
    const code = isValidPlatform(matched.platformCode)
      ? matched.platformCode
      : (isValidPlatform(p.platformCode) ? p.platformCode : 'meituan');
    picks.push({
      platformCode: code,
      storeName: matched.name,
      reason: typeof p.reason === 'string' ? p.reason.slice(0, 40) : '',
      estPrice: Number.isFinite(+p.estPrice) ? Math.max(0, Math.round(+p.estPrice)) : null
    });
  });
  return picks;
}

/** 模型只把推荐写进正文时，扫描回复文本命中候选门店品牌名，补出 picks */
function pickStoresFromText(reply, stores) {
  const picks = [];
  const used = new Set();
  stores.slice(0, 12).forEach((s) => {
    if (picks.length >= 3) return;
    const brand = String(s.name).split('·')[0].trim();
    const hit = (brand && brand.length >= 2 && reply.indexOf(brand) >= 0) || reply.indexOf(s.name) >= 0;
    if (!hit || used.has(s.name)) return;
    used.add(s.name);
    picks.push({
      platformCode: isValidPlatform(s.platformCode) ? s.platformCode : 'meituan',
      storeName: s.name,
      reason: '',
      estPrice: null
    });
  });
  return picks;
}
