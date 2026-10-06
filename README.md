# 省吃 waimai-coupon

一款「外卖领券 + 附近真实门店」聚合工具，基于 **Taro 4 + React + TypeScript**，一套代码同时构建 **H5** 与 **微信小程序** 双端。

> 接入美团 / 饿了么 / 淘宝闪购 / 京东四大平台领券入口，附近门店数据来自腾讯位置服务真实 POI，杜绝「模拟门店 + 伪造菜单」；连锁品牌展示全国统一的标准菜单，非连锁小店明确引导去平台查看真实菜单。

## 功能特性

- **附近真实门店**：云函数调用腾讯地图 WebService「地点搜索」API，按真实距离排序，支持关键词/品类筛选
- **四平台券聚合**：一键领取各平台外卖券，防重复领取由数据库唯一索引 + RPC 原子扣减保证
- **诚实的菜单展示**：29 家连锁品牌使用品牌标准菜单做券后价对比；非连锁门店不展示模拟菜品，引导领券后去平台看真实菜单
- **跨端下单跳转**：美团小程序 H5 容器直开品牌门店列表、淘系口令复制、平台内搜索引导，多策略兜底
- **AI 点餐顾问**：云函数代理调用大模型，前端不接触任何 API Key

## 技术栈与架构

```
┌────────────────────────────┐
│  Taro 4 + React + TS       │  一套代码
│  ├─ H5（Vite）             │
│  └─ 微信小程序（weapp）     │
└─────────┬──────────────────┘
          │  Taro.request / @cloudbase/js-sdk（匿名会话）
          ▼
┌────────────────────────────┐     ┌──────────────────────────┐
│  腾讯云 CloudBase           │     │  云函数（Node 18）        │
│  ├─ HTTP 访问服务（网关）    │────▶│  nearbyStores  腾讯POI    │
│  ├─ PostgreSQL + RLS       │     │  syncCoupons   券源同步   │
│  │   └─ PostgREST 语法     │◀────│  claimCoupon   原子领券   │
│  └─ 匿名登录（Publishable   │     │  getCoupons    券列表     │
│      Key 仅代表匿名身份）   │     │  aiAdvisor    AI 顾问    │
└────────────────────────────┘     └──────────────────────────┘
```

- 数据全部存于 **PostgreSQL**，云函数通过 PostgREST 语法读写
- `coupons` 表启用 **RLS**：匿名身份仅可读「生效中」的券；领券走 `claim_coupon` RPC（SECURITY DEFINER）做身份校验 + 唯一约束 + 库存扣减的原子操作
- 前端通过环境变量注入环境 ID 与 Publishable Key，**代码仓库不含任何密钥**

## 目录结构

```
waimai-coupon/
├── src/                  # Taro 源码（pages / services / data / components）
├── cloudfunctions/       # 云函数
│   ├── nearbyStores/     #   腾讯地图 POI 搜索（需 TENCENT_MAP_KEY/SK）
│   ├── syncCoupons/      #   券源同步（聚合 API → 直连 → 种子数据三级回退）
│   ├── claimCoupon/      #   领券
│   ├── getCoupons/       #   券列表
│   └── aiAdvisor/        #   AI 点餐顾问
├── .env.example          # 前端环境变量模板
└── project.config.json   # 微信小程序配置（appid 为占位符）
```

## 快速开始（H5）

```bash
# 前置：Node 16+，Taro CLI（npm i -g @tarojs/cli）
npm install

# 1. 配置环境变量
cp .env.example .env
#    填入你的 CloudBase 环境 ID 与匿名登录 Publishable Key

# 2. 启动 H5 开发服务（端口 10086）
npm run dev:h5
```

## 微信小程序

```bash
npm run build:weapp
```

1. 微信开发者工具导入项目根目录（`miniprogramRoot` 已指向 `dist/`）
   - 提示：项目路径含中文/特殊字符时，建议使用纯 ASCII 路径的镜像目录
2. `appid` 请填写你自己的（或使用游客模式）；个人配置可放 `project.private.config.json`（已 gitignore）
3. 在小程序后台配置 **request 合法域名**：`https://<你的环境ID>.api.tcloudbasegateway.com`
4. 跳转外部小程序需在 `app.config.ts` 的 `navigateToMiniProgramAppIdList` 中声明目标 appId（美团/饿了么/淘宝闪购/京东官方小程序）

## 部署指南（CloudBase）

1. **开通环境**：[CloudBase 控制台](https://console.cloud.tencent.com/tcb) 创建环境（需开启 HTTP 访问服务），创建 **MySQL 版/框架版的 PostgreSQL** 数据库实例
2. **初始化数据表**：创建 `coupons` 表（以 `coupon_id` 为主键/冲突键），启用 RLS 并添加「仅匿名可读生效券」策略；创建 `claim_coupon` RPC（SECURITY DEFINER）实现原子领券
3. **部署云函数**：将 `cloudfunctions/` 下各函数部署为**事件函数**（Nodejs 18.15），并为 `nearbyStores` 等配置匿名调用权限（`{"*":{"invoke":true}}`）
4. **配置云函数环境变量**（在 CloudBase 控制台注入，切勿写入代码）：

| 云函数 | 环境变量 | 用途 |
|---|---|---|
| nearbyStores | `TENCENT_MAP_KEY` / `TENCENT_MAP_SK` | 腾讯位置服务 Key 与签名密钥（[申请](https://lbs.qq.com/dev/console/application/mine)） |
| syncCoupons | `CLOUDBASE_API_KEY` | 通过 PostgREST 写库的服务端 Key |
| aiAdvisor | 按所选大模型服务商配置对应 Key | LLM API Key |

5. **小程序端**：`Taro.cloud.init` 使用的环境 ID 即 `.env` 中的 `TARO_APP_CLOUDBASE_ENV`

> 注意：控制台编辑云函数代码后务必点击「部署」；重新部署代码后检查环境变量是否被重置。

## 环境变量汇总

| 变量 | 位置 | 说明 |
|---|---|---|
| `TARO_APP_CLOUDBASE_ENV` | 前端 `.env` | CloudBase 环境 ID |
| `TARO_APP_TCB_ACCESS_KEY` | 前端 `.env` | 匿名登录 Publishable Key（设计上可暴露，仅代表匿名身份） |
| `TENCENT_MAP_KEY` / `TENCENT_MAP_SK` | nearbyStores 函数 | 腾讯位置服务凭证 |
| `CLOUDBASE_API_KEY` | syncCoupons 函数 | 服务端写库 Key |

## 免责声明

- 本项目仅供学习与技术研究，请勿用于任何违反平台规则或当地法律法规的用途
- 领券/下单跳转依赖美团、饿了么、淘宝闪购、京东官方平台，相关商标与内容归各自所有者所有
- CPS 佣金、优惠券的获取与分发需自行确保符合各联盟平台（如美团联盟、淘宝联盟）的合规要求
- 菜单与价格为演示用估算数据，实际以各平台门店页为准

## License

[MIT](./LICENSE)
