import { syncTopRepos } from "../../../../lib/github";

export const dynamic = "force-dynamic";

function unauthorized() {
  return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

function isAuthorized(request) {
  const token = process.env.CRON_SECRET;
  if (!token) {
    return true;
  }
  return request.headers.get("authorization") === `Bearer ${token}`;
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return unauthorized();
  }
  const snapshot = await syncTopRepos();
  return Response.json({ ok: true, stats: snapshot.stats, generatedAt: snapshot.generatedAt });
}
