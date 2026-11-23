import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, LogOut, Menu, Search, Settings2, UserRound } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { NAV_ITEMS } from '@/lib/navigation';
import { initials } from '@/lib/utils';
import { NotificationCenter } from './NotificationCenter';
import { OrganizationSwitcher } from './OrganizationSwitcher';

interface TopbarProps {
  onOpenMobileMenu: () => void;
}

export function Topbar({ onOpenMobileMenu }: TopbarProps) {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
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

  const currentSection = NAV_ITEMS.find((item) => location.pathname.startsWith(item.to));

  return (
    <header className="topbar">
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
        <OrganizationSwitcher />
        <span className="topbar-divider" aria-hidden="true" />
        <NotificationCenter />
        <div className="menu-anchor" ref={userRef}>
          <button
            ref={userTriggerRef}
            type="button"
            className="user-trigger"
            aria-label="Open user menu"
            aria-expanded={userOpen}
            aria-haspopup="menu"
            onClick={() => setUserOpen((current) => !current)}
          >
            <span className="avatar">{initials(auth.user?.fullName)}</span>
            <span>
              <strong>{auth.user?.fullName ?? 'Account'}</strong>
              <small>{auth.user?.email ?? ''}</small>
            </span>
            <ChevronDown size={14} aria-hidden="true" />
          </button>
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
