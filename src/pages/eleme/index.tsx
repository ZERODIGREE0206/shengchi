import React from 'react';
import PlatformZone from '@/components/PlatformZone';
import { ZONE_THEME } from '@/components/PlatformZone/theme';

/** 饿了么专区（完整页面逻辑在 PlatformZone 组件，饿了么蓝主题） */
const ElemePage: React.FC = () => (
  <PlatformZone platformCode="eleme" theme={ZONE_THEME.eleme} />
);

export default ElemePage;
