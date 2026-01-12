'use client';

import { useEffect, useState } from 'react';
import { RRule, type Weekday } from 'rrule';
import { format } from 'date-fns';

type RecurrenceValue = { rrule?: string | null };

export default function RecurrencePicker(props: {
  value?: RecurrenceValue;
  onChange: (v: RecurrenceValue) => void;
  startDate?: Date;
}) {
  const { value, onChange, startDate } = props;

  const [preset, setPreset] = useState<string>(() => (value?.rrule ? 'custom' : 'none'));
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

  // When value.rrule or startDate changes, try to infer a preset from the rrule
  useEffect(() => {
    if (!value?.rrule || !startDate) {
      setPreset('none');
      return;
    }
    try {
      const opts = RRule.parseString(value.rrule);

      const isDaily = opts.freq === RRule.DAILY && !opts.byweekday && !opts.bymonthday;

      const weekdayList = (opts.byweekday ?? []) as Weekday[];

      const isWeeklySameDay =
        opts.freq === RRule.WEEKLY &&
        weekdayList.length === 1 &&
        jsDayToRRule[startDate.getDay()]?.weekday === weekdayList[0]?.weekday;

      const isWeekday =
        opts.freq === RRule.WEEKLY &&
        weekdayList.length === 5 &&
        [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR].every((w) =>
          weekdayList.some((bw) => bw.weekday === w.weekday),
        );

      const isMonthlySameDay =
        opts.freq === RRule.MONTHLY &&
        Array.isArray(opts.bymonthday) &&
        opts.bymonthday.length === 1 &&
        opts.bymonthday[0] === startDate.getDate();

      const isYearly = opts.freq === RRule.YEARLY;

      if (isDaily) setPreset('daily');
      else if (isWeeklySameDay) setPreset('weekly');
      else if (isWeekday) setPreset('weekday');
      else if (isMonthlySameDay) setPreset('monthly');
      else if (isYearly) setPreset('yearly');
      else setPreset('custom');
    } catch {
      setPreset('custom');
    }
  }, [value?.rrule, startDate]);

  // compute next occurrences preview
  useEffect(() => {
    if (!value?.rrule || !startDate) {
      setPreview([]);
      return;
    }
    try {
      // IMPORTANT: for preview, trust the DTSTART embedded in the RRULE string
      // and do not override dtstart here; this avoids off-by-one when mixing
      // UTC/Z strings with local dates.
      const opts = RRule.parseString(value.rrule);
      const rule = new RRule(opts);
      const dates = rule.all((_, i) => i < 5);
      setPreview(dates.map((d) => format(d, 'EEE, MMM d, yyyy')));
    } catch {
      setPreview([]);
    }
  }, [value?.rrule]);

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
    const weekday = jsDayToRRule[jsWeekday];
    // Build a pure RRULE string without DTSTART; DTSTART will be managed separately
    const r = new RRule({
      freq: RRule.WEEKLY,
      byweekday: [weekday],
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
      ['monthly', 'Monthly'],
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
    </div>
  );
}
