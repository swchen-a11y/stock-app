import React from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6"><path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
);
const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white/70"><path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13M18.5 2.50001C18.8978 2.10219 19.4374 1.87869 20 1.87869C20.5626 1.87869 21.1022 2.10219 21.5 2.50001C21.8978 2.89784 22.1213 3.4374 22.1213 4.00001C22.1213 4.56262 21.8978 5.10219 21.5 5.50001L12 15L8 16L9 12L18.5 2.50001Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
);
const DeleteIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6"><circle cx="12" cy="12" r="10" fill="#FF3B30"/><path d="M8 12H16" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
);
const ReorderIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-[#8E8E93]"><path d="M5 9H19M5 15H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
);

const ManageListModal = ({ isOpen, onClose, userLists, setUserLists, onDeleteList, onRenameList, onAddList }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 z-[200] backdrop-blur-sm"
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed inset-x-0 bottom-0 z-[210] bg-[#1C1C1E] rounded-t-[30px] p-6 pb-12 flex flex-col items-center text-white shadow-2xl h-[80vh]"
      >
        <button onClick={onClose} className="absolute right-6 top-6 p-2 rounded-full bg-[#2C2C2E] hover:bg-[#3A3A3C] transition-colors">
          <CloseIcon />
        </button>

        <h2 className="text-[20px] font-bold mt-2">管理觀察列表</h2>

        <div className="w-full mt-8 bg-[#2C2C2E] rounded-[20px] overflow-hidden flex-1 overflow-y-auto">
          <Reorder.Group axis="y" values={userLists} onReorder={setUserLists}>
            {userLists.map((list, index) => {
              const isFixed = list.isFixed || list.name === '我的代號';
              const isFirstEditable = !isFixed && (index === 0 || userLists[index-1].isFixed);

              return (
                <Reorder.Item
                  key={list.id}
                  value={list}
                  dragListener={!isFixed}
                  className={`flex items-center px-5 py-4 border-b border-white/5 active:bg-white/10 transition-colors ${isFirstEditable ? 'border-t-4 border-white/5 mt-2' : ''}`}
                >
                  <div className="flex-1 flex items-center gap-4">
                    {!isFixed && (
                      <button 
                        onClick={() => onDeleteList(list.id)}
                        className="active:scale-90 transition-transform"
                      >
                        <DeleteIcon />
                      </button>
                    )}
                    <span className={`text-[17px] font-medium flex-1 ${isFixed ? 'text-[#8E8E93] ml-10' : 'text-white'}`}>
                      {list.name}
                    </span>
                    {!isFixed && (
                      <button 
                        onClick={() => onRenameList(list.id)}
                        className="p-1 active:scale-90 transition-transform"
                      >
                        <EditIcon />
                      </button>
                    )}
                  </div>
                  {!isFixed && <ReorderIcon />}
                </Reorder.Item>
              );
            })}
          </Reorder.Group>
        </div>

        <button 
          onClick={onAddList}
          className="w-full mt-6 bg-[#2C2C2E] rounded-[18px] py-4 text-[17px] font-medium active:bg-[#3A3A3C] transition-colors"
        >
          + 新增觀察列表
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

export default ManageListModal;
