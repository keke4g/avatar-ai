export async function measureExecution<T>(fn: () => Promise<T>): Promise<{ result: T; executionTime: number }> {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  return { result, executionTime: Math.round(end - start) };
}
