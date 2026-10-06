/**
 * 联盟凭证配置（敏感信息，勿提交到公开仓库）
 *
 * 填写方式二选一：
 * 【方式一（推荐）】云开发控制台 → 云函数 → syncCoupons → 配置 → 环境变量
 *   MEITUAN_APP_KEY / MEITUAN_SECRET / MEITUAN_SID
 *   TAOBAO_APP_KEY / TAOBAO_SECRET / TAOBAO_ADZONE_ID
 *   环境变量优先于下方本文件，改完无需重新部署代码
 * 【方式二】直接填到下方空字符串并重新部署
 *
 * 凭证获取路径：
 *   美团联盟 https://union.meituan.com
 *     推广者备案 → 媒体管理 获得 APP_KEY
 *     我要推广 → 联盟API接口 开通后获得 SECRET
 *   淘宝联盟（饿了么）https://pub.alimama.com
 *     媒体备案 → APPKEY申请 → 创建应用获得 APP_KEY + SECRET
 *     推广位 PID（mm_x_x_x）第三段数字即 ADZONE_ID
 */
module.exports = {
  MEITUAN: {
    APP_KEY: process.env.MEITUAN_APP_KEY || '',
    SECRET: process.env.MEITUAN_SECRET || '',
    SID: process.env.MEITUAN_SID || ''
  },
  TAOBAO: {
    APP_KEY: process.env.TAOBAO_APP_KEY || '',
    SECRET: process.env.TAOBAO_SECRET || '',
    ADZONE_ID: process.env.TAOBAO_ADZONE_ID || ''
  }
}
