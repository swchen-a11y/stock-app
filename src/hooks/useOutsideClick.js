import { useEffect } from 'react';

export default function useOutsideClick(ref, handler, triggerRef) {
  useEffect(() => {
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target) || 
          (triggerRef?.current && triggerRef.current.contains(event.target))) {
        return;
      }
      handler(event);
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler, triggerRef]);
}