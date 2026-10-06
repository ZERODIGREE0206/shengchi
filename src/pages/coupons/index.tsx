import React, { useEffect, useMemo, useState } from 'react';
import { View, Text } from '@tarojs/components';
import Taro, { usePullDownRefresh } from '@tarojs/taro';
import classnames from 'classnames';
import PlatformIcon from '@/components/PlatformIcon';
import { fetchCoupons, claimCouponById } from '@/services/couponService';
import { requireLogin } from '@/services/auth';
import { openCouponPlatform, isCodeCouponUrl } from '@/services/platformJump';
import { PLATFORM_LIST } from '@/constants/platforms';
import { ZONE_THEME, type ZoneTheme } from '@/components/PlatformZone/theme';
import type { Coupon, PlatformCode } from '@/types/coupon';
import styles from './index.module.scss';

/** 各平台板块文案与主题色（主题色与点外卖专区保持一致） */
interface SectionMeta {
  code: PlatformCode;
  name: string;
  slogan: string;
  /** 标签文字色（搭配浅色 chip 底色，保证可读性） */
  tagText: string;
  theme: ZoneTheme;
}

const SECTION_SLOGANS: Record<PlatformCode, string> = {
  meituan: '天天领红包 · 下单直接抵',
  eleme: '最高抢66元 · 外卖商超都能用',
  taobao: '官方补贴 · 小时达好物券',
  jd: '品质外卖 · 券后更省钱'
};

const SECTION_TAG_COLORS: Record<PlatformCode, string> = {
  meituan: '#b87800',
  eleme: '#0080d6',
  taobao: '#e8490b',
  jd: '#c81623'
};

// 领券中心只展示美团/淘宝闪购/京东外卖，饿了么板块暂时隐藏
const SECTIONS: SectionMeta[] = PLATFORM_LIST.filter((p) => p.code !== 'eleme').map((p) => ({
  code: p.code,
  name: p.name,
  slogan: SECTION_SLOGANS[p.code],
  tagText: SECTION_TAG_COLORS[p.code],
  theme: ZONE_THEME[p.code]
}));

/**
 * 领券中心：三大联盟板块（美团 / 淘宝闪购 / 京东外卖）
 * 每个板块只展示已配置的「联盟转链内容」（claim_url 非空），
 * 点击「去领取」直接走对应平台官方跳转/复制引导（见 services/platformJump）。
 */
