import React from 'react';

const GlassCard = ({ children, className = '' }) => {
  return (
    <div className={`glass-card p-4 transition-all duration-300 active:scale-[0.98] ${className}`}>
      {children}
    </div>
  );
};

export default GlassCard;
