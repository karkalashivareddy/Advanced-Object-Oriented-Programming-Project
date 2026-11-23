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
  loading?: boolean;
  toolbar?: ReactNode;
  sort?: SortState;
  onSort?: (key: string) => void;
  onRowClick?: (row: T) => void;
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
  loading = false,
  toolbar,
  sort,
  onSort,
  onRowClick,
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
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onRowClick?.(row);
    }
  };

  return (
    <section className="card" aria-label={ariaLabel}>
      {toolbar && <div className="table-toolbar">{toolbar}</div>}
      <div className="table-scroll">
        <table className="data-table">
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
                <tr key={`skeleton-${index}`}>
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
        {!loading && rows.length === 0 && (
          <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
        )}
      </div>
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
