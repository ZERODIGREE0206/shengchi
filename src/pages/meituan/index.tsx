import React from 'react';
import PlatformZone from '@/components/PlatformZone';
import { ZONE_THEME } from '@/components/PlatformZone/theme';

/** 美团外卖专区（完整页面逻辑在 PlatformZone 组件，按平台主题渲染） */
const MeituanPage: React.FC = () => (
  <PlatformZone platformCode="meituan" theme={ZONE_THEME.meituan} />
);

export default MeituanPage;
