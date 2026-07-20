import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { db } from "@/db";
import { clerkWebhookEvents, users } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let event: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    event = await verifyWebhook(request);
  } catch (error) {
    console.error("Clerk webhook verification failed", error);
    return new Response("Verification failed", { status: 400 });
  }

  const deliveryId = request.headers.get("svix-id");
  if (!deliveryId) {
    return new Response("Missing delivery ID", { status: 400 });
  }
  if (event.type === "user.deleted" && !event.data.id) {
    console.error("Clerk user.deleted webhook did not include a user ID");
    return new Response("Missing deleted user ID", { status: 400 });
  }

  await db.transaction(async (tx) => {
    const [claimed] = await tx
      .insert(clerkWebhookEvents)
      .values({ id: deliveryId, eventType: event.type })
      .onConflictDoNothing()
      .returning({ id: clerkWebhookEvents.id });
    if (!claimed) return;

    if (event.type === "user.created" || event.type === "user.updated") {
      const user = event.data;
      const primaryEmail = user.email_addresses.find(
        (email) => email.id === user.primary_email_address_id,
      );
      const displayName =
        [user.first_name, user.last_name].filter(Boolean).join(" ") ||
        user.username ||
        null;
      await tx
        .insert(users)
        .values({
          id: user.id,
          email: primaryEmail?.email_address ?? null,
          displayName,
          imageUrl: user.image_url ?? null,
        })
        .onConflictDoUpdate({
          target: users.id,
          set: {
            email: primaryEmail?.email_address ?? null,
            displayName,
            imageUrl: user.image_url ?? null,
            deletedAt: null,
            updatedAt: new Date(),
          },
        });
    }

    if (event.type === "user.deleted" && event.data.id) {
      const deletedUserId = event.data.id;
      await tx
        .update(users)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, deletedUserId));
    }
  });

  return new Response("OK", { status: 200 });
}
