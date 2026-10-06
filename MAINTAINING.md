# 项目维护指南

本文档面向「省吃 · 外卖领券聚合」项目的维护者，覆盖日常维护、发布、密钥轮换与故障排查。

## 项目快照

- 技术栈：Taro 4 + React + TypeScript，三端产物（微信小程序 + H5 + Android App，App 由 Capacitor 打包 H5）
- 后端：腾讯云 CloudBase（云函数 Nodejs18.15 + PostgreSQL，PostgREST 访问）
- 仓库：https://github.com/ZERODIGREE0206/shengchi
- 本地工作区：`d:\省吃dome\waimai-coupon`（含中文路径）
- 微信开发者工具镜像目录：`d:\waimai-dev`（纯 ASCII，必须从这里导入）

## 日常开发

```powershell
# H5 开发（端口 10086）
npm run dev:h5

# 微信小程序产物编译（先杀掉残留 watch 进程，避免 dist 写冲突）
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'build:h5' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Remove-Item "dist" -Recurse -Force -ErrorAction SilentlyContinue
npm run build:weapp
# 同步到镜像目录
Copy-Item "d:\省吃dome\waimai-coupon\dist\*" "d:\waimai-dev\dist\" -Recurse -Force
```

规则：
- 环境变量一律走 `.env` 的 `TARO_APP_*` 前缀，代码中用 `process.env.TARO_APP_XXX` 读取，禁止硬编码密钥
- 新增页面路由后必须重启 `dev:h5`（Taro 启动时固化 pages 列表）
- H5 产物输出到 `dist-h5/`（Capacitor App 的 webDir），微信产物输出到 `dist/`，两端已隔离；但 H5 与微信编译仍不要同时跑（webpack 争资源）
- 同一文件的多个编辑要顺序提交，禁止并行（会互相覆盖）

## Android App（Capacitor 打包 H5）

- 配置：`capacitor.config.ts`（appId `com.waimai.coupon`，webDir `dist-h5`）
- 日常构建：`npm run build:app`（= build:h5 + cap sync android）→ `cd android && ./gradlew assembleDebug`
- 环境要求：JDK 21（`C:\Program Files\Microsoft\jdk-21*`，Capacitor 8 强制要求）+ Android SDK（`D:\Android\Sdk`，platforms;android-36 + build-tools）
- 中文路径已配置 `android.overridePathCheck=true`（android/gradle.properties）；Gradle 发行版走华为云镜像（android/gradle/wrapper/gradle-wrapper.properties），依赖走阿里云镜像（android/build.gradle）
- `android/` 与 `dist-h5/` 均已 gitignore，不提交；重建原生工程用 `npx cap add android`
- App 专属适配集中在 `src/services/native.ts`（`isNativeApp()` 判定）：
  - 外链：`@capacitor/browser` Custom Tab（platformJump.ts 的 window.open 已全部改走 `openExternalUrl`）
  - 定位：`@capacitor/geolocation` 原生 GPS，返回 WGS84，location.ts 内置 `wgs84ToGcj02` 转换（腾讯系接口必须 GCJ02）
  - 定位权限（ACCESS_FINE/COARSE_LOCATION）在 `android/app/src/main/AndroidManifest.xml` 手动声明，`cap add android` 重建后需补回
- App 内无 `navigateToMiniProgram`：美团/饿了么领券点单走 H5 页面（Custom Tab），淘宝/京东口令流程天然兼容（复制后用户打开对应 APP 自动识别）

## 密钥与安全管理

| 密钥 | 存放位置 | 说明 |
|------|----------|------|
| CloudBase 环境 ID / Publishable Key | 本地 `.env`（gitignored） | Publishable Key 设计上可前端暴露，dist 内含它属预期 |
| 微信小程序真实 appid | `project.private.config.json`（gitignored） | `project.config.json` 用 `touristappid` 占位 |
| 腾讯地图 Key/SK | **仅存** nearbyStores 云函数环境变量 | 代码、文档、git 历史中均不得出现 |
| ZTK 等第三方聚合 API 凭证 | syncCoupons 云函数环境变量 | 同上 |

