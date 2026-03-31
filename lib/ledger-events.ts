export function notifyLedgerUpdate() {
  window.dispatchEvent(new CustomEvent("ledger:update"))
}

export function notifyNotificationsUpdate() {
  window.dispatchEvent(new CustomEvent("notifications:update"))
}

export function notifyEntitiesUpdate() {
  window.dispatchEvent(new CustomEvent("entities:update"))
}

export function notifyAssetsUpdate(entityUUID: string, value: number) {
  window.dispatchEvent(new CustomEvent("assets:update", { detail: { entityUUID, value } }))
}

export function notifyLiabilitiesUpdate(entityUUID: string, value: number) {
  window.dispatchEvent(new CustomEvent("liabilities:update", { detail: { entityUUID, value } }))
}
