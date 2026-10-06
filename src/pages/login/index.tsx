import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Input } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import {
  getAuthState,
  refreshAuthState,
  sendPhoneCode,
  loginWithPhoneCode
} from '@/services/auth';
import styles from './index.module.scss';

/**
 * 登录页：手机号 + 短信验证码（注册/登录一体）
 * - 进入时记录当前匿名 uid，登录成功后自动把匿名期间的领券记录迁移到手机号账号
 * - 未登录用户可直接返回（不强制登录）
 */
const LoginPage: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  /** 60s 验证码倒计时 */
  const [countdown, setCountdown] = useState(0);
  /** signInWithOtp 返回的 data（含 verifyOtp 回调） */
  const otpRef = useRef<any>(null);
  /** 进入页面时的匿名 uid（迁移源） */
  const oldUidRef = useRef<string | null>(null);

  useDidShow(() => {
    refreshAuthState().then(() => {
      oldUidRef.current = getAuthState().uid;
    });
  });

  useEffect(() => {
    if (countdown <= 0) return undefined;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const phoneValid = /^1\d{10}$/.test(phone);
  const codeValid = /^\d{4,6}$/.test(code);

  const handlePhoneInput = (e: { detail: { value: string } }) => {
    setPhone(e.detail.value.replace(/\D/g, '').slice(0, 11));
  };

  const handleCodeInput = (e: { detail: { value: string } }) => {
    setCode(e.detail.value.replace(/\D/g, '').slice(0, 6));
  };

  const handleSendCode = async () => {
    if (countdown > 0 || sending) return;
    if (!phoneValid) {
      Taro.showToast({ title: '请输入正确的 11 位手机号', icon: 'none' });
      return;
    }
    setSending(true);
    try {
      const res = await sendPhoneCode(phone);
      if (res?.error) throw new Error(res.error.message || '验证码发送失败');
      otpRef.current = res?.data ?? res;
      if (!otpRef.current?.verifyOtp) throw new Error('验证码发送失败，请稍后再试');
      setCodeSent(true);
      setCountdown(60);
      Taro.showToast({ title: '验证码已发送，请查收短信', icon: 'none' });
    } catch (err: any) {
      console.error('[LoginPage] send code failed:', err);
      Taro.showToast({ title: err?.message || '验证码发送失败，请稍后再试', icon: 'none' });
    } finally {
      setSending(false);
    }
  };

  const handleLogin = async () => {
    if (!phoneValid) {
      Taro.showToast({ title: '请输入正确的 11 位手机号', icon: 'none' });
      return;
    }
    if (!codeValid) {
      Taro.showToast({ title: '请输入短信验证码', icon: 'none' });
      return;
    }
    if (!agreed) {
      Taro.showToast({ title: '请先勾选同意用户协议与隐私政策', icon: 'none' });
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      const otp = otpRef.current;
      if (!otp?.verifyOtp) throw new Error('请先获取验证码');
      const res = await loginWithPhoneCode(otp, phone, code, oldUidRef.current);
      if (!res.ok) throw new Error(res.errorMsg || '登录失败，请重试');
      Taro.showToast({
        title: res.migrated > 0 ? `登录成功，已合并 ${res.migrated} 张券` : '登录成功',
        icon: 'none'
      });
      setTimeout(() => {
        Taro.navigateBack({ delta: 1 }).catch(() => Taro.switchTab({ url: '/pages/mine/index' }));
      }, 900);
    } catch (err: any) {
      console.error('[LoginPage] login failed:', err);
      Taro.showToast({ title: err?.message || '登录失败，请重试', icon: 'none' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className={styles.page}>
      {/* 品牌区 */}
      <View className={styles.hero}>
        <View className={styles.heroLogo}>
          <Text className={styles.heroLogoText}>省吃</Text>
        </View>
        <Text className={styles.heroTitle}>欢迎来到省吃小助手</Text>
        <Text className={styles.heroTip}>登录后优惠券同步到你的账号，换设备也不丢失</Text>
      </View>

      {/* 表单卡片 */}
      <View className={styles.formCard}>
        {/* 手机号 */}
        <View className={styles.fieldRow}>
          <Text className={styles.fieldPrefix}>+86</Text>
          <View className={styles.fieldDivider} />
          <Input
            className={styles.fieldInput}
            type="number"
            placeholder="请输入手机号"
            placeholderStyle="color: #c0c6cf;"
            value={phone}
            onInput={handlePhoneInput}
            maxlength={11}
          />
        </View>

        {/* 验证码 */}
        <View className={styles.fieldRow}>
          <Input
            className={styles.fieldInput}
            type="number"
            placeholder="请输入验证码"
            placeholderStyle="color: #c0c6cf;"
            value={code}
            onInput={handleCodeInput}
            maxlength={6}
          />
          <View
            className={`
              ${styles.sendBtn}
              ${countdown > 0 || sending || !phoneValid ? styles.sendBtnDisabled : ''}
            `}
            onClick={handleSendCode}
          >
            <Text className={styles.sendBtnText}>
              {sending ? '发送中…' : countdown > 0 ? `${countdown}s 后重发` : '获取验证码'}
            </Text>
          </View>
        </View>

        {/* 登录按钮 */}
        <View
          className={`
            ${styles.loginBtn}
            ${phoneValid && codeValid && agreed ? '' : styles.loginBtnDisabled}
          `}
          onClick={handleLogin}
        >
          <Text className={styles.loginBtnText}>
            {submitting ? '登录中…' : codeSent ? '登录' : '登录 / 注册'}
          </Text>
        </View>

        {/* 协议勾选 */}
        <View className={styles.agreeRow} onClick={() => setAgreed((v) => !v)}>
          <View className={`${styles.checkbox} ${agreed ? styles.checkboxChecked : ''}`}>
            {agreed ? <Text className={styles.checkboxTick}>✓</Text> : null}
          </View>
          <Text className={styles.agreeText}>
            已阅读并同意
            <Text className={styles.agreeLink}>《用户协议》</Text>
            和
            <Text className={styles.agreeLink}>《隐私政策》</Text>
          </Text>
        </View>
      </View>

      {/* 暂不登录 */}
      <View className={styles.skipRow} onClick={() => Taro.navigateBack({ delta: 1 })}>
        <Text className={styles.skipText}>暂不登录，先去逛逛</Text>
      </View>
    </View>
  );
};

export default LoginPage;
