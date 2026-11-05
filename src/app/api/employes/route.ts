import { NextRequest, NextResponse } from "next/server"
import { createCompanyClient } from "@/lib/company"
import { errorResponse } from "@/lib/access"
import { SENSITIVE, sensitiveFilter, writesAny } from "@/lib/sensitive"

// POST: create a new employee. Salaries need "employes.salaires" (E4), never returned without it.
export async function POST(req: NextRequest)  {
  try {
    const body = await req.json()
    const salary = await sensitiveFilter(SENSITIVE.salary)
    if (!salary.allowed && writesAny(body, SENSITIVE.salary) && body.salary != null && body.salary !== "") {
      return NextResponse.json({ error: "Vos permissions ne permettent pas de saisir un salaire" }, { status: 403 })
    }
    const row = salary.allowed ? body : Object.fromEntries(Object.entries(body).filter(([k]) => !SENSITIVE.salary.fields.includes(k as never)))
    const { db } = await createCompanyClient()

    const { data, error } = await db
      .from("employees")
      .insert([row])
      .select("*")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(salary.apply(data))

  } catch (err) {
    return errorResponse(err)
  }
}
