'use client';

import { useEffect, useState } from 'react';
import { RRule } from 'rrule';
import { format } from 'date-fns';

type RecurrenceValue = { rrule?: string | null };

export default function RecurrencePicker(props: {
  value?: RecurrenceValue;
  onChange: (v: RecurrenceValue) => void;
  startDate?: Date;
}) {
  const { value, onChange, startDate } = props;
  const [preset, setPreset] = useState<string>(value?.rrule ? 'custom' : 'none');
  const [preview, setPreview] = useState<string[]>([]);

  // helper: map JS getDay() (0 = Sun) to RRule weekdays safely
  const jsDayToRRule = [
    RRule.SU, // 0 -> Sunday
    RRule.MO, // 1 -> Monday
    RRule.TU, // 2 -> Tuesday
    RRule.WE, // 3 -> Wednesday
    RRule.TH, // 4 -> Thursday
    RRule.FR, // 5 -> Friday
    RRule.SA, // 6 -> Saturday
  ];

  // Helper to produce a "local anchored" Date from startDate
  // This avoids timezone/UTC shifts when using dtstart with rrule.
  function localStartDate(sd?: Date) {
    if (!sd) return undefined;
    return new Date(
      sd.getFullYear(),
      sd.getMonth(),
      sd.getDate(),
      sd.getHours(),
      sd.getMinutes(),
      sd.getSeconds(),
      sd.getMilliseconds(),
    );
  }

  // compute next occurrences preview
  useEffect(() => {
    if (!value?.rrule || !startDate) {
      setPreview([]);
      return;
    }
    try {
      // parse rrule into options then attach dtstart anchored to local date/time
      const opts = RRule.parseString(value.rrule);
      const dt = localStartDate(startDate);
      if (dt) opts.dtstart = dt;
      const rule = new RRule(opts);
      const dates = rule.all((d, i) => i < 5);
      setPreview(dates.map((d) => format(d, 'EEE, MMM d, yyyy')));
    } catch {
      setPreview([]);
    }
  }, [value?.rrule, startDate]);

  function setNone() {
    setPreset('none');
    onChange({ rrule: null });
  }

  function setDaily() {
    if (!startDate) return;
    const dt = localStartDate(startDate);
    const r = new RRule({
      freq: RRule.DAILY,
      dtstart: dt,
    }).toString();
    setPreset('daily');
    onChange({ rrule: r });
  }

  function setWeekly() {
    if (!startDate) return;
    const jsWeekday = startDate.getDay(); // 0..6 (Sunday..Saturday)
    const byweekday = [jsDayToRRule[jsWeekday]];
    const dt = localStartDate(startDate);
    const r = new RRule({
      freq: RRule.WEEKLY,
      dtstart: dt,
      byweekday,
    }).toString();
    setPreset('weekly');
    onChange({ rrule: r });
  }

  function setEveryWeekday() {
    if (!startDate) return;
    const byweekday = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR];
    const dt = localStartDate(startDate);
    const r = new RRule({
      freq: RRule.WEEKLY,
      dtstart: dt,
      byweekday,
    }).toString();
    setPreset('weekday');
    onChange({ rrule: r });
  }

  function setMonthly() {
    if (!startDate) return;
    const dt = localStartDate(startDate);
    const r = new RRule({
      freq: RRule.MONTHLY,
      dtstart: dt,
      bymonthday: startDate.getDate(),
    }).toString();
    setPreset('monthly');
    onChange({ rrule: r });
  }

  function setYearly() {
    if (!startDate) return;
    const dt = localStartDate(startDate);
    const r = new RRule({
      freq: RRule.YEARLY,
      dtstart: dt,
    }).toString();
    setPreset('yearly');
    onChange({ rrule: r });
  }

  function recurringOptions() {
    if (!startDate) {
      return [
        ['none', 'Does not repeat'],
        ['daily', 'Daily'],
        ['weekly', 'Weekly'],
        ['monthly', 'Monthly'],
        ['yearly', 'Annually'],
      ] as [string, string][];
    }
    const dayOfWeek = format(startDate, 'EEEE');
    const dayOfMonth = startDate.getDate();
    return [
      ['none', 'Does not repeat'],
      ['daily', 'Daily'],
      ['weekly', `Weekly on ${dayOfWeek}`],
      ['weekday', 'Every weekday (Mon–Fri)'],
      ['monthly', 'monthly'],
      ['yearly', `Annually on ${format(startDate, 'MMMM')} ${dayOfMonth} `],
      ['custom', 'Custom...'],
    ] as [string, string][];
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <select
          className="rounded border p-3 text-sm text-gray-700 hover:bg-gray-100"
          value={preset}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'none') setNone();
            else if (v === 'daily') setDaily();
            else if (v === 'weekly') setWeekly();
            else if (v === 'weekday') setEveryWeekday();
            else if (v === 'monthly') setMonthly();
            else if (v === 'yearly') setYearly();
            else if (v === 'custom') {
              setPreset('custom');
            }
          }}
        >
          {recurringOptions().map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        {preset === 'custom' && (
          <div className="text-sm text-gray-500">Custom rule — advanced UI coming soon</div>
        )}
      </div>

      {preview.length > 0 && (
        <div className="text-xs text-gray-600">
          Next:{' '}
          {preview.map((p, i) => (
            <span key={p}>
              {i ? ', ' : ''}
              {p}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
