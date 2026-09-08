import { IconChevronDown } from './icons.jsx';

export function Badge({ variant = '', dot = false, children, className = '', ...rest }) {
  const cls = ['badge', variant && `badge-${variant}`, className].filter(Boolean).join(' ');
  return (
    <span className={cls} {...rest}>
      {dot && <i className="badge-dot" />}
      {children}
    </span>
  );
}

export function Button({ variant = 'ghost', size, icon = false, className = '', children, ...rest }) {
  const cls = [
    'btn',
    variant && `btn-${variant}`,
    size === 'sm' && 'btn-sm',
    icon && 'btn-icon',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}

/** A styled display-select: a chip that shows label + value, with a real
 *  <select> layered on top for keyboard/native picking. */
export function Select({ label, value, options, onChange, style, className = '' }) {
  return (
    <div className={`select ${className}`} style={style}>
      {label && <span className="lbl">{label}</span>}
      <span>{options.find((o) => o.value === value)?.label ?? value}</span>
      <IconChevronDown size={14} sw={2} />
      <select
        className="native"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        aria-label={label || 'Select'}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Switch({ checked, onChange, ...rest }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`switch${checked ? ' on' : ''}`}
      onClick={() => onChange?.(!checked)}
      {...rest}
    />
  );
}

export function Progress({ value, thin = false }) {
  return (
    <div className={`progress${thin ? ' thin' : ''}`}>
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
