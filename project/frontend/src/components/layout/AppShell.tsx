import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { cx } from '@/lib/utils';

const COLLAPSE_KEY = 'lifelink.sidebarCollapsed';

function readCollapsed(): boolean {
  try {
    return sessionStorage.getItem(COLLAPSE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const toggleCollapse = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        sessionStorage.setItem(COLLAPSE_KEY, String(next));
      } catch {
        /* preference is best-effort */
      }
      return next;
    });
  };

  return (
    <div className={cx('app-shell', collapsed && 'is-collapsed', mobileOpen && 'is-mobile-open')}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="main-column">
        <Topbar onOpenMobileMenu={() => setMobileOpen(true)} />
        <main className="app-content" id="main-content">
          <div className="app-content-inner">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
