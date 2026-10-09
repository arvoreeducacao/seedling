"use server";

import { redirect } from "next/navigation";
import { newId } from "@/lib/crypto";
import { db, schema } from "@/lib/db";
import { currentUser } from "@/lib/auth";

export async function requestAccess() {
  const user = await currentUser();
  if (!user) redirect("/login");
  await db.insert(schema.accessRequests).values({ id: newId(), email: user.email, name: user.name });
  redirect("/login?requested=1");
}
