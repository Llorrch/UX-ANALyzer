import React, { useState, useEffect } from 'react';
import { X, Minus, Square } from 'lucide-react';

interface WinWindowProps {
  id: string;
  title: string;
  icon?: React.ReactNode;
  isActive: boolean;
  onFocus: () => void;
  onClose: () => void;
  onMinimize?: () => void;
  children: React.ReactNode;
  defaultPosition?: { x: number; y: number };
  width?: number | string;
  height?: number | string;
  className?: string;
}

export default function WinWindow({ id, title, icon, isActive, onFocus, onClose, onMinimize, children, defaultPosition = { x: 50, y: 50 }, width = 500, height = 'auto', className = '' }: WinWindowProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return (
    <div 
      className={`absolute flex flex-col xp-window font-win transition-all ${isActive ? 'z-50 xp-window-active' : 'z-10 xp-window-inactive'} ${className}`} 
      style={isMobile ? {
        left: '4px',
        top: '4px',
        width: 'calc(100% - 8px)',
        height: 'calc(100% - 8px)',
        maxHeight: '100%',
      } : { 
        left: defaultPosition.x, 
        top: defaultPosition.y, 
        width: width, 
        height: height,
        maxHeight: 'calc(100vh - 60px)',
      }}
      onMouseDown={onFocus}
      onTouchStart={onFocus}
    >
      {/* Title bar */}
      <div className={`win-titlebar ${!isActive ? 'inactive' : ''}`}>
        <div className="flex items-center gap-1.5 font-bold tracking-wide text-[12px]">
          {icon && <div className="w-4 h-4 flex items-center justify-center scale-110 shrink-0">{icon}</div>}
          <span className="truncate max-w-[180px] sm:max-w-none text-white drop-shadow-md">{title}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button 
            type="button"
            className="xp-btn-min shrink-0" 
            onClick={(e) => { e.stopPropagation(); onMinimize?.(); }}
            title="Minimizar"
          >
            <Minus size={11} strokeWidth={3} />
          </button>
          <button type="button" className="xp-btn-max shrink-0" disabled>
            <Square size={9} strokeWidth={3} />
          </button>
          <button 
            type="button" 
            className="xp-btn-close shrink-0" 
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            title="Cerrar"
          >
            <X size={11} strokeWidth={3} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-2 flex-1 overflow-auto flex flex-col">
        {children}
      </div>
    </div>
  );
}
