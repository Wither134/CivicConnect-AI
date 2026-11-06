import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  // Enforcing 44px minimum touch target, radius 10px, 600 weight
  const baseClasses =
    'inline-flex items-center justify-center font-semibold rounded-[10px] transition-colors focus:outline-none focus:ring-2 focus:ring-[#B03A0C] focus:ring-offset-1 select-none disabled:opacity-50 disabled:cursor-not-allowed';

  const sizeClasses = {
    sm: 'min-h-[38px] px-3 py-1.5 text-xs',
    md: 'min-h-[44px] px-4 py-2.5 text-sm',
    lg: 'min-h-[50px] px-6 py-3 text-base'
  }[size];

  const variantClasses = {
    primary: 'bg-[#B03A0C] text-white hover:bg-[#962E08] active:bg-[#7D2606] border border-[#B03A0C]',
    outline: 'bg-white text-[#B03A0C] border-[1.5px] border-[#B03A0C] hover:bg-[#FFF1E6]',
    secondary: 'bg-white text-[#1E1B18] border border-[#E9DFD3] hover:bg-[#FBF6EF]',
    danger: 'bg-[#8F1D1D] text-white hover:bg-[#721515] border border-[#8F1D1D]',
    ghost: 'bg-transparent text-[#6A5D52] hover:bg-[#EFE6DA] hover:text-[#1E1B18]'
  }[variant];

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${widthClass} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Processing...
        </span>
      ) : (
        <span className="inline-flex items-center gap-2">
          {icon && <span className="flex-shrink-0">{icon}</span>}
          <span>{children}</span>
        </span>
      )}
    </button>
  );
};

