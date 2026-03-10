export function notifyLedgerUpdate() {
  window.dispatchEvent(new CustomEvent("ledger:update"))
}

export function notifyNotificationsUpdate() {
  window.dispatchEvent(new CustomEvent("notifications:update"))
}

export function notifyEntitiesUpdate() {
  window.dispatchEvent(new CustomEvent("entities:update"))
}
