import React, { useEffect, useState } from 'react';

interface Option {
  value: string;
  label: string;
}

interface SlidingSegmentControlProps {
  options: Option[];
  activeValue: string;
  onChange: (value: any) => void;
  className?: string;
  activeColor?: string;
}

export const SlidingSegmentControl: React.FC<SlidingSegmentControlProps> = ({
  options,
  activeValue,
  onChange,
  className = '',
  activeColor = '#138C7E',
}) => {
  const activeIndex = options.findIndex((opt) => opt.value === activeValue);
  const widthPercent = 100 / options.length;
  
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return (
    <div 
      className={`relative inline-flex bg-[#0D1714] border border-[#138C7E]/15 p-1 rounded-full select-none ${className}`}
      style={{ isolation: 'isolate' }}
    >
      {/* Sliding background pill */}
      <div
        className="absolute top-1 bottom-1 rounded-full"
        style={{
          width: `calc(${widthPercent}% - 8px)`,
          left: `calc(4px + ${activeIndex * widthPercent}%)`,
          transition: reducedMotion ? 'none' : 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          background: activeColor,
        }}
      />
      {options.map((opt) => {
        const isActive = opt.value === activeValue;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`relative z-10 flex-1 py-2 text-center rounded-full text-xs font-bold cursor-pointer transition-colors duration-200 ${
              isActive ? 'text-[#050F0D] font-extrabold' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
};
