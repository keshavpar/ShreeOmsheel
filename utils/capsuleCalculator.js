'use strict';

/**
 * isSameDay — compare two Date objects by calendar day only (ignores time)
 */
function isSameDay(d1, d2) {
  return (
    d1.getDate()     === d2.getDate()  &&
    d1.getMonth()    === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear()
  );
}

/**
 * toMidnight — returns a NEW date set to midnight, never mutates the original
 */
function toMidnight(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * getActiveTapering
 *
 * Returns the tapering array of the latest medicalExam that has
 * 2 or more entries (minimum: at least one real dose entry + the sentinel).
 * Returns null if no qualifying exam exists.
 */
function getActiveTapering(medicalExams) {
  if (!Array.isArray(medicalExams) || medicalExams.length === 0) return null;

  for (let i = medicalExams.length - 1; i >= 0; i--) {
    const tapering = medicalExams[i].tapering;
    if (Array.isArray(tapering) && tapering.length >= 2) {
      return tapering;
    }
  }

  return null;
}

/**
 * computeTaperingState
 *
 * Given a tapering array where the LAST entry is a sentinel (reminder cap
 * count on visit day, not a real dose):
 *
 * - realEntries  = all entries except the last
 * - expectedDate = last entry's date (when patient must return)
 * - dosage       = morning + evening of today's matching real entry
 *                  before schedule starts → first real entry dosage
 *                  after schedule ends   → last real entry dosage
 *                  gap in schedule       → nearest past real entry dosage
 *
 * Returns: { dosage, expectedDate }
 */
function computeTaperingState(tapering) {
  const todayMidnight = toMidnight(new Date());

  // Last entry = sentinel (reminder), not a real dose
  const sentinel    = tapering[tapering.length - 1];
  const realEntries = tapering.slice(0, tapering.length - 1);

  const expectedDate = new Date(sentinel.date);

  // --- Try to find an exact match for today ---
  const todayEntry = realEntries.find(e =>
    isSameDay(toMidnight(new Date(e.date)), todayMidnight)
  );

  if (todayEntry) {
    return {
      dosage: todayEntry.morning + todayEntry.evening,
      expectedDate,
    };
  }

  // --- No exact match: determine position relative to schedule ---
  const firstMidnight = toMidnight(new Date(realEntries[0].date));
  const lastMidnight  = toMidnight(new Date(realEntries[realEntries.length - 1].date));

  // Before schedule starts — use first real entry
  if (todayMidnight < firstMidnight) {
    const first = realEntries[0];
    return {
      dosage: first.morning + first.evening,
      expectedDate,
    };
  }

  // Past all real entries — patient overdue, last real dosage still applies
  if (todayMidnight > lastMidnight) {
    const last = realEntries[realEntries.length - 1];
    return {
      dosage: last.morning + last.evening,
      expectedDate,
    };
  }

  // Gap in schedule — walk backwards to find nearest past entry
  let nearestPast = realEntries[0];
  for (const entry of realEntries) {
    if (toMidnight(new Date(entry.date)) <= todayMidnight) {
      nearestPast = entry;
    }
  }

  return {
    dosage: nearestPast.morning + nearestPast.evening,
    expectedDate,
  };
}

/**
 * calculateCapsules — main export
 *
 * Computes capsule stats and active tapering state for a patient.
 *
 * Returns:
 * {
 *   totalCaps    — sum of all capgiven across observations + medicalExams
 *   todayCaps    — sum of capgiven entries recorded today
 *   dosage       — current dosage (morning + evening) from active taper
 *   expectedDate — date patient must return (sentinel entry date)
 * }
 */
function calculateCapsules(patient) {
  const today = new Date();

  let totalCaps = 0;
  let todayCaps = 0;

  // ── Observations ───────────────────────────────────────────────────────────
  if (Array.isArray(patient.observations)) {
    for (const obs of patient.observations) {
      const cap = obs.capgiven || 0;
      totalCaps += cap;
      if (obs.time && isSameDay(new Date(obs.time), today)) {
        todayCaps += cap;
      }
    }
  }

  // ── Medical Exams ──────────────────────────────────────────────────────────
  if (Array.isArray(patient.medicalExams)) {
    for (const exam of patient.medicalExams) {
      const cap = exam.capgiven || 0;
      totalCaps += cap;
      if (exam.time && isSameDay(new Date(exam.time), today)) {
        todayCaps += cap;
      }
    }
  }

  // ── Tapering State ─────────────────────────────────────────────────────────
  const activeTapering = getActiveTapering(patient.medicalExams);

  const { dosage, expectedDate } = activeTapering
    ? computeTaperingState(activeTapering)
    : { dosage: 0, expectedDate: null };

  return { totalCaps, todayCaps, dosage, expectedDate };
}

module.exports = calculateCapsules;