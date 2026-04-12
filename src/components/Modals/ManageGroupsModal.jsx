import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';

const ManageGroupsModal = ({ 
  isOpen, 
  onClose, 
  groups, 
  selectedMarket,
  onReorder, 
  onAdd, 
  onDelete, 
  onEdit, 
  deletingGroupId 
}) => {
  const [editingId, setEditingId] = useState(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState(null); 
  const [isSaving, setIsSaving] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [editError, setEditError] = useState('');
  const [newGroupTempId, setNewGroupTempId] = useState(null); // 用於臨時新增的分組
  const inputRefs = useRef({});
  const newGroupInputRef = useRef(null);

  // 過濾可編輯分組（排除我的代號）
  const editableGroups = groups.filter(g => g.name !== '我的代號');
  const defaultGroup = groups.find(g => g.name === '我的代號');

  useEffect(() => {
    if (editingId && inputRefs.current[editingId]) {
      inputRefs.current[editingId].focus();
      inputRefs.current[editingId].select();
    }
    
    // 當進入編輯模式時，清除編輯錯誤
    if (editingId) {
      setEditError('');
    }
  }, [editingId]);

  // 當新增臨時分組時，清除新增錯誤
  useEffect(() => {
    if (newGroupTempId) {
      setAddError('');
    }
  }, [newGroupTempId]);

  const handleSave = async (groupId, newName) => {
    if (isSaving) return;
    const trimmedName = newName.trim();
    if (!groupId || !trimmedName) {
      setEditingId(null);
      return;
    }
    setIsSaving(true);
    setEditingId(null);
    try {
      await onEdit(groupId, trimmedName);
    } catch (error) {
      // 顯示錯誤訊息
      console.error('編輯分組失敗:', error);
      // 顯示錯誤提示
      setEditError(`編輯失敗: ${error.message}`);
      // 重新進入編輯模式
      setEditingId(groupId);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddNewGroup = () => {
    // 清除之前的錯誤
    setAddError('');
    setEditError('');
    
    // 創建一個臨時分組物件
    const tempGroup = {
      id: `temp-${Date.now()}`,
      name: '觀察列表',
      isTemp: true
    };
    
    // 設定臨時分組 ID
    setNewGroupTempId(tempGroup.id);
    // 自動進入編輯模式
    setEditingId(tempGroup.id);
  };

  const handleSaveNewGroup = async (tempId, newName) => {
    if (isAdding) return;
    
    const trimmedName = newName.trim();
    
    // 檢查是否為預設名稱
    if (trimmedName === '觀察列表') {
      setAddError('名稱不可為預設值');
      return;
    }
    
    // 檢查是否已存在相同名稱的分組
    const existingGroup = groups.find(g => g.name === trimmedName);
    if (existingGroup) {
      setAddError('已存在相同名稱的分組');
      return;
    }

    setIsAdding(true);
    setAddError('');

    try {
      await onAdd(trimmedName);
      // 清除臨時分組和錯誤
      setNewGroupTempId(null);
      setEditingId(null);
      setAddError('');
    } catch (error) {
      setAddError(error.message || '新增分組失敗');
      // 保持編輯模式
      setEditingId(tempId);
    } finally {
      setIsAdding(false);
    }
  };

  const handleCancelNewGroup = () => {
    // 取消新增，清除臨時分組和錯誤
    setNewGroupTempId(null);
    setEditingId(null);
    setAddError('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 overflow-hidden pointer-events-none">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto" 
            onClick={onClose} 
          />

          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }} 
            animate={{ scale: 1, opacity: 1, y: 0 }} 
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 450 }}
            className="relative w-full max-w-[350px] ios-glass-capsule !rounded-[28px] flex flex-col bg-[rgba(28,28,30,0.6)] backdrop-blur-[30px] backdrop-saturate-[150%] shadow-[inset_0.5px_0.5px_0px_rgba(255,255,255,0.12)] border border-white/10 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 標題與標題按鈕區 */}
            <div className="w-full flex flex-col items-center pt-8 pb-4 px-6 relative border-b border-white/5">
              <h2 className="text-white text-[20px] font-bold mb-1 text-center">管理觀察列表</h2>
              <p className="text-[#8E8E93] text-[13px] text-center px-6 leading-tight">
                製作、重新命名、重新排列和刪除觀察列表。
              </p>
              <button 
                onClick={onClose} 
                className="absolute top-6 right-6 w-10 h-10 bg-[#0A84FF] rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-transform"
              >
                <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 stroke-white stroke-[3]">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            <div className="px-5 pb-8 flex flex-col w-full">
              {/* 1. 我的代號 (僅顯示項目，移除上方標題) */}
              <div className="w-full border-b border-white/5 py-4 px-1 flex justify-between items-center mb-1">
                {/* 靠左對齊：標籤名稱 */}
                <span className="text-white/50 text-[17px] font-medium">我的代號</span>
                
              </div>

              {/* 編輯錯誤顯示 */}
                  {editError && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-[#FF453A] text-[13px] px-4 py-2 bg-[#FF453A]/10 rounded-lg mx-4 mb-3"
                    >
                      {editError}
                    </motion.div>
                  )}

                  {/* 2. 我的代號列表 (移除標題，直接顯示列表內容) */}
              <div className="w-full max-h-[35vh] overflow-y-auto ios-scrollbar ios-scrollbar-dark overflow-x-hidden">
                <Reorder.Group axis="y" values={editableGroups} onReorder={(newOrder) => onReorder([defaultGroup, ...newOrder])} className="w-full list-none p-0">
                  <AnimatePresence mode="popLayout">
                    {/* 如果有臨時新增的分組，先顯示它 */}
                    {newGroupTempId && (
                      <div key={newGroupTempId} className="w-full flex items-center bg-transparent active:bg-white/[0.03] transition-colors relative border-b border-white/5">
                        {/* 靠左對齊：紅色減號與名稱區域 */}
                        <div className="flex items-center flex-1 py-4 pr-2 min-w-0">
                          <motion.button
                            onClick={handleCancelNewGroup}
                            className="text-[#FF453A] mr-3 transition-transform duration-200"
                            whileTap={{ scale: 0.9 }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 fill-current">
                              <circle cx="12" cy="12" r="10"/><path d="M8 12h8" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                            </svg>
                          </motion.button>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <input
                                ref={(el) => {
                                  if (el && editingId === newGroupTempId) {
                                    inputRefs.current[newGroupTempId] = el;
                                    el.focus();
                                    el.select();
                                  }
                                }}
                                className="bg-white/5 text-white px-3 py-2 rounded-[8px] outline-none w-full text-[17px] border border-white/20 focus:border-[#0A84FF] focus:bg-white/10 transition-colors"
                                defaultValue="觀察列表"
                                onBlur={(e) => handleSaveNewGroup(newGroupTempId, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveNewGroup(newGroupTempId, e.target.value);
                                  } else if (e.key === 'Escape') {
                                    handleCancelNewGroup();
                                  }
                                }}
                                disabled={isAdding}
                              />
                              {isAdding && (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 靠右對齊：儲存按鈕 */}
                        <div className="flex items-center pl-4 pr-3 py-4 flex-shrink-0">
                          <motion.button
                            onClick={() => {
                              const input = inputRefs.current[newGroupTempId];
                              if (input) {
                                handleSaveNewGroup(newGroupTempId, input.value);
                              }
                            }}
                            disabled={isAdding}
                            className="bg-[#30D158] hover:bg-[#2CC653] active:scale-95 disabled:bg-[#30D158]/50 disabled:cursor-not-allowed transition-all w-8 h-8 rounded-full flex items-center justify-center"
                            whileTap={{ scale: 0.9 }}
                          >
                            {isAdding ? (
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 stroke-white stroke-[2.5]">
                                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </motion.button>
                        </div>
                      </div>
                    )}
                    
                    {/* 顯示現有的分組 */}
                    {editableGroups.map((group) => (
                      <Reorder.Item 
                        key={group.id} 
                        value={group}
                        className="w-full flex items-center bg-transparent active:bg-white/[0.03] transition-colors relative border-b border-white/5"
                      >
                        {/* 靠左對齊：紅色減號與名稱區域 */}
                        <div className="flex items-center flex-1 py-4 pr-2 min-w-0">
                          <motion.button 
                            onClick={() => setConfirmingDeleteId(confirmingDeleteId === group.id ? null : group.id)} 
                            className={`text-[#FF453A] mr-3 transition-transform duration-200 ${confirmingDeleteId === group.id ? 'rotate-90' : ''}`}
                            whileTap={{ scale: 0.9 }}
                          >
                            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 fill-current">
                              <circle cx="12" cy="12" r="10"/><path d="M8 12h8" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                            </svg>
                          </motion.button>
                          
                          <div className="flex-1 min-w-0">
                            {editingId === group.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  ref={(el) => (inputRefs.current[group.id] = el)}
                                  className="bg-white/5 text-white px-3 py-2 rounded-[8px] outline-none w-full text-[17px] border border-white/20 focus:border-[#0A84FF] focus:bg-white/10 transition-colors"
                                  defaultValue={group.name}
                                  onBlur={(e) => handleSave(group.id, e.target.value)}
                                  disabled={isSaving}
                                />
                                {isSaving && (
                                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin flex-shrink-0" />
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center justify-between group cursor-text" onClick={() => setEditingId(group.id)}>
                                <span className={`text-white text-[17px] truncate tracking-tight ${selectedMarket === group.name ? 'font-bold' : 'font-medium'}`}>
                                  {group.name}
                                </span>
                                {confirmingDeleteId !== group.id && (
                                  <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-white/20 ml-2 flex-shrink-0">
                                    <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 靠右對齊：拖拽手柄 */}
                        <div className="flex items-center pl-4 pr-3 py-4 flex-shrink-0 cursor-grab active:cursor-grabbing text-white/20">
                          <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 stroke-current stroke-2">
                            <path d="M4 8h16M4 12h16M4 16h16" strokeLinecap="round"/>
                          </svg>
                        </div>

                        {/* 側滑刪除按鈕 (位於最右側) */}
                        <AnimatePresence>
                          {confirmingDeleteId === group.id && (
                            <motion.button
                              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                              onClick={(e) => { e.stopPropagation(); onDelete(group.id); setConfirmingDeleteId(null); }}
                              className="absolute right-0 top-0 bottom-0 z-30 w-[80px] bg-[#FF453A] text-white text-[16px] font-bold flex items-center justify-center"
                            >
                              刪除
                            </motion.button>
                          )}
                        </AnimatePresence>
                      </Reorder.Item>
                    ))}
                  </AnimatePresence>
                </Reorder.Group>
              </div>

              {/* 新增按鈕 */}
              <div className="w-full pt-6 pb-2 px-5">
                <motion.button
                  onClick={handleAddNewGroup}
                  disabled={isAdding || newGroupTempId}
                  className="w-full bg-[#0A84FF] hover:bg-[#007AFF] active:scale-95 disabled:bg-[#0A84FF]/50 disabled:cursor-not-allowed transition-all text-white text-[17px] font-medium py-3 rounded-[14px] flex items-center justify-center gap-2"
                  whileTap={{ scale: 0.96 }}
                >
                  {isAdding ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 stroke-white stroke-[2.5]">
                        <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      新增觀察列表
                    </>
                  )}
                </motion.button>
                
                {addError && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[#FF453A] text-[13px] px-4 py-2 bg-[#FF453A]/10 rounded-lg mx-4 mt-3"
                  >
                    {addError}
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ManageGroupsModal;