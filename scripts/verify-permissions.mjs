/**
 * End-to-end check that the database - not the UI - enforces the permission
 * model. Talks straight to the Supabase REST API with real access tokens,
 * bypassing the Next.js app entirely, which is exactly what an attacker with
 * the public anon key would do.
 *
 *   npm run verify:permissions
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY and the seed
 * account credentials from .env.local.
 */
// @next/env is CommonJS, so import the default and destructure.
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const API = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ADMIN = { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD };
const VIEWER = { email: process.env.VIEWER_EMAIL, password: process.env.VIEWER_PASSWORD };
const pass = [], fail = [];

async function req(path, { token, method = "GET", body, prefer } = {}) {
  const headers = { apikey: ANON, "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${API}${path}`, { method, headers, body: body && JSON.stringify(body) });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

async function login(email, password) {
  const r = await req("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } });
  if (!r.json.access_token) throw new Error("login failed: " + JSON.stringify(r.json));
  return r.json.access_token;
}

function check(name, ok, detail) {
  (ok ? pass : fail).push(name);
  console.log(`${ok ? "  PASS" : "  FAIL"}  ${name}${ok ? "" : "  -> " + detail}`);
}

const admin = await login(ADMIN.email, ADMIN.password);
const viewer = await login(VIEWER.email, VIEWER.password);

const items = (await req("/rest/v1/items?select=id,name,quantity,category_id", { token: admin })).json;
const biscuits = items.find(i => i.name === "Biscuits");
const catId = biscuits.category_id;

console.log("\n--- READ ACCESS ---");
check("admin reads items", Array.isArray(items) && items.length === 6, JSON.stringify(items));
const vr = await req("/rest/v1/items?select=name", { token: viewer });
check("viewer reads items", Array.isArray(vr.json) && vr.json.length === 6, JSON.stringify(vr.json));
const anonRead = await req("/rest/v1/items?select=name");
check("anonymous CANNOT read items", !Array.isArray(anonRead.json), JSON.stringify(anonRead.json));

console.log("\n--- VIEWER WRITE ATTEMPTS (all must be denied) ---");
const vIns = await req("/rest/v1/items", { token: viewer, method: "POST", prefer: "return=representation",
  body: { name: "Hacked", category_id: catId, quantity: 9, unit: "x" } });
check("viewer CANNOT insert item", vIns.status >= 400, `status ${vIns.status} ${JSON.stringify(vIns.json)}`);

const vUpd = await req(`/rest/v1/items?id=eq.${biscuits.id}`, { token: viewer, method: "PATCH",
  prefer: "return=representation", body: { quantity: 999 } });
check("viewer CANNOT update quantity", vUpd.status >= 400 || (Array.isArray(vUpd.json) && vUpd.json.length === 0),
  `status ${vUpd.status} ${JSON.stringify(vUpd.json)}`);

const vDel = await req(`/rest/v1/items?id=eq.${biscuits.id}`, { token: viewer, method: "DELETE", prefer: "return=representation" });
check("viewer CANNOT delete item", vDel.status >= 400 || (Array.isArray(vDel.json) && vDel.json.length === 0),
  `status ${vDel.status} ${JSON.stringify(vDel.json)}`);

const vRpc = await req("/rest/v1/rpc/adjust_item_quantity", { token: viewer, method: "POST",
  body: { p_item_id: biscuits.id, p_delta: -1 } });
check("viewer CANNOT use adjust_item_quantity RPC", vRpc.status >= 400, `status ${vRpc.status} ${JSON.stringify(vRpc.json)}`);

const vCat = await req("/rest/v1/categories", { token: viewer, method: "POST", prefer: "return=representation",
  body: { name: "Viewer Category" } });
check("viewer CANNOT create category", vCat.status >= 400, `status ${vCat.status} ${JSON.stringify(vCat.json)}`);

const vProm = await req(`/rest/v1/profiles?email=eq.${encodeURIComponent(VIEWER.email)}`, { token: viewer, method: "PATCH",
  prefer: "return=representation", body: { role: "admin" } });
check("viewer CANNOT promote self to admin", vProm.status >= 400 || (Array.isArray(vProm.json) && vProm.json.length === 0),
  `status ${vProm.status} ${JSON.stringify(vProm.json)}`);

const vLog = await req("/rest/v1/activity_logs", { token: viewer, method: "POST", body: { item_name: "Fake", action: "created" } });
check("viewer CANNOT forge activity log", vLog.status >= 400, `status ${vLog.status} ${JSON.stringify(vLog.json)}`);

const vSet = await req("/rest/v1/app_settings?key=eq.low_stock_threshold", { token: viewer, method: "PATCH",
  prefer: "return=representation", body: { value: 99 } });
check("viewer CANNOT change settings", vSet.status >= 400 || (Array.isArray(vSet.json) && vSet.json.length === 0),
  `status ${vSet.status} ${JSON.stringify(vSet.json)}`);

const stillOk = (await req(`/rest/v1/items?select=quantity&id=eq.${biscuits.id}`, { token: admin })).json;
check("Biscuits quantity untouched after all attempts", stillOk[0]?.quantity === 2, JSON.stringify(stillOk));

console.log("\n--- ADMIN WRITE (must succeed) ---");
const aRpc = await req("/rest/v1/rpc/adjust_item_quantity", { token: admin, method: "POST",
  body: { p_item_id: biscuits.id, p_delta: -1 } });
check("admin can decrement", aRpc.json?.quantity === 1, JSON.stringify(aRpc.json));

console.log("\n--- QUANTITY / STATUS RULES ---");
await req("/rest/v1/rpc/adjust_item_quantity", { token: admin, method: "POST", body: { p_item_id: biscuits.id, p_delta: -1 } });
let q = (await req(`/rest/v1/items?select=quantity&id=eq.${biscuits.id}`, { token: admin })).json[0].quantity;
check("reaching 0 => Finished", q === 0, `quantity=${q}`);

const clamp = await req("/rest/v1/rpc/adjust_item_quantity", { token: admin, method: "POST", body: { p_item_id: biscuits.id, p_delta: -1 } });
check("cannot go negative (clamped at 0)", clamp.json?.quantity === 0, JSON.stringify(clamp.json));

const neg = await req(`/rest/v1/items?id=eq.${biscuits.id}`, { token: admin, method: "PATCH",
  prefer: "return=representation", body: { quantity: -5 } });
check("direct negative write rejected by CHECK constraint", neg.status >= 400, `status ${neg.status} ${JSON.stringify(neg.json)}`);

const revive = await req("/rest/v1/rpc/adjust_item_quantity", { token: admin, method: "POST", body: { p_item_id: biscuits.id, p_delta: 1 } });
check("0 -> 1 becomes Available again", revive.json?.quantity === 1, JSON.stringify(revive.json));

console.log("\n--- CATEGORY DELETE PROTECTION ---");
const inUse = await req("/rest/v1/rpc/delete_category", { token: admin, method: "POST", body: { p_category_id: catId } });
check("cannot delete a category still in use", inUse.status >= 400, `status ${inUse.status} ${JSON.stringify(inUse.json)}`);

console.log("\n--- ACTIVITY LOG AUTO-RECORDED ---");
const logs = (await req("/rest/v1/activity_logs?select=action,item_name,old_value,new_value,user_id&order=created_at.desc&limit=5", { token: admin })).json;
const qc = logs.find(l => l.action === "quantity_changed");
check("quantity change was logged with old->new", !!qc && qc.old_value !== null && qc.new_value !== null, JSON.stringify(logs));
check("log records the acting admin", !!qc?.user_id, JSON.stringify(qc));

// restore seed state
await req(`/rest/v1/items?id=eq.${biscuits.id}`, { token: admin, method: "PATCH", body: { quantity: 2 } });

console.log(`\n===== ${pass.length} passed, ${fail.length} failed =====`);
if (fail.length) { console.log("FAILED:", fail.join(", ")); process.exit(1); }
