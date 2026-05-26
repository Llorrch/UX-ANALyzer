import React, { useState, useEffect } from 'react';
import { X, Minus, Square } from 'lucide-react';

interface WinWindowProps {
  id: string;
  title: string;
  icon?: React.ReactNode;
  isActive: boolean;
  onFocus: () => void;
  onClose: () => void;
  children: React.ReactNode;
  defaultPosition?: { x: number; y: number };
  width?: number | string;
  height?: number | string;
  className?: string;
}

export default function WinWindow({ id, title, icon, isActive, onFocus, onClose, children, defaultPosition = { x: 50, y: 50 }, width = 500, height = 'auto', className = '' }: WinWindowProps) {
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
      className={`absolute flex flex-col bg-win-gray win-border-outset font-win transition-all ${isActive ? 'z-50' : 'z-10'} ${className}`} 
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
        <div className="flex items-center gap-1">
          {icon && <div className="w-3.5 h-3.5 flex items-center justify-center">{icon}</div>}
          <span className="truncate max-w-[180px] sm:max-w-none">{title}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button className="win-btn h-3.5 w-4 font-bold flex items-center justify-center p-0 text-[8px]" style={{padding:0}} disabled><Minus size={10} /></button>
          <button className="win-btn h-3.5 w-4 font-bold flex items-center justify-center p-0 text-[8px]" style={{padding:0}} disabled><Square size={8} strokeWidth={3} /></button>
          <button className="win-btn h-3.5 w-4 font-bold flex items-center justify-center p-0 text-[10px]" style={{padding:0, marginLeft: 2}} onClick={(e) => { e.stopPropagation(); onClose(); }}><X size={10}/></button>
        </div>
      </div>

      {/* Content */}
      <div className="p-2 flex-1 overflow-auto flex flex-col">
        {children}
      </div>
    </div>
  );
}
