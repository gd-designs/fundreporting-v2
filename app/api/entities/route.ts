import { NextResponse } from 'next/server'
import { getAuthToken, getCurrentUser } from '@/lib/auth'
import { getEntities } from '@/lib/entities'
import type { EntityType } from '@/lib/types'

export async function GET() {
  const token = await getAuthToken()
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const entities = await getEntities()
  return NextResponse.json(entities)
}

export async function POST(request: Request) {
  const token = await getAuthToken()
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { type, name, ...rawFields } = body as {
    type: EntityType
    name: string
    [key: string]: unknown
  }

  // Coerce numeric fields sent as strings from the form
  const typeFields: Record<string, unknown> = { ...rawFields }
  if (typeFields.currency !== undefined && typeFields.currency !== "") {
    typeFields.currency = parseInt(String(typeFields.currency), 10)
  } else {
    delete typeFields.currency
  }
  if (typeFields.aum !== undefined && typeFields.aum !== "") {
    typeFields.aum = parseFloat(String(typeFields.aum))
  } else {
    delete typeFields.aum
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }
  const base = process.env.PLATFORM_API_URL

  // Step 1: create the base entity record
  const entityRes = await fetch(`${base}/entity`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ type, owner: user.id }),
  })
  const entityData = await entityRes.json()
  if (!entityRes.ok) {
    return NextResponse.json(
      { error: entityData.error ?? entityData.message ?? 'Failed to create entity' },
      { status: entityRes.status }
    )
  }

  // Step 2: create the type-specific record (owner always included for traceability)
  const detailRes = await fetch(`${base}/${type}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ entity: entityData.id, name, user_id: user.id, ...typeFields }),
  })
  const detailData = await detailRes.json()
  if (!detailRes.ok) {
    return NextResponse.json(
      { error: detailData.error ?? detailData.message ?? 'Failed to create entity detail' },
      { status: detailRes.status }
    )
  }

  return NextResponse.json({ ...detailData, type }, { status: 201 })
}
