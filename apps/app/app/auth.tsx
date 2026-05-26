import { cookies } from "next/headers";

export async function hasSessionCookie(): Promise<boolean> {
  if (process.env.VSPEC_AUTH_STUB === "1") {
    return true;
  }

  const cookieStore = await cookies();
  return cookieStore.get("vspec_session")?.value !== undefined;
}
