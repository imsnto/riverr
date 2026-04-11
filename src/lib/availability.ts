/**
 * availability.ts — Smart Handoff availability check.
 *
 * Pure function that determines whether a live human handoff is possible
 * based on bot config, agent presence, and business hours.
 */

import type { BotConfig } from "./agent";

export type AvailabilityReason =
  | 'live_agent_online'
  | 'within_business_hours'
  | 'outside_hours'
  | 'escalation_disabled'
  | 'no_agents_configured';

export interface AvailabilityResult {
  available: boolean;
  reason: AvailabilityReason;
  businessHoursLabel?: string;
}

/**
 * Checks whether a live handoff is possible right now.
 *
 * Priority:
 * 1. Escalation disabled → unavailable
 * 2. No agents configured → unavailable
 * 3. Any agent online → available
 * 4. Structured hours exist → check schedule
 * 5. Fallback: assume available (preserves current behaviour)
 */
export function checkHandoffAvailability(args: {
  bot: BotConfig;
  onlineAgentIds?: string[];
  now?: Date;
}): AvailabilityResult {
  const { bot, onlineAgentIds, now = new Date() } = args;

  const timezone = bot.businessContext?.structuredHours?.timezone || 'UTC';
  const localTimeLabel = now.toLocaleString('en-US', { timeZone: timezone, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
  console.log(`[checkHandoffAvailability] timezone=${timezone} | local time in tz="${localTimeLabel}" | UTC=${now.toISOString()} | onlineAgents=${JSON.stringify(onlineAgentIds)}`);

  // 1. Escalation disabled
  if (!bot.escalation?.enabled) {
    console.log('[checkHandoffAvailability] → escalation_disabled');
    return { available: false, reason: 'escalation_disabled' };
  }

  // 2. No agents configured (check agentIds on the full bot — BotConfig doesn't carry it,
  //    so we rely on onlineAgentIds being undefined vs empty to distinguish)
  // If the caller passes an empty array, it means they checked and nobody is online.
  // If undefined, the caller couldn't check presence.

  // 3. Agent presence
  if (onlineAgentIds !== undefined) {
    if (onlineAgentIds.length > 0) {
      return { available: true, reason: 'live_agent_online' };
    }
    // All agents are offline — fall through to hours check
  }

  // 4. Structured business hours
  const structuredHours = bot.businessContext?.structuredHours;
  if (structuredHours?.schedule?.length) {
    const inHours = isWithinBusinessHours(now, structuredHours);
    console.log(`[checkHandoffAvailability] → structured hours check: ${inHours ? 'within_business_hours' : 'outside_hours'}`);
    return {
      available: inHours,
      reason: inHours ? 'within_business_hours' : 'outside_hours',
      businessHoursLabel: bot.businessContext?.hours || undefined,
    };
  }

  // 5. Fallback: if escalation is enabled and we have no structured hours
  //    and no presence data, assume available (preserves pre-handoff behaviour)
  if (onlineAgentIds === undefined) {
    console.log('[checkHandoffAvailability] → no structured hours, no presence data → assume available');
    return { available: true, reason: 'within_business_hours' };
  }

  // onlineAgentIds was provided but empty, no structured hours → offline
  console.log('[checkHandoffAvailability] → no structured hours, agents array empty → outside_hours');
  return {
    available: false,
    reason: 'outside_hours',
    businessHoursLabel: bot.businessContext?.hours || undefined,
  };
}

/**
 * Checks whether `now` falls within any of the configured schedule windows.
 */
function isWithinBusinessHours(
  now: Date,
  structuredHours: NonNullable<NonNullable<BotConfig['businessContext']>['structuredHours']>,
): boolean {
  const { timezone, schedule } = structuredHours;

  // Get current day/time in the configured timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });

  const parts = formatter.formatToParts(now);
  const hourStr = parts.find(p => p.type === 'hour')?.value ?? '00';
  const minuteStr = parts.find(p => p.type === 'minute')?.value ?? '00';
  const weekdayStr = parts.find(p => p.type === 'weekday')?.value ?? '';

  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const currentDay = dayMap[weekdayStr] ?? now.getDay();
  const currentMinutes = parseInt(hourStr, 10) * 60 + parseInt(minuteStr, 10);

  console.log(`[isWithinBusinessHours] timezone=${timezone} | weekday=${weekdayStr}(${currentDay}) | time=${hourStr}:${minuteStr} (${currentMinutes}min)`);

  for (const slot of schedule) {
    if (!slot.days.includes(currentDay)) continue;

    const [startH, startM] = slot.start.split(':').map(Number);
    const [endH, endM] = slot.end.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    console.log(`[isWithinBusinessHours] checking slot days=${slot.days} ${slot.start}-${slot.end} (${startMinutes}-${endMinutes}min) → current=${currentMinutes}min → ${currentMinutes >= startMinutes && currentMinutes < endMinutes ? 'MATCH' : 'no match'}`);

    if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
      return true;
    }
  }

  return false;
}
