import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const variantClasses = {
  primary:   'bg-blue-600 text-white shadow-sm hover:bg-blue-700 hover:shadow-md',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400',
  ghost:     'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  danger:    'bg-rose-600 text-white shadow-sm hover:bg-rose-700',
  success:   'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700',
};

const sizeClasses = {
  sm: 'h-9  px-4  text-xs  gap-1.5',
  md: 'h-10 px-5  text-sm  gap-2',
  lg: 'h-12 px-7  text-sm  gap-2',
};

export default function Button({
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  to,
  href,
  icon,
  loading = false,
  disabled = false,
  ...props
}) {
  const classes = [
    'inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:ring-offset-2 focus:ring-offset-white',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    variantClasses[variant] ?? variantClasses.primary,
    sizeClasses[size]       ?? sizeClasses.md,
    className,
  ].join(' ');

  const inner = (
    <>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children && <span>{children}</span>}
    </>
  );

  const motion$ = {
    whileHover: !disabled && !loading ? { y: -1 } : undefined,
    whileTap:   !disabled && !loading ? { scale: 0.98 } : undefined,
    transition: { duration: 0.14 },
  };

  if (to) return (
    <motion.div {...motion$} style={{ display: 'inline-flex' }}>
      <Link to={to} className={classes} {...props}>{inner}</Link>
    </motion.div>
  );

  if (href) return (
    <motion.a {...motion$} href={href} className={classes} {...props}>{inner}</motion.a>
  );

  return (
    <motion.button
      type="button"
      {...motion$}
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {inner}
    </motion.button>
  );
}
