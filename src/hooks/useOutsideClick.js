import { useEffect } from 'react';

const useOutsideClick = (ref, callback, excludeRef) => {
  useEffect(() => {
    const handleClickOutside = (event) => {
      // 如果點擊在排除的 ref (通常是觸發按鈕) 上，不執行回調
      if (excludeRef && excludeRef.current && excludeRef.current.contains(event.target)) {
        return;
      }

      if (ref.current && !ref.current.contains(event.target)) {
        callback();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside); // 支援行動裝置

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [ref, callback, excludeRef]);
};

export default useOutsideClick;
