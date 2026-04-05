import { useState, useEffect, useRef, useCallback } from 'react';

const useLongPress = (callback, ms = 600) => {
  const [startLongPress, setStartLongPress] = useState(false);
  const timerRef = useRef();

  const start = useCallback(() => {
    setStartLongPress(true);
  }, []);

  const stop = useCallback(() => {
    setStartLongPress(false);
  }, []);

  useEffect(() => {
    if (startLongPress) {
      timerRef.current = setTimeout(callback, ms);
    } else {
      clearTimeout(timerRef.current);
    }
    return () => clearTimeout(timerRef.current);
  }, [startLongPress, callback, ms]);

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: start,
    onTouchEnd: stop,
  };
};

export default useLongPress;
