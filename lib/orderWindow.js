/**
 * Order window logic — the single source of truth for "is ordering open right now".
 * Pure functions, no framework dependency, so they're easy to unit test
 * and reusable in API routes, admin preview, and the storefront.
 *
 * IMPORTANT: boundaries are half-open [orderOpen, orderClose) so that
 * the exact close time (e.g. 12:30:00) is already CLOSED, and the exact
 * open time (e.g. 09:00:00) is already OPEN. This matches how a real
 * "last call at 12:30" cutoff should behave — test this exact edge.
 */

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function nowMinutes(date) {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * @param {Date} now - current time (already in the restaurant's local timezone)
 * @param {object} config - parsed orderWindows.json
 * @returns {object} status
 */
function getOrderStatus(now, config) {
  const nowMin = nowMinutes(now);

  for (const w of config.windows) {
    const openMin = toMinutes(w.orderOpen);
    const closeMin = toMinutes(w.orderClose);

    if (nowMin >= openMin && nowMin < closeMin) {
      return {
        isOpen: true,
        activeWindow: w,
        closesInMinutes: closeMin - nowMin,
        pickupStart: w.pickupStart,
        pickupEnd: w.pickupEnd,
      };
    }
  }

  // Not in any open window — find the next one that hasn't started yet today
  const upcoming = config.windows
    .map((w) => ({ w, openMin: toMinutes(w.orderOpen) }))
    .filter(({ openMin }) => openMin > nowMin)
    .sort((a, b) => a.openMin - b.openMin)[0];

  return {
    isOpen: false,
    message: config.closedMessage,
    nextWindow: upcoming ? upcoming.w : null, // null = no more windows today
  };
}

module.exports = { getOrderStatus, toMinutes, nowMinutes };
