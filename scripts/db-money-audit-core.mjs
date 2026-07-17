export function auditClpMoneyRecords(groups) {
  const findings = [];
  for (const group of groups) {
    for (const record of group.records) {
      for (const field of group.fields) {
        const value = field.value(record);
        if (value === null || value === undefined || value === "") continue;
        if (!isWholeMoney(value)) {
          findings.push({ table: group.table, id: String(record.id), field: field.name });
        }
      }
    }
  }
  return findings;
}

export function isWholeMoney(value) {
  const source = String(value).trim();
  const match = /^[+-]?\d+(?:\.(\d+))?$/.exec(source);
  return Boolean(match && (match[1] ?? "").split("").every((digit) => digit === "0"));
}
