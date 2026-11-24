import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { RealtimeNotificationsBridge } from '@/lib/useRealtimeNotifications';
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
  const mainRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // `inert` is best-effort: browsers without support simply ignore the attribute.
  useEffect(() => {
    mainRef.current?.toggleAttribute('inert', mobileOpen);
    return () => mainRef.current?.removeAttribute('inert');
  }, [mobileOpen]);

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

  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const openMobile = useCallback(() => setMobileOpen(true), []);

  return (
    <div className={cx('app-shell', collapsed && 'is-collapsed', mobileOpen && 'is-mobile-open')}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <RealtimeNotificationsBridge />
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={closeMobile}
      />
      <div className="main-column" ref={mainRef}>
        <Topbar onOpenMobileMenu={openMobile} />
        <main className="app-content" id="main-content">
          <div className="app-content-inner">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
