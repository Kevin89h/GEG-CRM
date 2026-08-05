import { redirect } from "next/navigation"

export default async function AccountRedirect({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  redirect(`/${locale}/comptes/${id}`)
}
