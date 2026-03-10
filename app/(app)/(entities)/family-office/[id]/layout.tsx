import { notFound } from "next/navigation"
import { getAuthToken } from "@/lib/auth"

async function getFamilyOffice(id: string) {
  const token = await getAuthToken()
  if (!token) return null
  const res = await fetch(`${process.env.PLATFORM_API_URL}/family_office/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return null
  return res.json()
}

export default async function FamilyOfficeLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const familyOffice = await getFamilyOffice(id)
  if (!familyOffice) notFound()

  return <>{children}</>
}
