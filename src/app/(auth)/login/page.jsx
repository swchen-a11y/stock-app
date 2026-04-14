"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { supabase } from '../../../lib/supabase';

const LoginPage = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [success, setSuccess] = useState('');

  // 處理登入/註冊
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('請輸入電子郵件和密碼');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      if (isSignUp) {
        // 註冊模式
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) {
          throw signUpError;
        }

        // 註冊成功，顯示提示訊息
        setSuccess('註冊成功，請前往信箱驗證或直接登入');
        // 清空表單
        setEmail('');
        setPassword('');
        // 自動切換回登入模式
        setIsSignUp(false);
      } else {
        // 登入模式
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          throw signInError;
        }

        // 登入成功，導向首頁
        router.push('/');
        router.refresh();
      }
      
    } catch (err) {
      console.error(isSignUp ? '註冊失敗:' : '登入失敗:', err);
      setError(err.message || (isSignUp ? '註冊失敗，請檢查您的輸入' : '登入失敗，請檢查您的電子郵件和密碼'));
    } finally {
      setLoading(false);
    }
  };

  // 切換到註冊模式
  const handleSwitchToSignUp = () => {
    setIsSignUp(true);
    setError('');
    setSuccess('');
  };

  // 切換到登入模式
  const handleSwitchToLogin = () => {
    setIsSignUp(false);
    setError('');
    setSuccess('');
  };

  // 清空錯誤與成功訊息
  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 font-sans">
      {/* 頂部裝飾空間 */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md">

        {/* 標題 */}
        <motion.h1 
          className="text-white text-4xl font-bold mb-12 tracking-tight"
          style={{ fontFamily: 'SF Pro Display, system-ui, -apple-system, sans-serif' }}
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {isSignUp ? '註冊帳號' : '股市'}
        </motion.h1>

        {/* 錯誤提示 */}
        {error && (
          <motion.div 
            className="w-full mb-6 ios-liquid-glass rounded-xl p-4 border border-[#FF453A]/30"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="flex items-center gap-3">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-[#FF453A] flex-shrink-0">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <p className="text-white text-[14px] font-medium flex-1">{error}</p>
            </div>
          </motion.div>
        )}

        {/* 成功提示 */}
        {success && (
          <motion.div 
            className="w-full mb-6 ios-liquid-glass rounded-xl p-4 border border-[#30D158]/30"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="flex items-center gap-3">
              <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-[#30D158] flex-shrink-0">
                <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <p className="text-white text-[14px] font-medium flex-1">{success}</p>
            </div>
          </motion.div>
        )}

        {/* 登入/註冊表單 */}
        <motion.form 
          className="w-full space-y-4"
          onSubmit={handleSubmit}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {/* 電子郵件輸入框 */}
          <div className="relative">
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                className="text-[#8E8E93]"
              >
                <path 
                  d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
                <path 
                  d="M22 6l-10 7L2 6" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearMessages();
              }}
              placeholder="電子郵件"
              className="w-full bg-[#1C1C1E] text-white text-[17px] font-medium placeholder:text-[#8E8E93] 
                       rounded-xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 
                       transition-all duration-200"
              required
              disabled={loading}
            />
          </div>

          {/* 密碼輸入框 */}
          <div className="relative">
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                className="text-[#8E8E93]"
              >
                <rect 
                  x="3" 
                  y="11" 
                  width="18" 
                  height="11" 
                  rx="2" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
                <path 
                  d="M7 11V7a5 5 0 0110 0v4" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearMessages();
              }}
              placeholder="密碼"
              className="w-full bg-[#1C1C1E] text-white text-[17px] font-medium placeholder:text-[#8E8E93] 
                       rounded-xl pl-12 pr-4 py-4 focus:outline-none focus:ring-2 focus:ring-[#007AFF]/30 
                       transition-all duration-200"
              required
              disabled={loading}
            />
          </div>

          {/* 提交按鈕 */}
          <motion.button
            type="submit"
            className="w-full rounded-xl py-4 active:scale-[0.96] transition-transform ios-tap-feedback"
            style={{
              background: 'linear-gradient(135deg, #007AFF 0%, #0A84FF 100%)',
            }}
            whileTap={{ scale: 0.96 }}
            disabled={loading}
          >
            <span className="text-white text-[17px] font-semibold">
              {loading ? (isSignUp ? '註冊中...' : '登入中...') : (isSignUp ? '立即註冊' : '登入')}
            </span>
          </motion.button>
        </motion.form>
      </div>

      {/* 底部註冊/登入連結 */}
      <motion.div 
        className="w-full max-w-md py-8 border-t border-white/10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <div className="text-center">
          <p className="text-[#8E8E93] text-[15px] font-medium mb-4">
            {isSignUp ? '已有帳號？' : '還沒有帳號？'}
          </p>
          <button
            onClick={isSignUp ? handleSwitchToLogin : handleSwitchToSignUp}
            className="text-[#007AFF] text-[17px] font-semibold active:scale-[0.96] transition-transform ios-tap-feedback"
            disabled={loading}
          >
            {isSignUp ? '登入' : 'Sign up'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;