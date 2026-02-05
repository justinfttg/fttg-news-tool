import type {
  ProductionEpisode,
  ProductionMilestone,
  TimelineType,
  TopicProposal,
} from '../../types';
import {
  createEpisode,
  updateEpisode,
  getEpisodeById,
  deleteEpisode,
  getNextEpisodeNumber,
  createMilestones,
  deleteMilestonesByEpisodeId,
  getMilestonesByEpisodeId,
  updateMilestone,
} from '../../db/queries/episodes.queries';
import {
  getOrCreateDefaultTemplate,
  getTemplateById,
} from '../../db/queries/workflow-templates.queries';
import {
  createCalendarItem,
  updateCalendarItem,
  deleteCalendarItem,
} from '../../db/queries/calendar.queries';
import {
  calculateMilestonesFromTxDate,
  toMilestoneInputs,
  recalculateMilestoneDates,
} from './milestone-calculator';
import { supabase } from '../../db/client';

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface ScheduleEpisodeInput {
  projectId: string;
  topicProposalId?: string;
  title: string;
  txDate: string;
  txTime?: string;
  timelineType?: TimelineType;
  templateId?: string;
  episodeNumber?: number;
  internalNotes?: string;
  createdByUserId: string;
}

export interface RescheduleEpisodeInput {
  newTxDate: string;
  newTxTime?: string | null;
  preserveMilestoneStatus?: boolean;
}

// ---------------------------------------------------------------------------
// Episode Service
// ---------------------------------------------------------------------------

/**
 * Schedule a new episode with all milestones
 * Creates: ProductionEpisode + ProductionMilestones + CalendarItem
 */
export async function scheduleEpisode(
  input: ScheduleEpisodeInput
): Promise<ProductionEpisode> {
  // Get the workflow template
  const template = input.templateId
    ? await getTemplateById(input.templateId)
    : await getOrCreateDefaultTemplate(input.projectId, input.timelineType || 'normal');

  if (!template) {
    throw new Error('Workflow template not found');
  }

  // Calculate episode number if not provided
  const episodeNumber = input.episodeNumber ?? (await getNextEpisodeNumber(input.projectId));

  // Create the calendar item first
  const calendarItem = await createCalendarItem({
    projectId: input.projectId,
    title: input.title,
    scheduledDate: input.txDate,
    scheduledTime: input.txTime,
    createdByUserId: input.createdByUserId,
    notes: `Episode ${episodeNumber} - TX Date`,
  });

  try {
    // Create the episode
    const episode = await createEpisode({
      projectId: input.projectId,
      topicProposalId: input.topicProposalId,
      calendarItemId: calendarItem.id,
      title: input.title,
      episodeNumber,
      txDate: input.txDate,
      txTime: input.txTime,
      timelineType: input.timelineType || template.timeline_type,
      productionStatus: input.topicProposalId ? 'topic_approved' : 'topic_pending',
      internalNotes: input.internalNotes,
      createdByUserId: input.createdByUserId,
    });

    // Calculate and create milestones
    const calculatedMilestones = calculateMilestonesFromTxDate(
      input.txDate,
      template.milestone_offsets
    );
    const milestoneInputs = toMilestoneInputs(episode.id, calculatedMilestones);
    const milestones = await createMilestones(milestoneInputs);

    // Update calendar item with episode link
    await updateCalendarItem(calendarItem.id, {
      episodeId: episode.id,
    });

    // Link proposal to episode if provided
    if (input.topicProposalId) {
      await linkProposalToEpisode(input.topicProposalId, episode.id, input.txDate);
    }

    return {
      ...episode,
      milestones,
    };
  } catch (error) {
    // Clean up calendar item if episode creation fails
    await deleteCalendarItem(calendarItem.id);
    throw error;
  }
}

/**
 * Reschedule an episode to a new TX date
 * Recalculates all milestone dates
 */
