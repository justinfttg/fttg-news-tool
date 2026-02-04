import type { MilestoneOffset, MilestoneType, ProductionMilestone } from '../../types';
import type { CreateMilestoneInput } from '../../db/queries/episodes.queries';

/**
 * Calculated milestone data ready for database insertion
 */
export interface CalculatedMilestone {
  milestoneType: MilestoneType;
  label: string;
  deadlineDate: string; // YYYY-MM-DD
  deadlineTime: string | null; // HH:MM
  isClientFacing: boolean;
  requiresClientApproval: boolean;
}

/**
 * Calculate milestone dates from a TX date and template offsets
 *
 * @param txDate - The transmission date in YYYY-MM-DD format
 * @param milestoneOffsets - Array of milestone offset configurations
 * @returns Array of calculated milestones with absolute dates
 */
export function calculateMilestonesFromTxDate(
  txDate: string,
  milestoneOffsets: MilestoneOffset[]
): CalculatedMilestone[] {
  const txDateObj = new Date(txDate + 'T00:00:00');

  return milestoneOffsets.map((offset) => {
    // Calculate the deadline date by adding days offset
    const deadlineDate = new Date(txDateObj);
    deadlineDate.setDate(deadlineDate.getDate() + offset.days_offset);

    // Format as YYYY-MM-DD
    const formattedDate = deadlineDate.toISOString().split('T')[0];

    // Use label from offset or generate from milestone type
    const label = offset.label || formatMilestoneTypeLabel(offset.milestone_type);

    return {
      milestoneType: offset.milestone_type,
      label,
      deadlineDate: formattedDate,
      deadlineTime: offset.time,
      isClientFacing: offset.is_client_facing,
      requiresClientApproval: offset.requires_client_approval,
    };
  });
}

/**
 * Convert calculated milestones to database input format
 */
export function toMilestoneInputs(
  episodeId: string,
  calculatedMilestones: CalculatedMilestone[]
): CreateMilestoneInput[] {
  return calculatedMilestones.map((m) => ({
    episodeId,
    milestoneType: m.milestoneType,
    label: m.label,
    deadlineDate: m.deadlineDate,
    deadlineTime: m.deadlineTime || undefined,
    isClientFacing: m.isClientFacing,
    requiresClientApproval: m.requiresClientApproval,
  }));
}

/**
 * Recalculate milestone dates when TX date changes
 * Preserves milestone status and completion data
 */
export function recalculateMilestoneDates(
  existingMilestones: ProductionMilestone[],
  oldTxDate: string,
  newTxDate: string
): { id: string; deadlineDate: string }[] {
  const oldTxDateObj = new Date(oldTxDate + 'T00:00:00');
  const newTxDateObj = new Date(newTxDate + 'T00:00:00');

  // Calculate the difference in days
  const diffMs = newTxDateObj.getTime() - oldTxDateObj.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  return existingMilestones.map((milestone) => {
    const oldDeadline = new Date(milestone.deadline_date + 'T00:00:00');
    const newDeadline = new Date(oldDeadline);
    newDeadline.setDate(newDeadline.getDate() + diffDays);

    return {
      id: milestone.id,
      deadlineDate: newDeadline.toISOString().split('T')[0],
    };
  });
}

/**
 * Calculate the day offset from TX date for a given date
 */
export function calculateDaysOffset(targetDate: string, txDate: string): number {
  const targetDateObj = new Date(targetDate + 'T00:00:00');
  const txDateObj = new Date(txDate + 'T00:00:00');

  const diffMs = targetDateObj.getTime() - txDateObj.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Get all dates between start and end (inclusive) for calendar display
 */
export function getMilestoneDateRange(
  milestones: CalculatedMilestone[]
): { startDate: string; endDate: string } | null {
  if (milestones.length === 0) return null;

  const dates = milestones.map((m) => new Date(m.deadlineDate + 'T00:00:00'));
  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

  return {
    startDate: minDate.toISOString().split('T')[0],
    endDate: maxDate.toISOString().split('T')[0],
  };
}

/**
 * Check if a milestone is overdue
 */
export function isMilestoneOverdue(milestone: ProductionMilestone): boolean {
  if (milestone.status === 'completed' || milestone.status === 'skipped') {
    return false;
  }

  const now = new Date();
  const deadline = new Date(milestone.deadline_date + 'T00:00:00');

  if (milestone.deadline_time) {
    const [hours, minutes] = milestone.deadline_time.split(':').map(Number);
    deadline.setHours(hours, minutes, 0, 0);
  } else {
    // If no time specified, deadline is end of day
    deadline.setHours(23, 59, 59, 999);
  }

  return now > deadline;
}

/**
 * Get milestone urgency level for display
 * Returns: 'overdue' | 'urgent' (within 24h) | 'upcoming' (within 3 days) | 'normal'
 */
export function getMilestoneUrgency(
  milestone: ProductionMilestone
): 'overdue' | 'urgent' | 'upcoming' | 'normal' {
  if (milestone.status === 'completed' || milestone.status === 'skipped') {
    return 'normal';
  }

  const now = new Date();
  const deadline = new Date(milestone.deadline_date + 'T00:00:00');

  if (milestone.deadline_time) {
    const [hours, minutes] = milestone.deadline_time.split(':').map(Number);
    deadline.setHours(hours, minutes, 0, 0);
  } else {
    deadline.setHours(23, 59, 59, 999);
  }

  const hoursUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntilDeadline < 0) return 'overdue';
  if (hoursUntilDeadline <= 24) return 'urgent';
  if (hoursUntilDeadline <= 72) return 'upcoming';
  return 'normal';
}

