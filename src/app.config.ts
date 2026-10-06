export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/coupons/index',
    'pages/nearby/index',
    'pages/mine/index',
    'pages/login/index',
    'pages/category/index',
    'pages/meituan/index',
    'pages/eleme/index',
    'pages/taobao/index',
    'pages/store-detail/index'
  ],
  // 组件按需注入（微信代码质量检测项；只注入当前页面用到的组件，减少启动耗时）
  lazyCodeLoading: 'requiredComponents',
  // 微信端定位权限（点外卖页：按我的位置展示附近门店）
  permission: {
    'scope.userLocation': {
      desc: '用于按您的位置展示附近的外卖门店'
    }
  },
  requiredPrivateInfos: ['getLocation', 'startLocationUpdate', 'onLocationChange'],
  // 可跳转的外部小程序白名单（微信强制要求，未声明的 appId 无法 navigateToMiniProgram）
  navigateToMiniProgramAppIdList: [
    'wxde8ac0a21135c07d', // 美团外卖
    'wxece3a9a4c82f58c9', // 饿了么 / 淘宝闪购（同主体）
    'wx91d27dbf599dff74'  // 京东购物（含京东外卖入口）
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ff6b2c',
    navigationBarTitleText: '省吃小助手',
    navigationBarTextStyle: 'white',
    backgroundColor: '#fff7f2'
  },
  tabBar: {
    color: '#86909c',
    selectedColor: '#ff6b2c',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '省吃小助手',
        iconPath: 'assets/tabbar/home.png',
        selectedIconPath: 'assets/tabbar/home-selected.png'
      },
      {
        pagePath: 'pages/coupons/index',
        text: '领券中心',
        iconPath: 'assets/tabbar/coupon.png',
        selectedIconPath: 'assets/tabbar/coupon-selected.png'
      },
      {
        pagePath: 'pages/nearby/index',
        text: '点外卖',
        iconPath: 'assets/tabbar/nearby.png',
        selectedIconPath: 'assets/tabbar/nearby-selected.png'
      },
      {
        pagePath: 'pages/mine/index',
        text: '我的',
        iconPath: 'assets/tabbar/mine.png',
        selectedIconPath: 'assets/tabbar/mine-selected.png'
      }
    ]
  }
})
