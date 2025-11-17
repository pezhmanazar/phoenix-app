// lib/panahgah/jdate.ts

export type Dateish = number | string | Date;

function toDate(x: Dateish): Date | null {
  if (x instanceof Date) return isNaN(x.getTime()) ? null : x;
  if (typeof x === "number") {
    // اگر ثانیه بود و نه میلی‌ثانیه، ضربدر 1000 کن
    const ms = x < 1e12 ? x * 1000 : x;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof x === "string") {
    const t = Date.parse(x);
    if (!Number.isNaN(t)) {
      const d = new Date(t);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

// --- الگوریتم تبدیل میلادی → جلالی (دقیق و بدون آفست اشتباه) ---
function div(a: number, b: number) {
  return ~~(a / b);
}

function g2j(gy: number, gm: number, gd: number): [number, number, number] {
  // gm: 1..12
  const g_d_m = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gy2 = gy - 1600;
  let gm2 = gm - 1;
  let gd2 = gd - 1;

  let g_day_no =
    365 * gy2 +
    div(gy2 + 3, 4) -
    div(gy2 + 99, 100) +
    div(gy2 + 399, 400);
  for (let i = 0; i < gm2; ++i) g_day_no += g_d_m[i + 1];
  // leap
  if (gm2 > 1 && ((gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0)) g_day_no++;
  g_day_no += gd2;

  let j_day_no = g_day_no - 79;

  const j_np = div(j_day_no, 12053); // 12053 = 33*365 + 8
  j_day_no %= 12053;

  let jy = 979 + 33 * j_np + 4 * div(j_day_no, 1461);
  j_day_no %= 1461;

  if (j_day_no >= 366) {
    jy += div(j_day_no - 1, 365);
    j_day_no = (j_day_no - 1) % 365;
  }

  const jm =
    j_day_no < 186 ? 1 + div(j_day_no, 31) : 7 + div(j_day_no - 186, 30);
  const jd =
    1 +
    (j_day_no < 186 ? j_day_no % 31 : (j_day_no - 186) % 30);

  return [jy, jm, jd];
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

/** تاریخ/ساعت جلالی امن. اگر ورودی نامعتبر باشد «—» برمی‌گرداند. */
export function formatJalali(input: Dateish): string {
  const d = toDate(input);
  if (!d) return "—";

  const gy = d.getFullYear();
  const gm = d.getMonth() + 1; // 1..12
  const gd = d.getDate();
  const [jy, jm, jd] = g2j(gy, gm, gd);

  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  return `${jy}/${pad2(jm)}/${pad2(jd)} - ${hh}:${mm}`;
}