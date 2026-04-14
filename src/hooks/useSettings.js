"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// AI 模型選項
export const AI_MODELS = [
  { id: 'gpt-4', name: 'GPT-4', description: 'OpenAI 最新模型' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'OpenAI 快速模型' },
  { id: 'gemini-pro', name: 'Gemini Pro', description: 'Google 高級模型' },
  { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite', description: 'Google 輕量模型' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Google 混合推論模型' },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', description: 'Anthropic 頂級模型' },
  { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', description: 'Anthropic 平衡模型' },
];

// 每日 AI 用量限制
export const DAILY_AI_LIMIT = 500;
export const TRIAL_DAILY_LIMIT = 10;

/**
 * 脫敏顯示 API Key
 * @param {string} apiKey - 原始 API Key
 * @returns {string} 脫敏後的 API Key
 */
export const maskApiKey = (apiKey) => {
  if (!apiKey || apiKey.length < 8) return '••••••••';
  
  const prefix = apiKey.substring(0, 8);
  const suffix = apiKey.substring(apiKey.length - 4);
  return `${prefix}••••••••${suffix}`;
};

/**
 * 檢查 API Key 格式
 * @param {string} apiKey - API Key
 * @returns {boolean} 是否為有效格式
 */
export const validateApiKey = (apiKey) => {
  if (!apiKey) return false;
  // 基本長度檢查
  return apiKey.length >= 10;
};

export default function useSettings() {
  const [settings, setSettings] = useState({
    custom_api_key: '',
    daily_ai_usage: 0,
    selected_model: 'Gemini 2.5 Flash',
    username: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [userId, setUserId] = useState(null);

  // 獲取當前用戶 ID
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getUser();
  }, []);

  // 從 Supabase 獲取用戶設定
  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('用戶未登入');
      }

      setUserId(user.id);

      // 從 profiles 表格獲取用戶設定
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('custom_api_key, daily_ai_usage, selected_model, username')
        .eq('id', user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 表示找不到記錄，這是正常的（新用戶）
        throw fetchError;
      }

      if (data) {
        setSettings({
          custom_api_key: data.custom_api_key || '',
          daily_ai_usage: data.daily_ai_usage || 0,
          selected_model: data.selected_model || 'Gemini 2.5 Flash',
          username: data.username || '',
        });
      }
    } catch (err) {
      console.error('[useSettings] 獲取設定失敗:', err);
      setError(err.message || '獲取設定失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  // 更新設定到 Supabase
  const updateSettings = useCallback(async (updates) => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('用戶未登入');
      }

      // 驗證 API Key 格式
      if (updates.custom_api_key !== undefined) {
        if (updates.custom_api_key && !validateApiKey(updates.custom_api_key)) {
          throw new Error('API Key 格式無效');
        }
      }

      // 準備更新數據
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      // 更新 profiles 表格
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (updateError) throw updateError;

      // 更新本地狀態
      setSettings(prev => ({ ...prev, ...updates }));
      setSuccess(true);

      // 3秒後清除成功狀態
      setTimeout(() => setSuccess(false), 3000);

      return true;
    } catch (err) {
      console.error('[useSettings] 更新設定失敗:', err);
      setError(err.message || '更新設定失敗');
      
      // 3秒後清除錯誤狀態
      setTimeout(() => setError(null), 3000);
      
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  // 更新單一設定值
  const updateSetting = useCallback(async (key, value) => {
    return updateSettings({ [key]: value });
  }, [updateSettings]);

  // 監聽 profiles 表格的實時更新
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('profiles-realtime')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'profiles' }, 
        (payload) => {
          // 檢查是否是當前用戶的資料
          if (payload.new.id === userId) {
            setSettings(prev => ({
              ...prev,
              custom_api_key: payload.new.custom_api_key || prev.custom_api_key,
              daily_ai_usage: payload.new.daily_ai_usage || prev.daily_ai_usage,
              selected_model: payload.new.selected_model || prev.selected_model,
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  // 組件載入時獲取設定
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // 提供脫敏的 API Key 用於顯示
  const maskedApiKey = maskApiKey(settings.custom_api_key);

  // 判斷是否使用試用模式
  const hasCustomApiKey = !!settings.custom_api_key;
  const isTrialMode = !hasCustomApiKey;
  
  // 實際使用的 API Key（試用模式使用開發者環境變數）
  const actualApiKey = hasCustomApiKey 
    ? settings.custom_api_key 
    : process.env.NEXT_PUBLIC_DEV_API_KEY || '';
  
  // 實際每日限制
  const actualLimit = hasCustomApiKey ? DAILY_AI_LIMIT : TRIAL_DAILY_LIMIT;
  
  // 計算 AI 用量百分比
  const aiUsagePercent = Math.min((settings.daily_ai_usage / actualLimit) * 100, 100);

  return {
    settings,
    loading,
    saving,
    error,
    success,
    maskedApiKey,
    aiUsagePercent,
    DAILY_AI_LIMIT,
    TRIAL_DAILY_LIMIT,
    AI_MODELS,
    hasCustomApiKey,
    isTrialMode,
    actualApiKey,
    actualLimit,
    fetchSettings,
    updateSettings,
    updateSetting,
    validateApiKey,
    maskApiKey,
  };
}