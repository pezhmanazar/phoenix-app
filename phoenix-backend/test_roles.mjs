// node test_login_roles.mjs
const BASE = process.env.BACKEND_URL?.trim() || "http://127.0.0.1:4000";
const PASSWORD = "Dev!Pheo_2025#R7uY9"; // همونی که در seed گذاشتیم

const users = [
  { role: "owner",   email: "owner@test.com",   password: PASSWORD },
  { role: "manager", email: "manager@test.com", password: PASSWORD },
  { role: "agent",   email: "agent@test.com",   password: PASSWORD },
];

async function login(email, password) {
  const r = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const status = r.status;
  let json = null;
  try { json = await r.json(); } catch {}
  return { status, json };
}

(async () => {
  for (const u of users) {
    const { status, json } = await login(u.email, u.password);
    console.log(`\n=== ${u.role.toUpperCase()} Login (${u.email}) ===`);
    console.log("Status:", status);
    console.log("OK:", !!json?.ok, "Token:", json?.token ? "[RECEIVED]" : "[MISSING]");
    if (!json?.ok) console.log("Error:", json?.error);
  }
})();