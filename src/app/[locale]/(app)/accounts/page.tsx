import { redirect } from "next/navigation"

export default async function AccountsRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  redirect(`/${locale}/comptes`)
}
