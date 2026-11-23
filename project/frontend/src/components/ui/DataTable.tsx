import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  sortable?: boolean;
  align?: 'left' | 'right';
  headerStyle?: CSSProperties;
}

export interface SortState {
  key: string;
  direction: 'asc' | 'desc';
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  ariaLabel: string;
  /** Visible table caption. Without one, the accessible name is visually hidden. */
  caption?: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  toolbar?: ReactNode;
  sort?: SortState;
  onSort?: (key: string) => void;
  onRowClick?: (row: T) => void;
  /** Optional compact card renderer for the mobile card-list alternative. */
  mobileCard?: (row: T) => ReactNode;
  mobileCardTitle?: (row: T) => ReactNode;
  page?: number;
  size?: number;
  totalElements?: number;
  onPageChange?: (page: number) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  ariaLabel,
  caption,
  loading = false,
  loadingLabel,
  toolbar,
  sort,
  onSort,
  onRowClick,
  mobileCard,
  mobileCardTitle,
  page,
  size,
  totalElements,
  onPageChange,
  emptyTitle = 'Nothing here yet',
  emptyDescription = 'Try adjusting your filters or create the first record.',
  emptyAction,
}: DataTableProps<T>) {
  const totalPages = totalElements !== undefined && size ? Math.max(1, Math.ceil(totalElements / size)) : 1;
  const currentPage = page ?? 0;
  const enablePagination = onPageChange && totalElements !== undefined;

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    // A button/link inside a cell owns its own keyboard behaviour; only activate
    // the row when the row itself is the event target.
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      onRowClick?.(row);
    }
  };

  return (
    <section className="card surface data-table-card" aria-label={ariaLabel} aria-busy={loading || undefined}>
      {toolbar && <div className="table-toolbar">{toolbar}</div>}
      {loading && (
        <p className="sr-only" role="status" aria-live="polite">
          {loadingLabel ?? `Loading ${ariaLabel}…`}
        </p>
      )}
      <div className="table-scroll">
        <table className="data-table premium-table" aria-label={ariaLabel}>
          <caption className={caption ? 'table-caption' : 'sr-only'}>{caption ?? ariaLabel}</caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  style={{ textAlign: column.align ?? 'left', ...column.headerStyle }}
                  aria-sort={
                    sort?.key === column.key
                      ? sort.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  {column.sortable && onSort ? (
                    <button type="button" onClick={() => onSort(column.key)}>
                      {column.header}
                      {sort?.key === column.key ? (
                        sort.direction === 'asc' ? (
                          <ArrowUp size={12} aria-hidden="true" />
                        ) : (
                          <ArrowDown size={12} aria-hidden="true" />
                        )
                      ) : (
                        <ArrowUpDown size={12} aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 5 }).map((_, index) => (
                <tr key={`skeleton-${index}`} aria-hidden="true">
                  {columns.map((column) => (
                    <td key={column.key}>
                      <Skeleton height={14} width={index % 2 === 0 ? '65%' : '85%'} />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading &&
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  data-clickable={onRowClick ? 'true' : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (event) => handleRowKeyDown(event, row) : undefined}
                >
                  {columns.map((column) => (
                    <td key={column.key} style={{ textAlign: column.align ?? 'left' }}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="mobile-card-list" role="list" aria-label={`${ariaLabel} card view`}>
        {loading &&
          Array.from({ length: 3 }).map((_, index) => (
            <div className="mobile-card surface" role="listitem" key={`mobile-skeleton-${index}`}>
              <Skeleton width="55%" height={16} />
              <Skeleton height={12} width="85%" />
              <Skeleton height={12} width="65%" />
            </div>
          ))}
        {!loading &&
          rows.map((row) => (
            <article className="mobile-card surface" role="listitem" key={rowKey(row)}>
              {mobileCard ? mobileCard(row) : (
                <>
                  <strong className="task-title">
                    {mobileCardTitle ? mobileCardTitle(row) : columns[0]?.render(row)}
                  </strong>
                  <dl className="mobile-card-fields">
                    {columns.slice(1).map((column) => (
                      <div key={column.key}>
                        <dt>{column.header}</dt>
                        <dd>{column.render(row)}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              )}
              {onRowClick && (
                <button type="button" className="task-cta" onClick={() => onRowClick(row)}>
                  View details <ChevronRight size={15} aria-hidden="true" />
                </button>
              )}
            </article>
          ))}
      </div>

      {!loading && rows.length === 0 && (
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      )}
      {enablePagination && !loading && rows.length > 0 && (
        <footer className="table-footer">
          <span>
            Page {currentPage + 1} of {totalPages} · {totalElements} total
          </span>
          <div className="pagination">
            <button
              type="button"
              className="btn btn-secondary btn-sm btn-icon"
              aria-label="Previous page"
              disabled={currentPage <= 0}
              onClick={() => onPageChange(currentPage - 1)}
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm btn-icon"
              aria-label="Next page"
              disabled={currentPage >= totalPages - 1}
              onClick={() => onPageChange(currentPage + 1)}
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </footer>
      )}
    </section>
  );
}
