const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function backfill() {
  console.log("=== Backfilling milestone calendar items ===");

  // Get all episodes with their milestones
  const { data: episodes, error: e1 } = await supabase
    .from("production_episodes")
    .select("id, project_id, episode_number, title, tx_date, created_by_user_id, topic_proposal_id");

  if (e1) {
    console.log("Error fetching episodes:", e1.message);
    return;
  }

  console.log("Found", episodes.length, "episodes");

  for (const episode of episodes) {
    // Get milestones for this episode
    const { data: milestones, error: e2 } = await supabase
      .from("production_milestones")
      .select("id, milestone_type, label, deadline_date, deadline_time")
      .eq("episode_id", episode.id);

    if (e2) {
      console.log("Error fetching milestones for episode", episode.id);
      continue;
    }

    if (!milestones || milestones.length === 0) {
      console.log("No milestones for episode", episode.episode_number);
      continue;
    }

    // Check if milestone calendar items already exist
    const { data: existing, error: e3 } = await supabase
      .from("calendar_items")
      .select("id")
      .eq("episode_id", episode.id)
      .eq("is_milestone", true);

    if (existing && existing.length > 0) {
      console.log("Skipping episode", episode.episode_number, "- already has", existing.length, "milestone items");
      continue;
    }

    // Create calendar items for each milestone
    const records = milestones.map(m => ({
      project_id: episode.project_id,
      title: "Ep" + episode.episode_number + ": " + (m.label || m.milestone_type.replace(/_/g, " ")),
      scheduled_date: m.deadline_date,
      scheduled_time: m.deadline_time || null,
      episode_id: episode.id,
      milestone_id: m.id,
      milestone_type: m.milestone_type,
      is_milestone: true,
      created_by_user_id: episode.created_by_user_id,
      status: "draft",
    }));

    const { data: created, error: e4 } = await supabase
      .from("calendar_items")
      .insert(records)
      .select("id");

    if (e4) {
      console.log("Error creating milestone items for episode", episode.episode_number, ":", e4.message);
    } else {
      console.log("Created", created.length, "milestone calendar items for Ep", episode.episode_number);
    }

    // Also backfill linked_episode_id on the topic proposal
    if (episode.topic_proposal_id) {
      const { error: e5 } = await supabase
        .from("topic_proposals")
        .update({
          linked_episode_id: episode.id,
          scheduled_tx_date: episode.tx_date,
        })
        .eq("id", episode.topic_proposal_id);

      if (e5) {
        console.log("Error linking proposal", episode.topic_proposal_id);
      } else {
        console.log("  -> Linked proposal to episode");
      }
    }
  }

  console.log("=== Backfill complete ===");
}

backfill().catch(console.error);
