import webpush from "web-push"
import { createAdminClient } from "@/lib/supabase/admin"

webpush.setVapidDetails(
  "mailto:kevin@globalenergy.group",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string; tag?: string }
) {
  const admin = createAdminClient()
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId)

  if (!subs || subs.length === 0) return

  await Promise.allSettled(
    subs.map((sub) =>
      webpush
        .sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        )
        .catch(async (err) => {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint)
          }
        })
    )
  )
}
