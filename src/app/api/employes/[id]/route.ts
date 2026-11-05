import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { SENSITIVE, sensitiveFilter, writesAny } from "@/lib/sensitive"

// PATCH: update employee fields or toggle is_active. Salaries need "employes.salaires" (E4).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const salary = await sensitiveFilter(SENSITIVE.salary)
  if (!salary.allowed && writesAny(body, SENSITIVE.salary)) {
    return NextResponse.json({ error: "Vos permissions ne permettent pas de modifier un salaire" }, { status: 403 })
  }
  const { db } = await createCompanyClient()

  const { data, error } = await db
    .from("employees")
    .update(body)
    .eq("id", id)
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(salary.apply(data))
}