const CouponsPage: React.FC = () => {
  const [links, setLinks] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const loadCoupons = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const list = await fetchCoupons();
      // 仅保留配置了联盟转链的内容，mock/无链接券不在领券中心展示
      setLinks(list.filter((c) => !!c.claimUrl));
    } catch (err) {
      console.error('[CouponsPage] load links failed:', err);
      setErrorMsg('优惠内容加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
  }, []);

  usePullDownRefresh(async () => {
    try {
      await loadCoupons();
    } finally {
      Taro.stopPullDownRefresh();
    }
  });

  // 按平台分组（保持 SECTIONS 固定顺序：美团 → 淘宝闪购 → 京东）
  const grouped = useMemo(() => {
    const map: Record<PlatformCode, Coupon[]> = {
      meituan: [],
      eleme: [],
      taobao: [],
      jd: []
    };
    links.forEach((c) => {
      if (map[c.platformCode]) map[c.platformCode].push(c);
    });
    return map;
  }, [links]);

  /**
   * 静默记账：把券关联到当前用户账号（供比价/我的页使用），
   * 失败/重复不影响跳转。库存不足等异常仅打印日志。
   */
  const recordClaim = (coupon: Coupon) => {
    claimCouponById(coupon.id)
      .then((res) => {
        if (res.claimed) {
          console.log('[CouponsPage] 券已记账到账号:', coupon.id);
        }
      })
      .catch((err) => {
        console.warn('[CouponsPage] 记账失败（不影响跳转）:', coupon.id, err);
      });
  };

  // 点击单个联盟福利：登录校验 → 记账到账号 → 直达平台红包/下单落地页
  const handleOpen = async (coupon: Coupon) => {
    if (!(await requireLogin('领取该福利'))) return;
    recordClaim(coupon);
    openCouponPlatform(coupon);
  };

  return (
    <View className={styles.page}>
      {/* 顶部渐变 Header */}
      <View className={styles.header}>
        <Text className={styles.title}>领券中心</Text>
        <Text className={styles.subtitle}>美团 / 淘宝闪购 / 京东外卖，官方福利天天领 🎁</Text>
      </View>

      <View className={styles.content}>
        {/* 加载骨架屏：四个平台板块 */}
        {loading &&
          SECTIONS.map((sec) => (
            <View key={sec.code} className={styles.section}>
              <View className={styles.secHeader} style={{ background: sec.theme.headerGradient }}>
                <View className={styles.skeletonLogo} />
                <View className={styles.skeletonHeadLines}>
                  <View className={styles.skeletonLine} style={{ width: '30%' }} />
                  <View className={styles.skeletonLine} style={{ width: '55%' }} />
                </View>
              </View>
              <View className={styles.secBody}>
                {[0, 1].map((i) => (
                  <View key={i} className={styles.skeletonCard}>
                    <View className={styles.skeletonIcon} />
                    <View className={styles.skeletonCardLines}>
                      <View className={styles.skeletonLine} style={{ width: '42%' }} />
                      <View className={styles.skeletonLine} style={{ width: '70%' }} />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}

        {/* 加载失败：错误提示 + 重试 */}
        {!loading && errorMsg && (
          <View className={styles.errorBox}>
            <Text className={styles.errorIcon}>�</Text>
            <Text className={styles.errorText}>{errorMsg}</Text>
            <Text className={styles.errorTip}>请检查网络后重试</Text>
            <View className={styles.retryBtn} onClick={loadCoupons}>
              <Text className={styles.retryText}>重新加载</Text>
            </View>
          </View>
        )}

        {/* 四大联盟板块 */}
        {!loading &&
          !errorMsg &&
          SECTIONS.map((sec) => {
            const items = grouped[sec.code] || [];
            const themeVars = {
              '--sec-grad': sec.theme.headerGradient,
              '--sec-head-text': sec.theme.headerText,
              '--sec-head-dim': sec.theme.headerTextDim,
              '--sec-btn-bg': sec.theme.orderBg,
              '--sec-btn-text': sec.theme.orderText,
              '--sec-chip-bg': sec.theme.chipBg,
              '--sec-chip-border': sec.theme.chipBorder,
              '--sec-tag-text': sec.tagText
            } as React.CSSProperties;
            return (
              <View key={sec.code} className={styles.section} style={themeVars}>
                {/* 板块头：平台色渐变条 */}
                <View className={styles.secHeader}>
                  <PlatformIcon platform={sec.code} size="md" />
                  <View className={styles.secHeadText}>
                    <Text className={styles.secName}>{sec.name}</Text>
                    <Text className={styles.secSlogan}>{sec.slogan}</Text>
                  </View>
                  {items.length > 0 && <Text className={styles.secCount}>{items.length} 个福利</Text>}
                </View>

                <View className={styles.secBody}>
                  {items.length === 0 ? (
                    <View className={styles.emptyBox}>
                      <Text className={styles.emptyIcon}>🎁</Text>
                      <View className={styles.emptyTextWrap}>
                        <Text className={styles.emptyTitle}>{sec.name}优惠即将上线</Text>
                        <Text className={styles.emptyTip}>联盟活动配置中，敬请期待</Text>
                      </View>
                    </View>
                  ) : (
                    <React.Fragment>
                      {/* 直达券：claim_url 为小程序内部路径（/ 开头），点击直达领券页 */}
                      {items
                        .filter((c) => !isCodeCouponUrl(c.claimUrl || ''))
                        .map((coupon) => (
                          <View key={coupon.id} className={styles.linkCard}>
                            <View
                              className={styles.linkLogo}
                              style={{ backgroundColor: coupon.bgColor }}
                            >
                              <Text className={styles.linkLogoEmoji}>{coupon.emoji}</Text>
                            </View>
                            <View className={styles.linkInfo}>
                              <View className={styles.linkTitleRow}>
                                <Text className={styles.linkTitle}>{coupon.title}</Text>
                                {coupon.tag ? <Text className={styles.linkTag}>{coupon.tag}</Text> : null}
                              </View>
                              <Text className={styles.linkDesc}>{coupon.desc || coupon.brand}</Text>
                            </View>
                            <View className={styles.claimBtn} onClick={() => handleOpen(coupon)}>
                              <Text className={styles.claimBtnText}>去领取</Text>
                            </View>
                          </View>
                        ))}

                      {/* 口令券：mp:// 如意口令 / ＄淘口令，无法直达，复制后到对应 APP 识别 */}
                      {(() => {
                        const codeItems = items.filter((c) => isCodeCouponUrl(c.claimUrl || ''));
                        if (codeItems.length === 0) return null;
                        return (
                          <View className={styles.codeGroup}>
                            <View className={styles.codeTipBar}>
                              <Text className={styles.codeTipIcon}>📋</Text>
                              <Text className={styles.codeTipText}>复制打开淘宝闪购app使用</Text>
                            </View>
                            {codeItems.map((coupon) => (
                              <View key={coupon.id} className={styles.linkCard}>
                                <View
                                  className={styles.linkLogo}
                                  style={{ backgroundColor: coupon.bgColor }}
                                >
                                  <Text className={styles.linkLogoEmoji}>{coupon.emoji}</Text>
                                </View>
                                <View className={styles.linkInfo}>
                                  <View className={styles.linkTitleRow}>
                                    <Text className={styles.linkTitle}>{coupon.title}</Text>
                                    {coupon.tag ? <Text className={styles.linkTag}>{coupon.tag}</Text> : null}
                                  </View>
                                  <Text className={styles.linkDesc}>{coupon.desc || coupon.brand}</Text>
                                </View>
                                <View
                                  className={classnames(styles.claimBtn, styles.claimBtnCode)}
                                  onClick={() => handleOpen(coupon)}
                                >
                                  <Text className={styles.claimBtnText}>复制口令</Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        );
                      })()}
                    </React.Fragment>
                  )}
                </View>
              </View>
            );
          })}

        <View className={styles.listFooter}>
          <Text className={styles.listFooterText}>— 红包由各平台官方发放，领取后在对应平台下单使用 —</Text>
        </View>
      </View>
    </View>
  );
};

export default CouponsPage;
