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

export function listSummaryNeedsRegeneration({
  listSummary,
  memberKeys,
  summaries,
  version,
  changedKeys = new Set(),
}) {
  if (!listSummary || listSummary.version !== version) return true;
  const generatedAt = Date.parse(listSummary.generatedAt || "") || 0;
  return [...memberKeys].some((key) => {
    if (changedKeys.has(key)) return true;
    const summaryGeneratedAt = Date.parse(summaries[key]?.generatedAt || "") || 0;
    return summaryGeneratedAt > generatedAt;
  });
}

export function auditVerdictIsPass(response) {
  const verdict = String(response || "").trim();
  return (
    /^none\b/i.test(verdict) ||
    /unsupported claims?\s*:\s*(?:\*\*)?none\b/i.test(verdict) ||
    /correction\/refinement:[\s\S]*all claims[\s\S]*supported/i.test(verdict)
  );
}
