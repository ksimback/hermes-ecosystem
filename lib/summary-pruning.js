export function pruneObjectKeys(record, validKeys) {
  if (!record || typeof record !== "object") return [];
  const valid = validKeys instanceof Set ? validKeys : new Set(validKeys);
  const removed = [];
  for (const key of Object.keys(record)) {
    if (!valid.has(key)) {
      delete record[key];
      removed.push(key);
    }
  }
  return removed;
}

export function validateListEntries(entries, memberKeys) {
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
    throw new Error("List summary response must be an object");
  }
  const expected = memberKeys instanceof Set ? memberKeys : new Set(memberKeys);
  const actual = new Set(Object.keys(entries));
  const missing = [...expected].filter((key) => !actual.has(key));
  const unexpected = [...actual].filter((key) => !expected.has(key));
  if (missing.length > 0 || unexpected.length > 0) {
    throw new Error(
      `List summary key mismatch: ${missing.length} missing, ${unexpected.length} unexpected`,
    );
  }
  for (const [key, summary] of Object.entries(entries)) {
    if (typeof summary !== "string" || summary.trim().length < 20) {
      throw new Error(`Invalid list summary for ${key}`);
    }
  }
  return true;
}

/**
 * Which members of a list need a fresh entry. Regenerating only these, and
 * keeping every other entry verbatim, is what stops one README change from
 * rewording a whole 50-entry list on every build (#958).
 *
 * Returns every member when there is no usable prior pass (new list, or a
 * SUMMARY_VERSION bump). Otherwise returns members that have no entry, whose
 * repo summary changed this run, or whose summary is newer than the last list
 * pass. `full` tells the caller which case it is.
 */
export function listMembersNeedingEntries({
  listSummary,
  memberKeys,
  summaries,
  version,
  changedKeys = new Set(),
}) {
  const keys = [...memberKeys];
  if (!listSummary || listSummary.version !== version) {
    return { full: true, keys };
  }
  const entries = listSummary.entries || {};
  const generatedAt = Date.parse(listSummary.generatedAt || "") || 0;
  return {
    full: false,
    keys: keys.filter((key) => {
      if (typeof entries[key] !== "string") return true;
      if (changedKeys.has(key)) return true;
      const summaryGeneratedAt = Date.parse(summaries[key]?.generatedAt || "") || 0;
      return summaryGeneratedAt > generatedAt;
    }),
  };
}

export function listSummaryNeedsRegeneration(args) {
  return listMembersNeedingEntries(args).keys.length > 0;
}

export function auditVerdictIsPass(response) {
  const verdict = String(response || "").trim();
  return (
    /^none\b/i.test(verdict) ||
    /unsupported claims?\s*:\s*(?:\*\*)?none\b/i.test(verdict) ||
    /correction\/refinement:[\s\S]*all claims[\s\S]*supported/i.test(verdict)
  );
}