**密钥泄露处置流程**：立即在对应平台控制台轮换 → 更新云函数环境变量 → 验证 → 旧密钥停用。参考 2026-10-06 腾讯地图 Key 重置案例（注意 lbs.qq.com 的 Key 停用满 7 天才能彻底删除）。

含密钥的本地临时脚本统一命名 `_*.cjs` / `_*.js` / `_*.mjs`（已被 .gitignore 排除），用完即删。

## 数据库（PostgreSQL）

- 写操作：MCP `managePgDatabase`（action=execute, confirm=true），DML 无需 migration
- 查询：`queryPgDatabase`（action=sql）
- INSERT 一律带 `ON CONFLICT (coupon_id) DO NOTHING` 保证可重入
- `desc` 是保留字，用 `description` 作列名
- 领券走 `claim_coupon` RPC（SECURITY DEFINER），依赖 `(coupon_id, openid)` 唯一索引防重复领取
- coupons 表已启用 RLS，只允许读 active 券
- 券排序：`weight` 降序 → `created_at` 降序

## 云函数运维

| 函数 | 用途 | 关键环境变量 |
|------|------|--------------|
| syncCoupons | 券源同步（ZTK → 直连 → seed 兜底） | 第三方 API 凭证、CLOUDBASE_API_KEY |
| nearbyStores | 腾讯 POI 周边门店搜索代理 | TENCENT_MAP_KEY、TENCENT_MAP_SK |
| claimCoupon | 原子领券 | 数据库访问凭证 |
| aiAdvisor | AI 美食顾问 | 模型 API 凭证 |

注意：
- nearbyStores 必须是**事件函数**（Web 函数会报 scf_bootstrap 入口错误）
- 环境变量必须**手动键入**，粘贴易带入不可见字符导致腾讯 API 311 错误（函数内有 cleanEnv 清洗兜底）
- 控制台改完代码必须点蓝色「部署」按钮，Ctrl+S 只存编辑器草稿
- 重新部署代码后环境变量可能被重置，部署完要复查
- 控制台显示「保存成功」不代表生效，必须用测试调用验证

## 发布前验证清单

微信小程序端（改完代码必做）：
1. 杀残留 `build:h5 --watch` 进程 → `build:weapp` → 同步 `d:\waimai-dev\dist\`
2. 微信开发者工具点「编译」无报错 → 「预览」扫码真机验证
3. 真机重点：美团 H5 容器跳转（仅真机可测）、定位链路、领券跳转

H5 端：
1. `Invoke-WebRequest http://localhost:10086` 探活，不通则重启 `dev:h5`（等约 18s 编译）
2. 浏览器实测核心页面（领券中心、周边门店、门店详情）

真机硬性要求：
- `app.json` 的 `navigateToMiniProgramAppIdList` 必须声明目标小程序 appId
- 微信后台 request 合法域名须含 `https://<env-id>.api.tcloudbasegateway.com`
- tabBar 图标只用 png/jpg/jpeg（不支持 SVG）；CSS 背景图用 SVG 或 PNG base64（不用 WebP）

## 已知限制与待办

- 腾讯地图旧 Key `shengchi`（O2WBZ- 前缀）已停用，**2026-10-13 之后**到 lbs.qq.com 控制台 → 应用管理执行「彻底删除」
- 桌面端 H5 定位走 IP/WiFi（8s 超时降级）属预期；微信小程序用 GPS（15s 超时）
- `startLocationUpdate` 在室内/位置不变时可能 10s 无回调，定位失败一级降级属已知行为

## 提交规范

- 提交信息：`feat: / fix: / docs: / refactor:` 前缀 + 中文简述，聚焦「为什么」而非「做了什么」
- 不提交：`.env*`、`project.private.config.json`、`dist/`、`node_modules/`、`_*.cjs/_*.js/_*.mjs/_*.json` 临时脚本
