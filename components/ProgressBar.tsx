import React from 'react';

interface ProgressBarProps {
  current: number;
  total: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ current, total }) => {
  const percentage = Math.min(100, Math.max(0, (current / total) * 100));

  return (
    <div className="w-full bg-white px-5 py-3 rounded-full border border-slate-200 shadow-sm flex items-center gap-4">
      <span className="text-sm font-bold text-slate-500 whitespace-nowrap hidden sm:block">
        Tu avance
      </span>
      
      <div className="flex-grow bg-slate-100 rounded-full h-3 overflow-hidden shadow-inner">
        <div 
          className="bg-blue-500 h-full rounded-full transition-all duration-700 ease-out" 
          style={{ width: `${percentage}%` }}
        >
        </div>
      </div>
      
      <span className="text-sm font-extrabold text-blue-700 whitespace-nowrap min-w-[3rem] text-right">
        {current} / {total}
      </span>
    </div>
  );
};

export default ProgressBar;