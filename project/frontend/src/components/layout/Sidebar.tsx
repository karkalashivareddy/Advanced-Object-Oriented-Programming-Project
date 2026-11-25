import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { HeartPulse, PanelLeftClose, PanelLeftOpen, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { NAV_GROUPS, NAV_ITEMS } from '@/lib/navigation';
import { cx } from '@/lib/utils';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: SidebarProps) {
  const auth = useAuth();
  const sidebarRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const visibleItems = NAV_ITEMS.filter((item) => !item.rule || auth.canAccess(item.rule));

  useEffect(() => {
    if (!mobileOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseMobile();
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = sidebarRef.current;
      if (!dialog) return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!dialog.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      // Wait for the scrim/inert background to be removed before restoring focus.
      window.requestAnimationFrame(() => previouslyFocused?.focus());
    };
  }, [mobileOpen, onCloseMobile]);

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={onCloseMobile}
        />
      )}
      <aside
        ref={sidebarRef}
        className="sidebar"
        role={mobileOpen ? 'dialog' : undefined}
        aria-modal={mobileOpen || undefined}
        aria-label={mobileOpen ? 'Navigation menu' : 'Primary navigation'}
      >
        <div className="sidebar-brand">
          <span className="brand-mark">
            <HeartPulse size={19} aria-hidden="true" />
          </span>
          <span>
            <span className="brand-name">LifeLink</span>
            <span className="brand-subtitle" style={{ display: 'block' }}>
              Blood network
            </span>
          </span>
          <button
            ref={closeRef}
            type="button"
            className="btn btn-ghost btn-icon sidebar-mobile-close"
            aria-label="Close navigation menu"
            onClick={onCloseMobile}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Sections">
          {NAV_GROUPS.map((group) => {
            const items = visibleItems.filter((item) => item.group === group);
            if (items.length === 0) return null;
            return (
              <div className="nav-group" key={group}>
                <div className="nav-group-label">{group}</div>
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                      end={item.to === '/app/donors'}
                    title={item.label}
                    className={({ isActive }) => cx('nav-link', isActive && 'active')}
                    onClick={onCloseMobile}
                  >
                    <item.icon size={18} aria-hidden="true" />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="sidebar-collapse" onClick={onToggleCollapse}>
            {collapsed ? (
              <PanelLeftOpen size={18} aria-hidden="true" />
            ) : (
              <PanelLeftClose size={18} aria-hidden="true" />
            )}
            <span>{collapsed ? 'Expand' : 'Collapse'} sidebar</span>
          </button>
          <p
            className="text-xs text-subtle"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px 2px' }}
          >
            <ShieldCheck size={13} aria-hidden="true" /> Server-side authorization enforced
          </p>
        </div>
      </aside>
    </>
  );
}
