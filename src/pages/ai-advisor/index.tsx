import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Input, ScrollView, Image } from '@tarojs/components';
import classnames from 'classnames';
import logoAvatar from '@/assets/logo.png';
import BrandIcon from '@/components/BrandIcon';
import PlatformIcon from '@/components/PlatformIcon';
import { locateWithAddress, type LocationResult } from '@/services/location';
import { buildNearbyStoresMixed, type MixedStore } from '@/data/stores';
import { fetchCoupons } from '@/services/cloudbase';
import { openPlatformOrder } from '@/services/platformJump';
import {
  askOrderAdvisor,
  type AiChatMessage,
  type AiPick
} from '@/services/aiAdvisor';
import type { Coupon, PlatformCode } from '@/types/coupon';
import styles from './index.module.scss';

const QUICK_PROMPTS = [
  '两个人，预算 60，想吃辣',
  '一个人，30 元以内，工作餐快点到',
  '不吃香菜，想喝点奶茶吃点小吃',
  '夜宵，预算 50，推荐有券的'
];

interface UIMessage extends AiChatMessage {
  id: number;
  picks?: AiPick[];
  pending?: boolean;
  failed?: boolean;
}

let seq = 0;

/**
 * AI 点餐助手：对话式输入需求（人数/预算/口味/忌口），
 * 结合附近门店与券给出推荐，一键跳平台下单。
 */
