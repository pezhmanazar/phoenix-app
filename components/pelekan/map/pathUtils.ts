export type Point = { x: number; y: number };

/**
 * آرایه‌ای از نقاط (مراکز نودها) را می‌گیرد و به‌جای وصل‌کردنشان با خط راست،
 * یک مسیر SVG با منحنی نرم (Catmull-Rom تبدیل‌شده به Cubic Bezier) برمی‌گرداند.
 *
 * این دقیقاً همان چیزی است که برای شکل مارپیچ نرم مثل تصویر مرجع لازم است:
 * بین هر دو نود به‌جای "L x,y" از "C ..." استفاده می‌کند.
 *
 * @param points ترتیب نقاط از بالا به پایین (یا برعکس) روی مسیر
 * @param tension بین 0 تا 1؛ هرچه بیشتر، منحنی نرم‌تر/کِش‌دارتر می‌شود (پیش‌فرض 1 = نرم استاندارد)
 */
export function pointsToSmoothPath(points: Point[], tension = 1): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    // فرمول استاندارد تبدیل Catmull-Rom به نقاط کنترل Cubic Bezier
    const cp1x = p1.x + ((p2.x - p0.x) / 6) * tension;
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * tension;
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * tension;
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * tension;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return d;
}

/**
 * مثال استفاده (به‌جای تابعی که با L مسیر می‌ساخت):
 *
 * const nodePositions: Point[] = [
 *   { x: 180, y: 1080 }, // زیستن (پایین‌ترین نود)
 *   { x: 245, y: 830 },  // ساختن
 *   { x: 385, y: 665 },  // سرشتن
 *   { x: 220, y: 505 },  // سوختن
 *   { x: 385, y: 350 },  // گسستن
 *   { x: 270, y: 195 },  // بستن (بالاترین نود)
 * ];
 *
 * const pathD = pointsToSmoothPath(nodePositions, 1);
 * <PelekanPath pathD={pathD} done={...} idleColor={...} doneColor={...} />
 */
