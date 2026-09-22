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
      className={`rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-xs ${
        hover ? 'hover:shadow-md hover:border-neutral-300 transition-all duration-200' : ''
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
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/50">
      <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
        {icon}
      </div>
      <h4 className="text-base font-semibold text-neutral-800">{title}</h4>
      <p className="mt-1 text-sm text-neutral-500 max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
