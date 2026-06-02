import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const variantClasses = {
  primary:   'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-blue-400 hover:shadow-blue-500/35',
  secondary: 'border border-white/10 bg-white/[0.06] text-white hover:bg-white/[0.10] hover:border-white/18',
  ghost:     'bg-transparent text-slate-300 hover:bg-white/[0.06] hover:text-white',
  danger:    'bg-gradient-to-r from-rose-600 to-rose-500 text-white shadow-lg shadow-rose-500/20 hover:shadow-rose-500/35',
  success:   'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-lg shadow-emerald-500/20',
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
    'inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200',
    'focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:ring-offset-0',
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
    whileHover: !disabled && !loading ? { y: -1, scale: 1.01 } : undefined,
    whileTap:   !disabled && !loading ? { scale: 0.98 }         : undefined,
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
