import React from 'react';
import { cn } from '../lib/utils';
import { Loader2 } from 'lucide-react';

// --- Button ---
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, ...props }, ref) => {
    const variants = {
      primary: 'bg-accent hover:bg-accent-hover text-white shadow-xs',
      secondary: 'bg-secondary text-white hover:bg-gray-800 shadow-xs',
      outline: 'border border-gray-300 bg-white hover:bg-gray-50 text-gray-700',
      ghost: 'hover:bg-gray-100 text-gray-700',
      danger: 'bg-red-600 hover:bg-red-700 text-white',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs',
      md: 'h-10 px-4 py-2',
      lg: 'h-12 px-6 text-lg',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50',
          variants[variant],
          sizes[size],
          className
        )}
        disabled={isLoading || props.disabled}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

// --- Card ---
export const Card = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => (
  <div
    className={cn('rounded-lg border border-gray-200 bg-white text-gray-950 shadow-xs', className)}
  >
    {children}
  </div>
);

export const CardHeader = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => <div className={cn('flex flex-col space-y-1.5 p-6', className)}>{children}</div>;

export const CardTitle = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => <h3 className={cn('font-semibold leading-none tracking-tight', className)}>{children}</h3>;

export const CardContent = ({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) => <div className={cn('p-6 pt-0', className)}>{children}</div>;

// --- Input ---
export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';

// --- Badge ---
export const Badge = ({
  className,
  variant = 'default',
  children,
}: {
  className?: string;
  variant?: 'default' | 'outline' | 'accent';
  children?: React.ReactNode;
}) => {
  const variants = {
    default: 'border-transparent bg-gray-900 text-gray-50 hover:bg-gray-900/80',
    outline: 'text-gray-950 border border-gray-200',
    accent: 'border-transparent bg-accent text-white hover:bg-accent/80',
  };
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-hidden focus:ring-2 focus:ring-gray-950 focus:ring-offset-2',
        variants[variant],
        className
      )}
    >
      {children}
    </div>
  );
};
