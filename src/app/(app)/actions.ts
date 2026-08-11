"use server";

import { redirect } from "next/navigation";
import { getSession, clearSessionCookie, destroySession } from "@/server/auth/session";
import { recordAudit } from "@/server/audit";

export async function logoutAction() {
  const session = await getSession();
  if (session) {
    await destroySession(session.sessionId);
    await recordAudit({
      action: "auth.logout",
      userId: session.userId,
      userEmail: session.email,
      workspaceId: session.workspaceId,
    });
  }
  await clearSessionCookie();
  redirect("/entrar");
}
