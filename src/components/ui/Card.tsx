import React from 'react';

export function Card({
  children,
  className = '',
  id,
  hover = false,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
  hover?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      id={id}
      onClick={onClick}
      className={`rounded-3xl border border-slate-200/75 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] ${
        hover ? 'hover:shadow-md hover:border-slate-300/90 transition-all duration-200' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-3xl border border-dashed border-slate-200 bg-white">
      <div className="w-12 h-12 rounded-2xl bg-[#E8F8EE] text-[#15803D] flex items-center justify-center mb-3">
        {icon}
      </div>
      <h4 className="text-base font-bold text-zinc-900">{title}</h4>
      <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
