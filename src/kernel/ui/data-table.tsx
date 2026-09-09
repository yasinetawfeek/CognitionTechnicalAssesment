import Link from "next/link";
import type { ReactNode } from "react";
import { cn, EmptyState } from "./primitives";

/**
 * Server-rendered data table. Pagination / search state lives in the URL so pages stay simple
 * React Server Components:
 *
 *   const { page, pageSize, q } = tableParams(await searchParams);
 *   <DataTable rows={rows} columns={[...]} rowKey={(r) => r.id} pagination={{ page, pageSize, total }} />
 */

export interface Column<Row> {
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  className?: string;
  align?: "left" | "right";
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
}

export function DataTable<Row>({
  rows,
  columns,
  rowKey,
  pagination,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  dense,
  rowHref,
}: {
  rows: Row[];
  columns: Column<Row>[];
  rowKey: (row: Row) => string;
  pagination?: PaginationInfo;
  emptyTitle?: ReactNode;
  emptyDescription?: ReactNode;
  dense?: boolean;
  rowHref?: (row: Row) => string;
}) {
  if (rows.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-bg text-left text-xs font-medium uppercase tracking-wide text-muted">
            <tr>
              {columns.map((c, i) => (
                <th key={i} className={cn("px-4 py-2.5 font-medium", c.align === "right" && "text-right", c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={rowKey(row)} className={cn("hover:bg-bg/60", rowHref && "relative")}>
                {columns.map((c, i) => (
                  <td key={i} className={cn(dense ? "px-4 py-1.5" : "px-4 py-2.5", c.align === "right" && "text-right", c.className)}>
                    {i === 0 && rowHref ? (
                      <Link href={rowHref(row)} className="text-primary hover:underline">
                        {c.cell(row)}
                      </Link>
                    ) : (
                      c.cell(row)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pagination && <Pagination {...pagination} />}
    </div>
  );
}

export function Pagination({ page, pageSize, total }: PaginationInfo) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted">
      <span>
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        <PageLink page={page - 1} disabled={page <= 1}>
          Previous
        </PageLink>
        <span className="px-2">
          Page {page} / {pages}
        </span>
        <PageLink page={page + 1} disabled={page >= pages}>
          Next
        </PageLink>
      </div>
    </div>
  );
}

function PageLink({ page, disabled, children }: { page: number; disabled: boolean; children: ReactNode }) {
  if (disabled) return <span className="rounded px-2 py-1 opacity-40">{children}</span>;
  return (
    <Link href={`?page=${page}`} className="rounded px-2 py-1 hover:bg-bg" scroll={false}>
      {children}
    </Link>
  );
}

export type SearchParams = Record<string, string | string[] | undefined>;

export function tableParams(sp: SearchParams, defaults?: { pageSize?: number }) {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const page = Math.max(1, Number(first(sp.page)) || 1);
  const pageSize = Math.min(100, Number(first(sp.pageSize)) || defaults?.pageSize || 25);
  const q = (first(sp.q) ?? "").trim();
  return { page, pageSize, q, skip: (page - 1) * pageSize, take: pageSize, get: (k: string) => first(sp[k]) };
}
