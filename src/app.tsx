import { useEffect } from 'react';
import Taro, { useDidShow, useDidHide } from '@tarojs/taro';
import { getLocation } from '@/services/location';
import { refreshAuthState } from '@/services/auth';
import { CLOUDBASE_ENV_ID } from '@/services/cloudbase';
// 全局样式
import './app.scss';

function App(props) {
  // 微信端云开发初始化（H5 预览自动跳过）
  useEffect(() => {
    if (process.env.TARO_ENV === 'weapp' && CLOUDBASE_ENV_ID) {
      Taro.cloud.init({ env: CLOUDBASE_ENV_ID, traceUser: true });
    }
  }, []);

  // 启动时预取定位（写入 30 秒缓存，进「点外卖」页零等待）
  useEffect(() => {
    getLocation(false).catch(() => {});
    refreshAuthState();
  }, []);

  // 对应 onShow
  useDidShow(() => {});

  // 对应 onHide
  useDidHide(() => {});

  return props.children;
}

export default App;