const AiAdvisorPage: React.FC = () => {
  const [locating, setLocating] = useState<LocationResult>({
    status: 'locating', location: null, address: null
  });
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<UIMessage[]>([
    {
      id: ++seq,
      role: 'assistant',
      content:
        '你好，我是省吃 AI 点餐助手～ 告诉我几个人吃、预算多少、想吃什么口味（或忌口），我帮你从附近门店和券里挑最划算的。'
    }
  ]);
  const scrollAnchor = `chat-bottom-${messages.length}`;

  useEffect(() => {
    (async () => {
      const res = await locateWithAddress(false);
      setLocating(res);
      try {
        setCoupons(await fetchCoupons());
      } catch (err) {
        console.warn('[ai-advisor] coupons failed:', err);
      }
    })();
  }, []);

  // 附近门店（距离升序）
  const stores = useMemo(
    () => buildNearbyStoresMixed(locating.location).slice(0, 12),
    [locating.location]
  );

  // AI 推荐店铺名 → 本地门店快照（用于卡片渲染）
  const storeByName = useMemo(() => {
    const map = new Map<string, MixedStore>();
    stores.forEach((s) => map.set(s.name, s));
    return map;
  }, [stores]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || sending) return;

    const userMsg: UIMessage = { id: ++seq, role: 'user', content };
    const pendingMsg: UIMessage = { id: ++seq, role: 'assistant', content: '', pending: true };
    const history = [...messages, userMsg];
    setMessages([...history, pendingMsg]);
    setInput('');
    setSending(true);

    try {
      const result = await askOrderAdvisor({
        messages: history.map((m) => ({ role: m.role, content: m.content })),
        stores: stores.map((s) => ({
          platformCode: s.platformCode,
          name: s.name,
          category: s.category,
          rating: s.rating,
          monthlySales: s.monthlySales,
          deliveryFee: s.deliveryFee,
          minOrder: s.minOrder,
          distanceKm: s.distanceKm
        })),
        coupons: coupons.slice(0, 12).map((c) => ({
          platformCode: c.platformCode,
          brand: c.brand,
          title: c.title,
          desc: c.desc
        })),
        address: locating.status === 'located' ? locating.address : null
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingMsg.id
            ? {
                ...m,
                pending: false,
                failed: !result.success,
                content: result.success
                  ? result.reply
                  : result.message || '顾问开小差了，稍后再问我一次吧',
                picks: result.success ? result.picks : []
              }
            : m
        )
      );
    } catch (err) {
      console.error('[ai-advisor] ask failed:', err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingMsg.id
            ? { ...m, pending: false, failed: true, content: '网络好像不太顺，换个说法再试试？' }
            : m
        )
      );
    } finally {
      setSending(false);
    }
  };

  const handleOrder = (pick: AiPick) => {
    const code = (['meituan', 'eleme', 'taobao', 'jd'].includes(pick.platformCode)
      ? pick.platformCode
      : 'meituan') as PlatformCode;
    openPlatformOrder(code);
  };

  return (
    <View className={styles.page}>
      <View className={styles.header}>
        <Text className={styles.title}>AI 点餐助手</Text>
        <Text className={styles.subtitle}>
          {locating.status === 'located' ? locating.address || '已按你的位置找店' : '说清人数预算口味，帮你划算点餐'}
        </Text>
      </View>

      <ScrollView
        className={styles.chatArea}
        scrollY
        scrollIntoView={scrollAnchor}
        scrollWithAnimation
      >
        {messages.map((msg) => (
          <View key={msg.id}>
            <View
              className={classnames(
                styles.bubbleRow,
                msg.role === 'user' ? styles.bubbleRowUser : styles.bubbleRowAi
              )}
            >
              {msg.role === 'assistant' && (
                <Image className={styles.aiAvatar} src={logoAvatar} mode='aspectFill' />
              )}
              <View
                className={classnames(
                  styles.bubble,
                  msg.role === 'user' ? styles.bubbleUser : styles.bubbleAi,
                  msg.pending && styles.bubblePending,
                  msg.failed && styles.bubbleFailed
                )}
              >
                {msg.pending ? (
                  <View className={styles.typing}>
                    <Text className={styles.typingDot}>●</Text>
                    <Text className={styles.typingDot}>●</Text>
                    <Text className={styles.typingDot}>●</Text>
                  </View>
                ) : (
                  <Text className={styles.bubbleText}>{msg.content}</Text>
                )}
              </View>
            </View>

            {/* AI 推荐门店卡片 */}
            {msg.role === 'assistant' && msg.picks && msg.picks.length > 0 && (
              <View className={styles.pickList}>
                {msg.picks.map((pick) => {
                  const store = storeByName.get(pick.storeName);
                  return (
                    <View key={pick.storeName} className={styles.pickCard}>
                      {/* 头部：Logo + 店名 + 平台标 */}
                      <View className={styles.pickHeader}>
                        {store?.brandLogo ? (
                          <BrandIcon brand={store.brandLogo} />
                        ) : (
                          <View
                            className={styles.pickLogoFallback}
                            style={{ backgroundColor: store?.bgColor || '#fff3e6' }}
                          >
                            <Text className={styles.pickLogoEmoji}>{store?.emoji || '🍽️'}</Text>
                          </View>
                        )}
                        <View className={styles.pickHeadInfo}>
                          <View className={styles.pickNameRow}>
                            <Text className={styles.pickName}>{pick.storeName}</Text>
                            <PlatformIcon platform={pick.platformCode as PlatformCode} size='sm' />
                          </View>
                          {store && (
                            <View className={styles.pickTags}>
                              <Text className={styles.pickTag}>★ {store.rating}</Text>
                              <Text className={styles.pickTag}>{store.distanceKm}km</Text>
                              <Text className={styles.pickTag}>配送¥{store.deliveryFee}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      {/* 推荐理由 */}
                      {pick.reason && (
                        <View className={styles.pickReasonBox}>
                          <Text className={styles.pickReasonText}>{pick.reason}</Text>
                        </View>
                      )}
                      {/* 底栏：人均 + 去下单 */}
                      <View className={styles.pickFooter}>
                        {pick.estPrice != null ? (
                          <Text className={styles.pickPrice}>
                            ¥<Text className={styles.pickPriceNum}>{pick.estPrice}</Text>
                            <Text className={styles.pickPriceUnit}>/人</Text>
                          </Text>
                        ) : (
                          <Text className={styles.pickPriceHint}>查看实际价格</Text>
                        )}
                        <View className={styles.pickBtn} onClick={() => handleOrder(pick)}>
                          <Text className={styles.pickBtnText}>去下单</Text>
                          <Text className={styles.pickBtnArrow}>→</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        ))}
        <View id={scrollAnchor} style={{ width: '1px', height: '1px' }} />
      </ScrollView>

      {/* 快捷提问 */}
      <ScrollView scrollX className={styles.quickRow} enhanced showScrollbar={false}>
        {QUICK_PROMPTS.map((q) => (
          <View key={q} className={styles.quickChip} onClick={() => send(q)}>
            <Text className={styles.quickChipText}>{q}</Text>
          </View>
        ))}
      </ScrollView>

      <View className={styles.inputBar}>
        <Input
          className={styles.input}
          value={input}
          placeholder='几个人、预算多少、想吃什么…'
          placeholderStyle='color:#a0a6b3;font-size:28rpx;'
          confirmType='send'
          onInput={(e) => setInput(e.detail.value)}
          onConfirm={() => send(input)}
        />
        <View
          className={classnames(styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled)}
          onClick={() => send(input)}
        >
          <Text className={styles.sendBtnText}>{sending ? '…' : '发送'}</Text>
        </View>
      </View>
    </View>
  );
};

export default AiAdvisorPage;