/**
 * Format a milestone type into a human-readable label
 */
export function formatMilestoneTypeLabel(milestoneType: MilestoneType): string {
  const labels: Record<MilestoneType, string> = {
    topic_confirmation: 'Topic Confirmation',
    script_deadline: 'Script Deadline',
    script_approval: 'Script Approval',
    production_day: 'Production Day',
    post_production: 'Post-Production',
    draft_1_review: 'Draft 1 Review',
    draft_2_review: 'Draft 2 Review',
    final_delivery: 'Final Delivery',
    topic_approval: 'Topic Approval',
    custom: 'Custom Milestone',
  };

  return labels[milestoneType] || milestoneType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Get milestone color for calendar display
 */
export function getMilestoneColor(milestoneType: MilestoneType): string {
  const colors: Record<MilestoneType, string> = {
    topic_confirmation: '#3B82F6', // blue
    topic_approval: '#3B82F6', // blue
    script_deadline: '#F59E0B', // amber
    script_approval: '#F59E0B', // amber
    production_day: '#10B981', // emerald
    post_production: '#10B981', // emerald
    draft_1_review: '#8B5CF6', // violet
    draft_2_review: '#8B5CF6', // violet
    final_delivery: '#EF4444', // red
    custom: '#6B7280', // gray
  };

  return colors[milestoneType] || '#6B7280';
}

/**
 * Sort milestones by deadline (ascending)
 */
export function sortMilestonesByDeadline<T extends { deadline_date: string; deadline_time: string | null }>(
  milestones: T[]
): T[] {
  return [...milestones].sort((a, b) => {
    const dateA = new Date(a.deadline_date + 'T' + (a.deadline_time || '00:00'));
    const dateB = new Date(b.deadline_date + 'T' + (b.deadline_time || '00:00'));
    return dateA.getTime() - dateB.getTime();
  });
}

/**
 * Group milestones by date for calendar day view
 */
export function groupMilestonesByDate<T extends { deadline_date: string }>(
  milestones: T[]
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const milestone of milestones) {
    const existing = grouped.get(milestone.deadline_date) || [];
    existing.push(milestone);
    grouped.set(milestone.deadline_date, existing);
  }

  return grouped;
}

/**
 * Validate milestone offsets to ensure they make sense
 */
export function validateMilestoneOffsets(offsets: MilestoneOffset[]): string[] {
  const errors: string[] = [];

  if (offsets.length === 0) {
    errors.push('At least one milestone is required');
    return errors;
  }

  // Check for final_delivery
  const hasFinalDelivery = offsets.some((o) => o.milestone_type === 'final_delivery');
  if (!hasFinalDelivery) {
    errors.push('Workflow must include a final_delivery milestone');
  }

  // Check for duplicate milestone types (except custom)
  const typeCount = new Map<string, number>();
  for (const offset of offsets) {
    if (offset.milestone_type !== 'custom') {
      const count = (typeCount.get(offset.milestone_type) || 0) + 1;
      typeCount.set(offset.milestone_type, count);
      if (count > 1) {
        errors.push(`Duplicate milestone type: ${offset.milestone_type}`);
      }
    }
  }

  // Check for valid time format
  for (const offset of offsets) {
    if (offset.time && !/^\d{2}:\d{2}$/.test(offset.time)) {
      errors.push(`Invalid time format for ${offset.milestone_type}: ${offset.time}`);
    }
  }

  return errors;
}
