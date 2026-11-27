import React from 'react';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  online?: boolean;
}

export function Avatar({ src, name, size = 'md', className = '', online }: AvatarProps) {
  const sizeMap = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl font-bold',
  };

  const getInitials = (n: string) => {
    if (!n) return 'L';
    const parts = n.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return n.slice(0, 2).toUpperCase();
  };

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${sizeMap[size]} rounded-full object-cover border border-neutral-200 shadow-sm`}
        />
      ) : (
        <div
          className={`${sizeMap[size]} rounded-full bg-[#DCFCE7] text-[#15803D] flex items-center justify-center font-bold border border-emerald-200/70`}
        >
          {getInitials(name)}
        </div>
      )}
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 block rounded-full ring-2 ring-white ${
            size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5'
          } ${online ? 'bg-emerald-500' : 'bg-neutral-300'}`}
        />
      )}
    </div>
  );
}
