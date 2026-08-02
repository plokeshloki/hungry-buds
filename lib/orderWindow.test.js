const { getOrderStatus } = require("./orderWindow");

const config = require("../data/orderWindows.json");

function at(hh, mm) {
  const d = new Date("2026-08-02T00:00:00");
  d.setHours(hh, mm, 0, 0);
  return d;
}

function assert(cond, label) {
  if (!cond) throw new Error("FAILED: " + label);
  console.log("PASS:", label);
}

// Core boundary tests requested explicitly
assert(getOrderStatus(at(9, 0), config).isOpen === true, "09:00:00 exactly -> OPEN");
assert(getOrderStatus(at(8, 59), config).isOpen === false, "08:59 -> CLOSED (before window)");
assert(getOrderStatus(at(12, 29), config).isOpen === true, "12:29 -> still OPEN");
assert(getOrderStatus(at(12, 30), config).isOpen === false, "12:30:00 exactly -> CLOSED (cutoff)");
assert(getOrderStatus(at(13, 59), config).isOpen === false, "13:59 -> CLOSED (mid-break)");
assert(getOrderStatus(at(14, 0), config).isOpen === true, "14:00:00 exactly -> OPEN (evening window)");
assert(getOrderStatus(at(18, 29), config).isOpen === true, "18:29 -> still OPEN");
assert(getOrderStatus(at(18, 30), config).isOpen === false, "18:30:00 exactly -> CLOSED");
assert(getOrderStatus(at(20, 0), config).isOpen === false, "20:00 -> CLOSED (after last window)");

// Sanity check on closesInMinutes and message
const openStatus = getOrderStatus(at(12, 0), config);
assert(openStatus.closesInMinutes === 30, "12:00 -> 30 minutes until close");

const closedStatus = getOrderStatus(at(13, 0), config);
assert(closedStatus.message === config.closedMessage, "closed message matches admin config");
assert(closedStatus.nextWindow.id === "evening", "next window correctly identified as evening");

console.log("\nAll boundary tests passed.");
