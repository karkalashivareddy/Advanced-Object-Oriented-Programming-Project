import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Building2, Check, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui';
import { cx } from '@/lib/utils';
import type { OrganizationMembership } from '@/types/domain';

/** Real organization scope control: every choice updates the API header and caches. */
export function OrganizationSwitcher() {
  const auth = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const memberships: OrganizationMembership[] = auth.user?.memberships ?? [];
  const canWorkUnscoped = auth.hasRole('PLATFORM_ADMIN');
  const active = memberships.find(
    (membership) => membership.organizationId === auth.organizationId,
  );
  const activeName = auth.organizationId === null
    ? 'Unscoped'
    : active?.organizationName ?? (memberships.length ? 'Choose organization' : 'Unscoped');

  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    optionRefs.current[0]?.focus();
    const handleOutside = (event: MouseEvent) => {
      if (!anchorRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const handleListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') {
      return;
    }
    event.preventDefault();
    const options = optionRefs.current.filter((option): option is HTMLButtonElement => Boolean(option));
    if (options.length === 0) return;
    const current = options.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? options.length - 1
          : event.key === 'ArrowDown'
            ? (current + 1) % options.length
            : (current - 1 + options.length) % options.length;
    options[next]?.focus();
  };

  const choose = (id: number | null) => {
    close(true);
    try {
      auth.selectOrganization(id);
    } catch (error) {
      toast.error('Could not switch organization', error instanceof Error ? error.message : undefined);
    }
  };

  return (
    <div className="menu-anchor org-switcher" ref={anchorRef}>
      <button
        ref={triggerRef}
        id="organization-switcher"
        type="button"
        className="org-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="organization-options"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="scope-indicator" aria-hidden="true" />
        <Building2 size={16} aria-hidden="true" />
        <span className="org-trigger-text">
          <small className="scope-label">Scope</small>{' '}
          <strong className="scope-name">{activeName}</strong>
        </span>
        <span className="sr-only">Active organization. Change organization</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {open && (
        <div
          className="popover org-popover"
          id="organization-options"
          role="listbox"
          aria-label="Active organization"
          onKeyDown={handleListKeyDown}
          onBlur={(event) => {
            // Tab advances through the options normally; close only when
            // focus has left the whole popover. Escape still restores focus.
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
          }}
        >
          <div className="popover-header">
            <span>Organization scope</span>
            <span className="text-muted text-xs">
              {memberships.length + (canWorkUnscoped ? 1 : 0)} available
            </span>
          </div>
          <div className="popover-list">
            {canWorkUnscoped && (
              <button
                ref={(element) => {
                  optionRefs.current[0] = element;
                }}
                type="button"
                role="option"
                aria-selected={auth.organizationId === null}
                className={cx('popover-item', 'org-option', auth.organizationId === null && 'is-selected')}
                onClick={() => choose(null)}
              >
                <span className="org-option-name">
                  <strong>Unscoped</strong>
                  <span>Platform view · no organization header</span>
                </span>
                {auth.organizationId === null && <Check size={16} aria-hidden="true" />}
              </button>
            )}
            {!canWorkUnscoped && memberships.length === 0 && (
              <p className="card-pad text-muted text-sm">No organization memberships are available.</p>
            )}
            {memberships.map((membership, index) => {
              const selected = membership.organizationId === auth.organizationId;
              const optionIndex = index + (canWorkUnscoped ? 1 : 0);
              return (
                <button
                  key={membership.organizationId}
                  ref={(element) => {
                    optionRefs.current[optionIndex] = element;
                  }}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={cx('popover-item', 'org-option', selected && 'is-selected')}
                  onClick={() => choose(membership.organizationId)}
                >
                  <span className="org-option-name">
                    <strong>{membership.organizationName}</strong>
                    <span>Organization #{membership.organizationId} · {membership.role.replaceAll('_', ' ').toLowerCase()}</span>
                  </span>
                  {selected && <Check size={16} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
          <div className="popover-footer text-muted text-xs">
            Switching reloads data for the selected organization.
          </div>
        </div>
      )}
    </div>
  );
}
