export function notifyLedgerUpdate() {
  window.dispatchEvent(new CustomEvent("ledger:update"))
}

export function notifyNotificationsUpdate() {
  window.dispatchEvent(new CustomEvent("notifications:update"))
}

export function notifyEntitiesUpdate() {
  window.dispatchEvent(new CustomEvent("entities:update"))
}

const CACHE_KEY = (uuid: string) => `entity-nav-stats:${uuid}`

export function getCachedEntityStats(entityUUID: string): { assets: number | null; liabilities: number | null } {
  try {
    const raw = localStorage.getItem(CACHE_KEY(entityUUID))
    if (!raw) return { assets: null, liabilities: null }
    return JSON.parse(raw) as { assets: number | null; liabilities: number | null }
  } catch {
    return { assets: null, liabilities: null }
  }
}

function patchCachedEntityStats(entityUUID: string, patch: Partial<{ assets: number; liabilities: number }>) {
  try {
    const existing = getCachedEntityStats(entityUUID)
    localStorage.setItem(CACHE_KEY(entityUUID), JSON.stringify({ ...existing, ...patch }))
  } catch {
    // storage unavailable — silently skip
  }
}

export function notifyAssetsUpdate(entityUUID: string, value: number) {
  patchCachedEntityStats(entityUUID, { assets: value })
  window.dispatchEvent(new CustomEvent("assets:update", { detail: { entityUUID, value } }))
}

export function notifyLiabilitiesUpdate(entityUUID: string, value: number) {
  patchCachedEntityStats(entityUUID, { liabilities: value })
  window.dispatchEvent(new CustomEvent("liabilities:update", { detail: { entityUUID, value } }))
}
