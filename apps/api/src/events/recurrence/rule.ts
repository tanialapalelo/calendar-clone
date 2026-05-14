import { addMilliseconds } from 'date-fns';
import { RRule, rrulestr } from 'rrule';
import { formatFloatingDtstart } from './date-utils';

/** Normalize a user-provided RRULE into the bare rule body (no DTSTART, no leading RRULE:). */
export function normalizeRuleOnly(
  rule: string | null | undefined,
): string | null {
  if (!rule) return null;
  const trimmed = rule.trim();
  if (!trimmed) return null;

  const lines = trimmed.split(/\r?\n/).map((l) => l.trim());
  const rruleLine = lines.find((l) => l.toUpperCase().startsWith('RRULE:'));
  const candidate = rruleLine ?? trimmed;

  return candidate.toUpperCase().startsWith('RRULE:')
    ? candidate.slice('RRULE:'.length)
    : candidate;
}

/** Build an RRule anchored to a *floating* DTSTART (timezone applied separately). */
export function buildFloatingRule(ruleOnly: string, dtstartNaive: Date): RRule {
  const s = `${formatFloatingDtstart(dtstartNaive)}\nRRULE:${ruleOnly}`;
  return rrulestr(s) as RRule;
}

/**
 * Walk a rule forward, returning occurrences in [fromNaive, toNaive),
 * capped at `max` to bound CPU/memory for hostile or unbounded rules.
 */
export function generateAfterExclusive(args: {
  rule: RRule;
  fromNaive: Date;
  toNaive: Date;
  max: number;
}): Date[] {
  const { rule, fromNaive, toNaive, max } = args;
  const out: Date[] = [];
  let cursor = addMilliseconds(fromNaive, -1);

  while (out.length < max) {
    const next = rule.after(cursor, false);
    if (!next) break;
    if (next >= toNaive) break;
    if (next.getTime() <= cursor.getTime()) break;
    out.push(next);
    cursor = next;
  }

  return out;
}