export async function rescheduleEpisode(
  episodeId: string,
  input: RescheduleEpisodeInput
): Promise<ProductionEpisode> {
  const episode = await getEpisodeById(episodeId, true);
  if (!episode) {
    throw new Error('Episode not found');
  }

  const oldTxDate = episode.tx_date;
  const milestones = episode.milestones || [];

  // Recalculate milestone dates
  const updatedMilestones = recalculateMilestoneDates(milestones, oldTxDate, input.newTxDate);

  // Update all milestones in a batch
  for (const update of updatedMilestones) {
    const milestone = milestones.find((m) => m.id === update.id);
    if (milestone) {
      // Reset status if not preserving and milestone was overdue/pending
      const newStatus = input.preserveMilestoneStatus
        ? undefined
        : milestone.status === 'overdue'
        ? 'pending'
        : undefined;

      await updateMilestone(update.id, {
        deadlineDate: update.deadlineDate,
        status: newStatus,
      });
    }
  }

  // Update episode TX date
  const updatedEpisode = await updateEpisode(episodeId, {
    txDate: input.newTxDate,
    txTime: input.newTxTime !== undefined ? input.newTxTime : episode.tx_time,
  });

  // Update linked calendar item if exists
  if (episode.calendar_item_id) {
    await updateCalendarItem(episode.calendar_item_id, {
      scheduledDate: input.newTxDate,
      scheduledTime: input.newTxTime !== undefined ? input.newTxTime : undefined,
    });
  }

  // Update linked proposal if exists
  if (episode.topic_proposal_id) {
    await updateProposalTxDate(episode.topic_proposal_id, input.newTxDate);
  }

  // Fetch updated episode with milestones
  return (await getEpisodeById(episodeId, true))!;
}

/**
 * Cancel an episode
 * Sets status to cancelled but doesn't delete
 */
export async function cancelEpisode(episodeId: string): Promise<ProductionEpisode> {
  const episode = await getEpisodeById(episodeId, false);
  if (!episode) {
    throw new Error('Episode not found');
  }

  // Update episode status
  const updatedEpisode = await updateEpisode(episodeId, {
    productionStatus: 'cancelled',
  });

  // Update calendar item status if exists
  if (episode.calendar_item_id) {
    await updateCalendarItem(episode.calendar_item_id, {
      status: 'cancelled',
    });
  }

  // Skip all pending milestones
  const milestones = await getMilestonesByEpisodeId(episodeId);
  for (const milestone of milestones) {
    if (milestone.status === 'pending' || milestone.status === 'in_progress') {
      await updateMilestone(milestone.id, { status: 'skipped' });
    }
  }

  return updatedEpisode;
}

/**
 * Delete an episode completely
 * Removes episode, milestones, and unlinks from proposal
 */
export async function removeEpisode(episodeId: string): Promise<void> {
  const episode = await getEpisodeById(episodeId, false);
  if (!episode) {
    throw new Error('Episode not found');
  }

  // Unlink from proposal first
  if (episode.topic_proposal_id) {
    await unlinkProposalFromEpisode(episode.topic_proposal_id);
  }

  // Delete calendar item if exists
  if (episode.calendar_item_id) {
    await deleteCalendarItem(episode.calendar_item_id);
  }

  // Delete episode (milestones cascade)
  await deleteEpisode(episodeId);
}

/**
 * Regenerate milestones for an episode from a new template
 */
export async function regenerateMilestones(
  episodeId: string,
  templateId: string
): Promise<ProductionMilestone[]> {
  const episode = await getEpisodeById(episodeId, false);
  if (!episode) {
    throw new Error('Episode not found');
  }

  const template = await getTemplateById(templateId);
  if (!template) {
    throw new Error('Template not found');
  }

  // Delete existing milestones
  await deleteMilestonesByEpisodeId(episodeId);

  // Calculate and create new milestones
  const calculatedMilestones = calculateMilestonesFromTxDate(
    episode.tx_date,
    template.milestone_offsets
  );
  const milestoneInputs = toMilestoneInputs(episodeId, calculatedMilestones);
  return createMilestones(milestoneInputs);
}

/**
 * Update episode production status
 */
export async function updateEpisodeStatus(
  episodeId: string,
  status: ProductionEpisode['production_status']
): Promise<ProductionEpisode> {
  return updateEpisode(episodeId, { productionStatus: status });
}

