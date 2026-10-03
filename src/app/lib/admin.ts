import { getReader } from "./membership";

/** Site owners, by Google account email: ADMIN_EMAILS="you@gmail.com,other@gmail.com". */
export async function isAdmin() {
  const reader = await getReader();
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return Boolean(reader.email && admins.includes(reader.email.toLowerCase()));
}
