// services/planStatus.js
export function isUserPro(user) {
  if (!user) return false;
  const plan = user.plan; // 'free' | 'pro' | 'vip' | null
  const expiresAt = user.planExpiresAt ? new Date(user.planExpiresAt) : null;
  const now = new Date();

  const isExpired =
    expiresAt &&
    !Number.isNaN(expiresAt.getTime()) &&
    expiresAt.getTime() < now.getTime();

  return (plan === "pro" || plan === "vip") && !isExpired;
}