/**
 * Mark episode as client approved
 */
export async function approveEpisodeByClient(
  episodeId: string,
  userId: string
): Promise<ProductionEpisode> {
  return updateEpisode(episodeId, {
    clientApprovedAt: new Date().toISOString(),
    clientApprovedByUserId: userId,
    productionStatus: 'topic_approved',
  });
}

/**
 * Complete a milestone
 */
export async function completeMilestone(
  milestoneId: string,
  userId: string,
  notes?: string
): Promise<ProductionMilestone> {
  return updateMilestone(milestoneId, {
    status: 'completed',
    completedAt: new Date().toISOString(),
    completedByUserId: userId,
    notes,
  });
}

/**
 * Start a milestone (mark as in progress)
 */
export async function startMilestone(milestoneId: string): Promise<ProductionMilestone> {
  return updateMilestone(milestoneId, {
    status: 'in_progress',
  });
}

/**
 * Skip a milestone
 */
export async function skipMilestone(
  milestoneId: string,
  notes?: string
): Promise<ProductionMilestone> {
  return updateMilestone(milestoneId, {
    status: 'skipped',
    notes,
  });
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Link a topic proposal to an episode
 */
async function linkProposalToEpisode(
  proposalId: string,
  episodeId: string,
  txDate: string
): Promise<void> {
  const { error } = await supabase
    .from('topic_proposals')
    .update({
      linked_episode_id: episodeId,
      scheduled_tx_date: txDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', proposalId);

  if (error) {
    console.error('[episode-service] Failed to link proposal to episode:', error.message);
  }
}

/**
 * Update proposal TX date
 */
async function updateProposalTxDate(proposalId: string, txDate: string): Promise<void> {
  const { error } = await supabase
    .from('topic_proposals')
    .update({
      scheduled_tx_date: txDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', proposalId);

  if (error) {
    console.error('[episode-service] Failed to update proposal TX date:', error.message);
  }
}

/**
 * Unlink a topic proposal from its episode
 */
async function unlinkProposalFromEpisode(proposalId: string): Promise<void> {
  const { error } = await supabase
    .from('topic_proposals')
    .update({
      linked_episode_id: null,
      scheduled_tx_date: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', proposalId);

  if (error) {
    console.error('[episode-service] Failed to unlink proposal from episode:', error.message);
  }
}

/**
 * Get episode summary for dashboard
 */
export async function getEpisodeSummary(
  projectId: string
): Promise<{
  total: number;
  byStatus: Record<string, number>;
  upcomingTxDates: Array<{ episodeId: string; title: string; txDate: string }>;
  overdueMilestones: number;
}> {
  // Get all episodes
  const { data: episodes, error: episodesError } = await supabase
    .from('production_episodes')
    .select('id, title, tx_date, production_status')
    .eq('project_id', projectId)
    .neq('production_status', 'cancelled');

  if (episodesError) {
    throw new Error(episodesError.message);
  }

  // Count by status
  const byStatus: Record<string, number> = {};
  for (const ep of episodes || []) {
    byStatus[ep.production_status] = (byStatus[ep.production_status] || 0) + 1;
  }

  // Get upcoming TX dates (next 14 days)
  const today = new Date().toISOString().split('T')[0];
  const twoWeeksLater = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const upcomingTxDates = (episodes || [])
    .filter((ep) => ep.tx_date >= today && ep.tx_date <= twoWeeksLater)
    .map((ep) => ({
      episodeId: ep.id,
      title: ep.title,
      txDate: ep.tx_date,
    }))
    .sort((a, b) => a.txDate.localeCompare(b.txDate))
    .slice(0, 5);

  // Count overdue milestones
  const { count: overdueMilestones, error: milestonesError } = await supabase
    .from('production_milestones')
    .select('id', { count: 'exact', head: true })
    .lt('deadline_date', today)
    .in('status', ['pending', 'in_progress']);

  if (milestonesError) {
    throw new Error(milestonesError.message);
  }

  return {
    total: episodes?.length || 0,
    byStatus,
    upcomingTxDates,
    overdueMilestones: overdueMilestones || 0,
  };
}
