// lib/logger.ts
const seen = new Set<string>();

export function logOnce(tag: string, ...args: any[]) {
  if (!__DEV__) return;
  const key = `${tag}:${JSON.stringify(args)}`;
  if (seen.has(key)) return;
  seen.add(key);
  setTimeout(() => seen.delete(key), 1000);
  // @ts-ignore
  console.log(tag, ...args);
}