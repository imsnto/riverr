import { Task } from '@/lib/data';
import { 
  startOfDay, 
  endOfDay, 
  addDays, 
  differenceInDays, 
  isWithinInterval, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  format,
  parseISO
} from 'date-fns';

export type ZoomLevel = 'day' | 'week' | 'month';

export interface TimelineRange {
  start: Date;
  end: Date;
  days: number;
}

/**
 * Ensures a task has valid start/end dates for timeline rendering.
 * Falls back to due_date or createdAt if specific timeline dates are missing.
 */
export function normalizeTaskDates(task: Task): { start: Date; end: Date; isUnscheduled: boolean } {
  const parseDate = (d?: string | null) => d ? parseISO(d) : null;
  
  let start = parseDate(task.startDate);
  let end = parseDate(task.endDate);
  const due = parseDate(task.due_date);
  const created = parseDate(task.createdAt);

  // If both are missing, try to infer from due_date
  if (!start && !end) {
    if (due) {
      start = startOfDay(due);
      end = endOfDay(due);
    } else {
      // Truly unscheduled
      return { start: new Date(), end: new Date(), isUnscheduled: true };
    }
  }

  // If one is missing, infer from the other
  if (!start && end) start = startOfDay(end);
  if (start && !end) end = endOfDay(start);

  // Safeguard: end must be >= start
  if (start! > end!) {
    end = endOfDay(start!);
  }

  return { start: start!, end: end!, isUnscheduled: false };
}

/**
 * Calculates the total date range required to display a set of tasks.
 */
export function getTimelineRange(tasks: Task[]): TimelineRange {
  if (tasks.length === 0) {
    const today = startOfDay(new Date());
    return { start: today, end: addDays(today, 30), days: 30 };
  }

  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  tasks.forEach(t => {
    const { start, end, isUnscheduled } = normalizeTaskDates(t);
    if (isUnscheduled) return;

    if (!minDate || start < minDate) minDate = start;
    if (!maxDate || end > maxDate) maxDate = end;
  });

  if (!minDate || !maxDate) {
    const today = startOfDay(new Date());
    return { start: today, end: addDays(today, 30), days: 30 };
  }

  // Add padding (e.g., 1 week before and after)
  const start = startOfMonth(addDays(minDate, -7));
  const end = endOfMonth(addDays(maxDate, 7));

  return {
    start,
    end,
    days: differenceInDays(end, start) + 1
  };
}

/**
 * Calculates the CSS position and width for a task bar.
 */
export function getTaskBarPosition(task: Task, range: TimelineRange, dayWidth: number) {
  const { start, end, isUnscheduled } = normalizeTaskDates(task);
  if (isUnscheduled) return null;

  const leftDays = differenceInDays(start, range.start);
  const durationDays = differenceInDays(end, start) + 1;

  return {
    left: leftDays * dayWidth,
    width: durationDays * dayWidth
  };
}

/**
 * Returns the columns/ticks for the timeline header based on zoom level.
 */
export function getTimelineTicks(range: TimelineRange, zoom: ZoomLevel) {
  switch (zoom) {
    case 'day':
      return eachDayOfInterval({ start: range.start, end: range.end }).map(d => ({
        date: d,
        label: format(d, 'd'),
        subLabel: format(d, 'EEE'),
        width: 40
      }));
    case 'week':
      return eachWeekOfInterval({ start: range.start, end: range.end }).map(d => ({
        date: d,
        label: `Week of ${format(d, 'MMM d')}`,
        width: 140
      }));
    case 'month':
    default:
      return eachMonthOfInterval({ start: range.start, end: range.end }).map(d => ({
        date: d,
        label: format(d, 'MMMM yyyy'),
        width: 200
      }));
  }
}
