export type PaginationToken = { kind: 'page'; n: number } | { kind: 'gap' };

export type PaginationPage = {
  pageIndex: number;
  totalPages: number;
  itemCount: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export function showingFrom(page: PaginationPage, pageSize: number): number {
  if (page.itemCount === 0) {
    return 0;
  }

  return (page.pageIndex - 1) * pageSize + 1;
}

export function showingTo(page: PaginationPage, pageSize: number): number {
  return showingFrom(page, pageSize) + page.itemCount - 1;
}

export function paginationTokens(pageIndex: number, totalPages: number): PaginationToken[] {
  if (totalPages <= 1) {
    return [];
  }

  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => ({ kind: 'page', n: index + 1 }));
  }

  const pages = new Set<number>([1, totalPages, pageIndex]);
  if (pageIndex > 1) {
    pages.add(pageIndex - 1);
  }
  if (pageIndex < totalPages) {
    pages.add(pageIndex + 1);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const tokens: PaginationToken[] = [];

  for (let index = 0; index < sorted.length; index += 1) {
    const pageNumber = sorted[index];
    const previous = sorted[index - 1];
    if (previous !== undefined && pageNumber - previous > 1) {
      tokens.push({ kind: 'gap' });
    }
    tokens.push({ kind: 'page', n: pageNumber });
  }

  return tokens;
}

export function toPaginationPage(page: {
  pageIndex: number;
  totalPages: number;
  items: readonly unknown[];
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}): PaginationPage {
  return {
    pageIndex: page.pageIndex,
    totalPages: page.totalPages,
    itemCount: page.items.length,
    hasPreviousPage: page.hasPreviousPage,
    hasNextPage: page.hasNextPage,
  };
}
