function formatUntilUtc(d: Date) {
  const iso = d.toISOString(); // 2026-02-11T00:00:00.000Z
  // -> 20260211T000000Z
  return iso.replace(/[-:]/g, '').replace('.000Z', 'Z').replace('T', 'T');
}

function formatUntilFloating(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${y}${m}${day}T${hh}${mm}${ss}`;
}

export function withUntil(ruleOnly: string, untilUtc: Date) {
  const until = formatUntilUtc(untilUtc);
  if (/;UNTIL=\d{8}T\d{6}Z/i.test(ruleOnly)) {
    return ruleOnly.replace(/;UNTIL=\d{8}T\d{6}Z/i, `;UNTIL=${until}`);
  }
  return `${ruleOnly};UNTIL=${until}`;
}

export function withUntilFloating(ruleOnly: string, untilLocal: Date) {
  const until = formatUntilFloating(untilLocal);
  if (/;UNTIL=\d{8}T\d{6}Z?/i.test(ruleOnly)) {
    return ruleOnly.replace(/;UNTIL=\d{8}T\d{6}Z?/i, `;UNTIL=${until}`);
  }
  return `${ruleOnly};UNTIL=${until}`;
}

export function stripUntil(ruleOnly: string) {
  return ruleOnly.replace(/;UNTIL=\d{8}T\d{6}Z/i, '');
}
