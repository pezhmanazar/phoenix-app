// types/jalaali-js.d.ts
declare module "jalaali-js" {
  export interface JalaaliDate {
    jy: number;
    jm: number;
    jd: number;
  }

  // همون چیزی که تو کد استفاده می‌کنی
  export function toJalaali(
    date: Date | number | string
  ): JalaaliDate;

  // اگر جایی خواستی برگردونی به میلادی هم این رو داری
  export function toGregorian(
    jy: number,
    jm: number,
    jd: number
  ): { gy: number; gm: number; gd: number };
}