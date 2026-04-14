"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import useSettings, { AI_MODELS, DAILY_AI_LIMIT, TRIAL_DAILY_LIMIT, maskApiKey } from '../../hooks/useSettings';

const SettingsView = () => {
  const router = useRouter();
  const {
    settings,
    loading,
    saving,
    error,
    success,
    maskedApiKey,
    aiUsagePercent,
    hasCustomApiKey,
    isTrialMode,
    actualLimit,
    updateSetting,
    updateSettings,
    fetchSettings,
  } = useSettings();

  // 本地狀態管理
  const [aiModelExpanded, setAiModelExpanded] = useState(false);
  const [apiKeyExpanded, setApiKeyExpanded] = useState(false);
  const [apiKeyEditing, setApiKeyEditing] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showSuccessIcon, setShowSuccessIcon] = useState(false);
  const [localAiModel, setLocalAiModel] = useState('Gemini 2.5 Flash');
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  // 用戶名稱相關狀態
  const [usernameExpanded, setUsernameExpanded] = useState(false);
  const [usernameEditing, setUsernameEditing] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [showUsernameSuccessIcon, setShowUsernameSuccessIcon] = useState(false);

  // 同步本地狀態與遠端設定
  useEffect(() => {
    if (settings.selected_model) {
      setLocalAiModel(settings.selected_model);
    }
  }, [settings.selected_model]);

  useEffect(() => {
    setApiKeyInput(settings.custom_api_key || '');
  }, [settings.custom_api_key]);

  useEffect(() => {
    setUsernameInput(settings.username || '');
  }, [settings.username]);

  // 處理 AI 模型選擇
  const handleAiModelSelect = async (modelName) => {
    setLocalAiModel(modelName);
    setAiModelExpanded(false);
    
    // 更新到資料庫
    const success = await updateSetting('selected_model', modelName);
    if (success) {
      triggerSuccessFeedback();
    }
  };

  // 處理 API Key 保存
  const handleApiKeySave = async () => {
    const success = await updateSetting('custom_api_key', apiKeyInput);
    if (success) {
      setApiKeyEditing(false);
      setApiKeyExpanded(false);
      triggerSuccessFeedback();
    }
  };

  // 處理 API Key 取消編輯
  const handleApiKeyCancel = () => {
    setApiKeyInput(settings.custom_api_key || '');
    setApiKeyEditing(false);
    setApiKeyExpanded(false);
  };

  // 處理用戶名稱保存
  const handleUsernameSave = async () => {
    if (!usernameInput.trim()) {
      // 如果用戶名稱為空，使用默認值
      const defaultUsername = '用戶';
      const success = await updateSetting('username', defaultUsername);
      if (success) {
        setUsernameEditing(false);
        setUsernameExpanded(false);
        triggerUsernameSuccessFeedback();
      }
      return;
    }

    const success = await updateSetting('username', usernameInput.trim());
    if (success) {
      setUsernameEditing(false);
      setUsernameExpanded(false);
      triggerUsernameSuccessFeedback();
    }
  };

  // 處理用戶名稱取消編輯
  const handleUsernameCancel = () => {
    setUsernameInput(settings.username || '');
    setUsernameEditing(false);
    setUsernameExpanded(false);
  };

  // 觸發成功反饋動畫
  const triggerSuccessFeedback = () => {
    setShowSuccessIcon(true);
    setTimeout(() => setShowSuccessIcon(false), 2000);
  };

  // 觸發用戶名稱成功反饋動畫
  const triggerUsernameSuccessFeedback = () => {
    setShowUsernameSuccessIcon(true);
    setTimeout(() => setShowUsernameSuccessIcon(false), 2000);
  };

  // 處理 AI 模型展開/收起
  const handleAiModelToggle = () => {
    setAiModelExpanded(!aiModelExpanded);
    if (apiKeyExpanded) setApiKeyExpanded(false);
  };

  // 處理 API Key 展開/收起
  const handleApiKeyToggle = () => {
    const newExpanded = !apiKeyExpanded;
    setApiKeyExpanded(newExpanded);
    if (aiModelExpanded) setAiModelExpanded(false);
    if (usernameExpanded) setUsernameExpanded(false);
    
    // 展開時進入編輯模式
    if (newExpanded) {
      setApiKeyEditing(true);
      setApiKeyInput(settings.custom_api_key || '');
    } else {
      setApiKeyEditing(false);
    }
  };

  // 處理用戶名稱展開/收起
  const handleUsernameToggle = () => {
    const newExpanded = !usernameExpanded;
    setUsernameExpanded(newExpanded);
    if (aiModelExpanded) setAiModelExpanded(false);
    if (apiKeyExpanded) setApiKeyExpanded(false);
    
    // 展開時進入編輯模式
    if (newExpanded) {
      setUsernameEditing(true);
      setUsernameInput(settings.username || '');
    } else {
      setUsernameEditing(false);
    }
  };

  // 處理 API Key 輸入
  const handleApiKeyChange = (e) => {
    setApiKeyInput(e.target.value);
  };

  // 處理用戶名稱輸入
  const handleUsernameChange = (e) => {
    setUsernameInput(e.target.value);
  };

  // 處理 API Key 失去焦點自動保存
  const handleApiKeyBlur = async () => {
    if (apiKeyInput !== settings.custom_api_key) {
      await handleApiKeySave();
    }
  };

  // 處理用戶名稱失去焦點自動保存
  const handleUsernameBlur = async () => {
    if (usernameInput !== settings.username) {
      await handleUsernameSave();
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    
    try {
      setLoggingOut(true);
      setLogoutError('');
      
      await supabase.auth.signOut();
      
      // 導向登入頁面
      router.push('/login');
    } catch (err) {
      console.error('登出失敗:', err);
      setLogoutError(err.message || '登出失敗，請稍後再試');
    } finally {
      setLoggingOut(false);
    }
  };

  // 獲取 API Key 顯示文本
  const getApiKeyDisplayText = () => {
    if (!settings.custom_api_key) return '未設定';
    if (apiKeyEditing) return '編輯中';
    return maskedApiKey;
  };

  // 獲取 API Key 狀態顏色
  const getApiKeyStatusColor = () => {
    if (apiKeyEditing) return 'text-[#007AFF]';
    if (settings.custom_api_key) return 'text-[#30D158]';
    return 'text-[#8E8E93]';
  };

  // 載入狀態
  if (loading) {
    return (
      <div className="text-white select-none font-pingfang">
        <div className="mb-8">
          <p className="text-[#8E8E93] text-[15px] font-medium">管理您的應用程式偏好設定</p>
        </div>
        <div className="ios-liquid-glass rounded-[16px] p-8 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="text-white select-none font-pingfang">
      {/* 頁面描述 */}
      <div className="mb-8">
        <p className="text-[#8E8E93] text-[15px] font-medium">管理您的應用程式偏好設定</p>
      </div>

      {/* 錯誤提示 */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-6 ios-liquid-glass rounded-[16px] p-4 border border-[#FF453A]/30"
          >
            <div className="flex items-center gap-3">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-[#FF453A]">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <p className="text-white text-[14px] font-medium flex-1">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* 個人資料分組 */}
      <div className="mb-8">
        <h2 className="text-[#8E8E93] text-[13px] font-semibold uppercase tracking-wider mb-3">個人資料</h2>
        
        <div className="ios-liquid-glass rounded-[16px] overflow-hidden">
          {/* 用戶名稱項目 */}
          <div className="border-b border-white/10">
            <button 
              className="w-full flex items-center justify-between px-5 py-4 active:scale-[0.96] transition-transform ios-tap-feedback"
              onClick={() => handleUsernameToggle()}
              disabled={saving}
            >
              <div className="flex flex-col items-start">
                <span className="text-white text-[17px] font-medium">用戶名稱</span>
                <span className="text-[#8E8E93] text-[13px] font-medium mt-0.5">您的顯示名稱</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#8E8E93] text-[15px] font-medium">
                  {settings.username || '未設定'}
                </span>
                <motion.div
                  animate={{ scale: showUsernameSuccessIcon ? [1, 1.2, 1] : 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {showUsernameSuccessIcon ? (
                    <motion.svg 
                      key="success"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      viewBox="0 0 24 24" 
                      fill="none" 
                      className="w-5 h-5 text-[#30D158]"
                    >
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </motion.svg>
                  ) : (
                    <motion.svg 
                      key="arrow"
                      viewBox="0 0 24 24" 
                      fill="none" 
                      className="w-5 h-5 text-[#8E8E93]"
                      animate={{ rotate: usernameExpanded ? 180 : 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                    >
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </motion.svg>
                  )}
                </motion.div>
              </div>
            </button>
            
            {/* 用戶名稱展開輸入框 */}
            <AnimatePresence>
              {usernameExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-4 pt-2">
                    <div className="bg-white/5 rounded-xl p-4 mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <svg 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          className="w-4 h-4 text-[#8E8E93]"
                        >
                          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="text-[#8E8E93] text-[13px] font-medium">
                          {usernameEditing ? '輸入您的用戶名稱' : '用戶名稱'}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={usernameInput}
                        onChange={handleUsernameChange}
                        onBlur={handleUsernameBlur}
                        placeholder="請輸入用戶名稱"
                        className="w-full bg-transparent text-white text-[15px] font-medium placeholder:text-[#8E8E93]/50 focus:outline-none py-2"
                        autoComplete="off"
                        disabled={!usernameEditing || saving}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-[#8E8E93] text-[11px] font-medium">
                          {usernameEditing 
                            ? '用戶名稱將用於 AI 報告的個人化稱呼'
                            : '點擊上方按鈕以編輯用戶名稱'
                          }
                        </p>
                      </div>
                      {usernameEditing && (
                        <div className="flex items-center gap-2 ml-3">
                          <button
                            onClick={handleUsernameCancel}
                            className="text-[#8E8E93] text-[15px] font-medium px-4 py-2 rounded-lg active:scale-[0.96] transition-transform ios-tap-feedback"
                            disabled={saving}
                          >
                            取消
                          </button>
                          <button
                            onClick={handleUsernameSave}
                            className="bg-[#007AFF] text-white text-[15px] font-medium px-4 py-2 rounded-lg active:scale-[0.96] transition-transform ios-tap-feedback"
                            disabled={saving}
                          >
                            {saving ? '儲存中...' : '儲存'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      
      {/* 模型設定分組 */}
      <div className="mb-8">
        <h2 className="text-[#8E8E93] text-[13px] font-semibold uppercase tracking-wider mb-3">模型設定</h2>
        
        <div className="ios-liquid-glass rounded-[16px] overflow-hidden">


          {/* AI 模型項目 */}
          <div className="border-b border-white/10">
            <button 
              className="w-full flex items-center justify-between px-5 py-4 active:scale-[0.96] transition-transform ios-tap-feedback"
              onClick={handleAiModelToggle}
              disabled={saving}
            >
              <div className="flex flex-col items-start">
                <span className="text-white text-[17px] font-medium">AI 模型</span>
                <span className="text-[#8E8E93] text-[13px] font-medium mt-0.5">用於股票分析與建議</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#8E8E93] text-[15px] font-medium">{localAiModel}</span>
                <motion.svg 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  className="w-5 h-5 text-[#8E8E93]"
                  animate={{ rotate: aiModelExpanded ? 180 : 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                >
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </motion.svg>
              </div>
            </button>
            
            {/* AI 模型展開選單 */}
            <AnimatePresence>
              {aiModelExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-4 pt-2">
                    {AI_MODELS.map((model) => (
                      <button
                        key={model.id}
                        className="w-full flex items-center justify-between py-3 px-2 rounded-lg hover:bg-white/5 active:scale-[0.98] transition-all ios-tap-feedback"
                        onClick={() => handleAiModelSelect(model.name)}
                        disabled={saving}
                      >
                        <div className="flex flex-col items-start">
                          <span className="text-white text-[15px] font-medium">{model.name}</span>
                          <span className="text-[#8E8E93] text-[12px] font-medium mt-0.5">{model.description}</span>
                        </div>
                        {localAiModel === model.name && (
                          <svg 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            className="w-5 h-5 text-[#007AFF]"
                          >
                            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* API Key 項目 */}
          <div>
            <button 
              className="w-full flex items-center justify-between px-5 py-4 active:scale-[0.96] transition-transform ios-tap-feedback"
              onClick={handleApiKeyToggle}
              disabled={saving}
            >
              <div className="flex flex-col items-start">
                <span className="text-white text-[17px] font-medium">API Key</span>
                <span className="text-[#8E8E93] text-[13px] font-medium mt-0.5">API Key與數據服務</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[15px] font-medium ${getApiKeyStatusColor()}`}>
                  {getApiKeyDisplayText()}
                </span>
                <motion.div
                  animate={{ scale: showSuccessIcon ? [1, 1.2, 1] : 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {showSuccessIcon ? (
                    <motion.svg 
                      key="success"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      viewBox="0 0 24 24" 
                      fill="none" 
                      className="w-5 h-5 text-[#007AFF]"
                    >
                      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </motion.svg>
                  ) : (
                    <motion.svg 
                      key="arrow"
                      viewBox="0 0 24 24" 
                      fill="none" 
                      className="w-5 h-5 text-[#8E8E93]"
                      animate={{ rotate: apiKeyExpanded ? 180 : 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                    >
                      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </motion.svg>
                  )}
                </motion.div>
              </div>
            </button>
            
            {/* 試用模式進度條 */}
            <AnimatePresence>
              {isTrialMode && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="px-5 py-3 border-b border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[#8E8E93] text-[13px] font-medium">試用額度</span>
                      <span className="text-white text-[13px] font-medium">
                        {settings.daily_ai_usage} / {actualLimit}
                      </span>
                    </div>
                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-[#007AFF] rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${aiUsagePercent}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                      />
                    </div>
                    <p className="text-[#8E8E93] text-[11px] font-medium mt-2">
                      正在使用試用額度 ({actualLimit}次/日)，設定您的 API Key 以解除限制
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* API Key 展開輸入框 */}
            <AnimatePresence>
              {apiKeyExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-4 pt-2">
                    <div className="bg-white/5 rounded-xl p-4 mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <svg 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          className="w-4 h-4 text-[#8E8E93]"
                        >
                          <path d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="text-[#8E8E93] text-[13px] font-medium">
                          {apiKeyEditing ? '輸入您的 API Key' : 'API Key 已設定'}
                        </span>
                      </div>
                      <input
                        type="password"
                        value={apiKeyInput}
                        onChange={handleApiKeyChange}
                        onBlur={handleApiKeyBlur}
                        placeholder="sk-..."
                        className="w-full bg-transparent text-white text-[15px] font-medium placeholder:text-[#8E8E93]/50 focus:outline-none py-2"
                        autoComplete="off"
                        disabled={!apiKeyEditing || saving}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-[#8E8E93] text-[11px] font-medium">
                          {apiKeyEditing 
                            ? '您的 API Key 將安全儲存在雲端，僅用於 AI 功能調用'
                            : '點擊上方按鈕以編輯 API Key'
                          }
                        </p>
                      </div>
                      {apiKeyEditing && (
                        <div className="flex items-center gap-2 ml-3">
                          <button
                            onClick={handleApiKeyCancel}
                            className="text-[#8E8E93] text-[15px] font-medium px-4 py-2 rounded-lg active:scale-[0.96] transition-transform ios-tap-feedback"
                            disabled={saving}
                          >
                            取消
                          </button>
                          <button
                            onClick={handleApiKeySave}
                            className="bg-[#007AFF] text-white text-[15px] font-medium px-4 py-2 rounded-lg active:scale-[0.96] transition-transform ios-tap-feedback"
                            disabled={saving}
                          >
                            {saving ? '儲存中...' : '儲存'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* 帳號分組 */}
      <div className="mb-8">
        <h2 className="text-[#8E8E93] text-[13px] font-semibold uppercase tracking-wider mb-3">帳號</h2>
        
        <div className="ios-liquid-glass rounded-[16px] overflow-hidden">
          {/* 登出錯誤提示 */}
          <AnimatePresence>
            {logoutError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-3 ios-liquid-glass rounded-[16px] p-4 border border-[#FF453A]/30"
              >
                <div className="flex items-center gap-3">
                  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-[#FF453A]">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                    <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <p className="text-white text-[14px] font-medium flex-1">{logoutError}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 登出項目 */}
          <button 
            className="w-full flex items-center justify-between px-5 py-4 active:scale-[0.96] transition-transform ios-tap-feedback disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <div className="flex items-center gap-3">
              <span className="text-ios-red text-[17px] font-medium">
                {loggingOut ? '登出中...' : '登出'}
              </span>
            </div>
            {loggingOut ? (
              <div className="w-5 h-5 border-2 border-[#FF453A]/30 border-t-[#FF453A] rounded-full animate-spin" />
            ) : (
              <svg 
                viewBox="0 0 24 24" 
                fill="none" 
                className="w-5 h-5 text-ios-red"
              >
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* 底端版本資訊 */}
      <div className="mt-12 pt-8 border-t border-white/10">
        <div className="text-center">
          <p className="text-[#8E8E93]/40 text-[13px] font-medium">版本 1.0.0 · © 2026 Stocks</p>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;