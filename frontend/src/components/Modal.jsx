import { useEffect } from 'react';
import { Button } from './ui.jsx';
import { IconX } from './icons.jsx';

/** Centered dialog with a close button; Escape and a click outside close it. */
export default function Modal({ title, onClose, wide = false, children, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <Button icon aria-label="Close" onClick={onClose}>
            <IconX size={15} />
          </Button>
        </div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
