import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { ChevronDown, Info, LogOut, Menu, Search, Settings2, UserRound } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { dur, ease } from '@/lib/motion';
import { NAV_ITEMS } from '@/lib/navigation';
import { useReducedMotion } from '@/lib/useReducedMotion';
import { initials } from '@/lib/utils';
import { api } from '@/lib/api';
import { NotificationCenter } from './NotificationCenter';
import { OrganizationSwitcher } from './OrganizationSwitcher';

interface TopbarProps {
  onOpenMobileMenu: () => void;
}

export function Topbar({ onOpenMobileMenu }: TopbarProps) {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const reduced = useReducedMotion();
  const identityId = useId();
  const topbarRef = useRef<HTMLElement | null>(null);
  const runtimeMode = useQuery({
    queryKey: ['runtime', 'mode'],
    queryFn: () => api.get<{ demoDataEnabled: boolean }>('/runtime/mode'),
    staleTime: 60_000,
    retry: false,
  });
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const userRef = useRef<HTMLDivElement | null>(null);
  const userTriggerRef = useRef<HTMLButtonElement | null>(null);

  const suggestions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return NAV_ITEMS.filter(
      (item) =>
        auth.canAccess(item.rule ?? {}) &&
        (item.label.toLowerCase().includes(term) || item.description.toLowerCase().includes(term)),
    ).slice(0, 5);
  }, [search, auth]);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) setSearchOpen(false);
      if (!userRef.current?.contains(event.target as Node)) setUserOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (userOpen) {
        setUserOpen(false);
        userTriggerRef.current?.focus();
      } else if (searchOpen) {
        setSearchOpen(false);
        searchInputRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [userOpen, searchOpen]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    if (suggestions[0]) {
      navigate(suggestions[0].to);
      setSearch('');
      setSearchOpen(false);
    }
  };

  const currentSection = NAV_ITEMS
    .filter((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`))
    .sort((left, right) => right.to.length - left.to.length)[0];

  return (
    <header className="topbar" ref={topbarRef}>
      <button
        type="button"
        className="btn btn-ghost btn-icon mobile-menu-button"
        aria-label="Open navigation menu"
        onClick={onOpenMobileMenu}
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link to="/app/dashboard">Workspace</Link>
        <span aria-hidden="true">/</span>
        <strong>{currentSection?.label ?? 'Dashboard'}</strong>
      </nav>

      <div
        className="topbar-search"
        ref={searchRef}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setSearchOpen(false);
        }}
      >
        <form onSubmit={submitSearch} role="search">
          <div className="search-input-wrap">
            <Search size={15} aria-hidden="true" />
            <input
              ref={searchInputRef}
              className="input"
              type="search"
              aria-label="Search sections"
              placeholder="Search sections…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
            />
          </div>
        </form>
        {searchOpen && search.trim() !== '' && (
          <nav className="popover" aria-label="Section results">
            {suggestions.length === 0 ? (
              <p className="card-pad text-muted text-sm">No matching section.</p>
            ) : (
              suggestions.map((item) => (
                <button
                  key={item.to}
                  type="button"
                  className="popover-item"
                  onClick={() => {
                    navigate(item.to);
                    setSearch('');
                    setSearchOpen(false);
                  }}
                >
                  <strong>{item.label}</strong>
                  <span>{item.description}</span>
                </button>
              ))
            )}
          </nav>
        )}
      </div>

      <div className="topbar-actions">
        <span className="demo-data-flag-slot" data-pending={runtimeMode.isPending ? 'true' : undefined}>
          {runtimeMode.data?.demoDataEnabled && (
            <span className="demo-data-flag" role="status" aria-label="DEMO DATA — NOT LIVE BLOOD AVAILABILITY">
              <Info size={13} aria-hidden="true" />
              <span className="demo-data-flag__full">DEMO DATA · NOT LIVE BLOOD AVAILABILITY</span>
              <span className="demo-data-flag__compact" aria-hidden="true">DEMO · NOT LIVE</span>
            </span>
          )}
        </span>
        <OrganizationSwitcher />
        <span className="topbar-divider" aria-hidden="true" />
        {reduced ? (
          <NotificationCenter />
        ) : (
          <motion.div
            className="topbar-notification-host"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: dur.fast, ease: ease.out }}
          >
            <NotificationCenter />
          </motion.div>
        )}
        <div className="menu-anchor" ref={userRef}>
          <div className="user-trigger-shell" onClick={() => setUserOpen((current) => !current)}>
            <span className="avatar">{initials(auth.user?.fullName)}</span>
            <span className="user-trigger-meta" id={identityId}>
              <strong>{auth.user?.fullName ?? 'Account'}</strong>
              <small>{auth.user?.email ?? ''}</small>
            </span>
            <ChevronDown className="user-trigger-chevron" size={14} aria-hidden="true" />
            <button
              ref={userTriggerRef}
              type="button"
              className="user-trigger"
              aria-label="Open user menu"
              aria-describedby={identityId}
              aria-expanded={userOpen}
              aria-haspopup="menu"
            />
          </div>
          {userOpen && (
            <div
              className="popover"
              role="menu"
              aria-label="User menu"
              onBlur={(event) => {
                // Tab/Shift+Tab move through the menu items normally; the
                // popover closes once focus leaves it. Escape is handled by
                // the document listener, which restores focus to the trigger.
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setUserOpen(false);
              }}
            >
              <div className="popover-header">
                <span>
                  <strong>{auth.user?.fullName}</strong>
                  <br />
                  <small className="text-muted">{auth.user?.email}</small>
                </span>
              </div>
              <button
                type="button"
                role="menuitem"
                className="popover-item"
                onClick={() => {
                  setUserOpen(false);
                  navigate('/app/profile');
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <UserRound size={14} aria-hidden="true" /> Profile
                </span>
              </button>
              {auth.canAccess({ permissions: ['ORGANIZATION_READ', 'ORGANIZATION_MANAGE'] }) && (
                <button
                  type="button"
                  role="menuitem"
                  className="popover-item"
                  onClick={() => {
                    setUserOpen(false);
                    navigate('/app/admin/organizations');
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Settings2 size={14} aria-hidden="true" /> Organizations
                  </span>
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                className="popover-item"
                onClick={() => void auth.logout()}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-accent)' }}>
                  <LogOut size={14} aria-hidden="true" /> Sign out
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
