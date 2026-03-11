import { notFound } from "next/navigation"
import { getAuthToken } from "@/lib/auth"
import { TeamManager } from "@/components/team-manager"

async function getAssetManager(id: string) {
  const token = await getAuthToken()
  if (!token) return null
  const res = await fetch(`${process.env.PLATFORM_API_URL}/asset_manager/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return null
  return res.json() as Promise<{ id: string; entity: string; name?: string | null }>
}

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const record = await getAssetManager(id)
  if (!record) notFound()

  return (
    <div className="p-6 md:p-8">
      <div className="mx-auto">
        <TeamManager entityUUID={record.entity} />
      </div>
    </div>
  )
}
