import { NavLink } from 'react-router-dom';
import { HeartPulse, PanelLeftClose, PanelLeftOpen, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { NAV_GROUPS, NAV_ITEMS } from '@/lib/navigation';
import { cx } from '@/lib/utils';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: SidebarProps) {
  const auth = useAuth();
  const visibleItems = NAV_ITEMS.filter((item) => !item.rule || auth.canAccess(item.rule));

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
      <aside className="sidebar" aria-label="Primary navigation">
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
        </div>

        <nav className="sidebar-nav">
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
