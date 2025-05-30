// Utility for safe JSON parsing
export function safeJsonParse<T>(value: string | null): T | null {
    if (!value) return null;
    try {
        return JSON.parse(value) as T;
    } catch {
        return null;
    }
}

export function normalizeKey(str: string) {
    return str.trim().toLowerCase();
}

// Concurrency limiter utility
export async function mapWithConcurrency<T, R>(
  arr: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let current = 0;
  const workers = new Array(limit).fill(0).map(async () => {
    for (;;) {
      const idx = current;
      if (idx >= arr.length) break;
      current++;
      const result = await fn(arr[idx] as T, idx);
      results[idx] = result;
    }
  });
  await Promise.all(workers);
  return results;
} 