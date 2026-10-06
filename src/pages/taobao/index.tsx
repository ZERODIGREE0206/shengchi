import React from 'react';
import PlatformZone from '@/components/PlatformZone';
import { ZONE_THEME } from '@/components/PlatformZone/theme';

/** 淘宝闪购专区（完整页面逻辑在 PlatformZone 组件，淘宝橙红主题） */
const TaobaoPage: React.FC = () => (
  <PlatformZone platformCode="taobao" theme={ZONE_THEME.taobao} />
);

export default TaobaoPage;
