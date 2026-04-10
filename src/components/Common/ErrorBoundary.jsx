"use client";

import React, { Component, Suspense } from 'react';
import { motion } from 'framer-motion';

/**
 * 全域錯誤邊界組件
 * 捕獲並處理 React 渲染錯誤
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    // 更新 state 使下一次渲染能夠顯示降級 UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // 你可以將錯誤日誌上報到伺服器
    console.error('React 錯誤邊界捕獲的錯誤:', error);
    console.error('錯誤資訊:', errorInfo);
    this.setState({ errorInfo });
    
    // 可以在此處整合錯誤追蹤服務，如 Sentry
    // if (window.Sentry) {
    //   window.Sentry.captureException(error);
    // }
  }

  handleReset = () => {
    this.setState({ 
      hasError: false, 
      error: null,
      errorInfo: null 
    });
    
    // 嘗試重新載入頁面
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError) {
      // 你可以自定義降級 UI
      return (
        <div className="min-h-screen bg-[#000000] text-white flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="ios-glass-capsule !rounded-[28px] p-8 max-w-md w-full"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 stroke-red-500 stroke-2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
              </div>
              <div>
                <h1 className="text-white text-[22px] font-bold">應用程式錯誤</h1>
                <p className="text-[#8E8E93] text-[15px]">抱歉，發生了未預期的錯誤</p>
              </div>
            </div>

            <div className="mb-6">
              <h2 className="text-white text-[17px] font-semibold mb-2">錯誤詳情</h2>
              <div className="bg-white/5 rounded-xl p-4">
                <code className="text-[13px] text-red-400 font-mono break-all">
                  {this.state.error?.toString() || '未知錯誤'}
                </code>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleReset}
                className="w-full py-4 bg-blue-500/20 rounded-xl text-blue-400 text-[17px] font-medium active:scale-95 transition-transform border border-blue-500/30"
              >
                重新載入應用程式
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="w-full py-4 bg-white/5 rounded-xl text-white text-[17px] font-medium active:scale-95 transition-transform"
              >
                返回首頁
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-[#8E8E93] text-[13px] text-center">
                如果問題持續發生，請聯繫技術支援
              </p>
            </div>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * 帶有 Suspense 的錯誤邊界包裝器
 */
export function ErrorBoundaryWithSuspense({ children, fallback }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={fallback || <DefaultLoadingFallback />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

/**
 * 預設載入回退組件
 */
function DefaultLoadingFallback() {
  return (
    <div className="min-h-screen bg-[#000000] flex items-center justify-center">
      <div className="ios-glass-capsule !rounded-[28px] p-8 flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4" />
        <p className="text-white text-[17px] font-medium">載入中...</p>
      </div>
    </div>
  );
}

export default ErrorBoundary;