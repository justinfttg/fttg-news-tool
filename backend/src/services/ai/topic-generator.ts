import Anthropic from '@anthropic-ai/sdk';
import type {
  TopicCluster,
  TalkingPoint,
  ResearchCitation,
  TrendingContext,
  AudienceProfile,
  NewsStory,
} from '../../types';

// ============================================================================
// Configuration
// ============================================================================

const DURATION_CONFIG = {
  short: { minSeconds: 60, maxSeconds: 120, talkingPoints: { min: 2, max: 3 } },
  standard: { minSeconds: 180, maxSeconds: 240, talkingPoints: { min: 3, max: 4 } },
  long: { minSeconds: 300, maxSeconds: 600, talkingPoints: { min: 4, max: 5 } },
  custom: { minSeconds: 60, maxSeconds: 900, talkingPoints: { min: 2, max: 6 } },
};

// ============================================================================
// Input Types
// ============================================================================

export interface ClusterStoriesParams {
  stories: Array<{
    id: string;
    title: string;
    content: string;
    summary: string | null;
    source: string;
    category: string;
    published_at: string | null;
  }>;
  audienceProfile: AudienceProfile;
  trendingContext?: TrendingContext[];
}

export interface GenerateProposalParams {
  cluster: TopicCluster;
  stories: NewsStory[];
  audienceProfile: AudienceProfile;
  durationType: 'short' | 'standard' | 'long' | 'custom';
  durationSeconds: number;
  comparisonRegions: string[];
  trendingContext?: TrendingContext[];
}

export interface GeneratedProposal {
  title: string;
  hook: string;
  audience_care_statement: string;
  talking_points: TalkingPoint[];
  research_suggestions: Array<{
    query: string;
    type: 'statistic' | 'study' | 'expert_opinion';
    reason: string;
  }>;
}

// ============================================================================
// Anthropic Client
// ============================================================================

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }
  return new Anthropic({ apiKey });
}

// ============================================================================
// Clustering Service
// ============================================================================

const CLUSTERING_SYSTEM_PROMPT = `You are a news analyst AI that identifies thematic connections between news stories to create compelling video content topics.

Your task:
1. Group related stories by underlying themes, not just surface topics
2. Identify the "bigger picture" that connects multiple stories
3. Find patterns that would make compelling educational content
4. Consider the target audience's values, fears, and interests when scoring relevance
5. Prioritize themes that are timely and have cross-story connections

Return ONLY valid JSON matching the exact structure specified.`;

export async function clusterStoriesByTheme(params: ClusterStoriesParams): Promise<TopicCluster[]> {
  const { stories, audienceProfile, trendingContext } = params;

  if (stories.length === 0) {
    return [];
  }

  const anthropic = getAnthropicClient();

  // Build audience context
  const audienceContext = buildAudienceContext(audienceProfile);

  // Build stories list
  const storiesList = stories.map((s, i) => `
Story ${i + 1}:
- ID: ${s.id}
- Title: ${s.title}
- Category: ${s.category}
- Source: ${s.source}
- Published: ${s.published_at || 'Unknown'}
- Summary: ${s.summary || s.content.substring(0, 500)}...
`).join('\n');

  // Build trending context if available
  const trendingSection = trendingContext && trendingContext.length > 0
    ? `\n\nTRENDING TOPICS (consider how stories connect to these trends):
${trendingContext.map(t => `- ${t.trend_query} (${t.platforms.join(', ')})`).join('\n')}`
    : '';

  const userPrompt = `${audienceContext}

STORIES TO CLUSTER:
${storiesList}
${trendingSection}

Group these stories into thematic clusters. Each cluster should:
1. Connect at least 2 stories by a meaningful theme
2. Be relevant to the target audience's values and concerns
3. Have potential for educational video content

Return JSON:
{
  "clusters": [
    {
      "theme": "Short, engaging theme name (5-8 words)",
      "keywords": ["keyword1", "keyword2", "keyword3"],
      "story_ids": ["uuid1", "uuid2"],
      "relevance_score": 85,
      "audience_relevance": "One sentence explaining why this theme matters to this specific audience"
    }
  ]
}

Rules:
- Each story can appear in multiple clusters if relevant
- Relevance score 1-100 based on timeliness + audience fit + cross-story connections
- Create 1-5 clusters depending on how many meaningful themes emerge
- If stories don't have strong connections, create fewer clusters
- Return ONLY the JSON, no other text`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: CLUSTERING_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Parse JSON, handling potential markdown code blocks
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(jsonText);
    return (parsed.clusters || []) as TopicCluster[];
  } catch (error) {
    console.error('[topic-generator] Clustering error:', error);
    throw error;
  }
}

// ============================================================================
// Proposal Generation Service
// ============================================================================

function getToneInstructions(tone: AudienceProfile['preferred_tone']): string {
  switch (tone) {
    case 'investigative':
      return `Create a title that CHALLENGES the mainstream narrative. Use phrases like "The truth about...", "What they're not telling you about...", or pose a provocative question.`;
    case 'educational':
      return `Create a title that EXPLAINS and TEACHES. Use phrases like "Understanding...", "What you need to know about...", or "The science behind..."`;
    case 'provocative':
      return `Create a BOLD, attention-grabbing title. Make a surprising claim or ask a shocking question that demands attention.`;
    case 'conversational':
      return `Create a RELATABLE title in question format. Start with "Have you noticed...", "Why do we...", or address the audience directly.`;
    case 'balanced':
    default:
      return `Create a NEUTRAL, factual title that presents the topic objectively without strong bias.`;
  }
}

function getDepthInstructions(depth: AudienceProfile['depth_preference'], durationSeconds: number): { numPoints: number; detailLevel: string } {
  const baseConfig = DURATION_CONFIG[depth === 'deep_dive' ? 'long' : depth === 'surface' ? 'short' : 'standard'];

  switch (depth) {
    case 'surface':
      return {
        numPoints: 2,
        detailLevel: 'Keep supporting details brief (1-2 sentences). Focus on key takeaways only.',
      };
    case 'deep_dive':
      return {
        numPoints: Math.min(5, Math.ceil(durationSeconds / 90)),
        detailLevel: 'Provide comprehensive supporting details (3-5 sentences) with specific examples, data points, and citations.',
      };
    case 'medium':
    default:
      return {
        numPoints: Math.min(4, Math.ceil(durationSeconds / 60)),
        detailLevel: 'Provide moderate supporting details (2-3 sentences) with relevant examples.',
      };
  }
}

const PROPOSAL_SYSTEM_PROMPT = `You are a content strategist creating topic proposals for educational video content, inspired by 8world's "Know It More" 3-minute explainer format.

Your approach:
- Create compelling titles that spark curiosity
- Write hooks that immediately engage viewers by connecting to their specific concerns
- Structure talking points for the specified duration
- Frame everything through the lens of the target audience's values and fears
- Each talking point should be self-contained but build toward a coherent narrative

Return ONLY valid JSON matching the exact structure specified.`;

export async function generateTopicProposal(params: GenerateProposalParams): Promise<GeneratedProposal> {
  const {
    cluster,
    stories,
    audienceProfile,
    durationType,
    durationSeconds,
    comparisonRegions,
    trendingContext,
  } = params;

  const anthropic = getAnthropicClient();

  // Build audience context
  const audienceContext = buildAudienceContext(audienceProfile);

  // Get tone and depth instructions
  const toneInstructions = getToneInstructions(audienceProfile.preferred_tone);
  const depthConfig = getDepthInstructions(audienceProfile.depth_preference, durationSeconds);

  // Build stories context
  const storiesContext = stories.map(s => `
Title: ${s.title}
Source: ${s.source}
Summary: ${s.summary || s.content.substring(0, 800)}
`).join('\n---\n');

  // Build trending context
  const trendingSection = trendingContext && trendingContext.length > 0
    ? `\n\nRELATED TRENDING TOPICS:
${trendingContext.map(t => {
  let section = `- ${t.trend_query} (trending on: ${t.platforms.join(', ')})`;
  if (t.viral_posts && t.viral_posts.length > 0) {
    section += '\n  Sample viral posts:';
    t.viral_posts.slice(0, 2).forEach(p => {
      section += `\n  - [${p.platform}] "${p.content.substring(0, 100)}..." (engagement: ${p.engagement_score})`;
    });
  }
  return section;
}).join('\n')}`
    : '';

  // Political sensitivity instructions
  const sensitivityInstructions = audienceProfile.political_sensitivity && audienceProfile.political_sensitivity >= 7
    ? `\n\nIMPORTANT: This audience has HIGH political sensitivity (${audienceProfile.political_sensitivity}/10).
- Present multiple perspectives fairly
- Avoid taking explicit political stances
- Focus on facts and let the audience draw conclusions`
    : '';

  const userPrompt = `${audienceContext}
${sensitivityInstructions}

CLUSTER THEME: ${cluster.theme}
KEYWORDS: ${cluster.keywords.join(', ')}

SOURCE STORIES:
${storiesContext}
${trendingSection}

VIDEO CONFIGURATION:
- Duration: ${durationSeconds} seconds (${durationType})
- Number of talking points: ${depthConfig.numPoints}
- Comparison regions: ${comparisonRegions.join(', ') || 'None specified'}

TITLE INSTRUCTIONS:
${toneInstructions}

TALKING POINTS INSTRUCTIONS:
${depthConfig.detailLevel}
- Total duration of all talking points must equal ${durationSeconds} seconds
- Distribute time based on importance and complexity

Generate a topic proposal that speaks DIRECTLY to this audience. Return JSON:
{
  "title": "Compelling title following tone instructions",
  "hook": "2-3 sentences explaining why this matters NOW to THIS SPECIFIC AUDIENCE. Reference their values or address their fears.",
  "audience_care_statement": "2 sentences explaining specifically why ${audienceProfile.name} should care about this topic, referencing their unique characteristics.",
  "talking_points": [
    {
      "point": "Main talking point",
      "supporting_detail": "Supporting explanation following depth instructions",
      "duration_estimate_seconds": 60,
      "audience_framing": "How this point connects to audience's values/fears"
    }
  ],
  "research_suggestions": [
    {
      "query": "Specific search query to find supporting data",
      "type": "statistic|study|expert_opinion",
      "reason": "Why this research would strengthen the proposal for this audience"
    }
  ]
}

Return ONLY the JSON, no other text.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      system: PROPOSAL_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Parse JSON, handling potential markdown code blocks
    let jsonText = content.text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }

    const parsed = JSON.parse(jsonText);
    return parsed as GeneratedProposal;
  } catch (error) {
    console.error('[topic-generator] Proposal generation error:', error);
    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildAudienceContext(profile: AudienceProfile): string {
  const sections: string[] = [];

  sections.push(`TARGET AUDIENCE: ${profile.name}`);

  // Demographics
  const demographics: string[] = [];
  if (profile.age_range) demographics.push(`Age: ${profile.age_range}`);
  if (profile.location) demographics.push(`Location: ${profile.location}`);
  if (profile.education_level) demographics.push(`Education: ${profile.education_level}`);
  if (demographics.length > 0) {
    sections.push(`Demographics: ${demographics.join(', ')}`);
  }

  // Language & Market
  const market: string[] = [];
  if (profile.primary_language) market.push(`Language: ${profile.primary_language}`);
  if (profile.market_region) market.push(`Market: ${profile.market_region}`);
  if (profile.platform_type) market.push(`Platform: ${profile.platform_type}`);
  if (market.length > 0) {
    sections.push(`Market: ${market.join(', ')}`);
  }

  // Psychographics (most important for tailoring)
  if (profile.values && profile.values.length > 0) {
    sections.push(`VALUES (frame topics around these): ${profile.values.join(', ')}`);
  }
  if (profile.fears && profile.fears.length > 0) {
    sections.push(`FEARS (address these concerns): ${profile.fears.join(', ')}`);
  }
  if (profile.aspirations && profile.aspirations.length > 0) {
    sections.push(`ASPIRATIONS (connect to these goals): ${profile.aspirations.join(', ')}`);
  }
  if (profile.cultural_context) {
    sections.push(`Cultural Context: ${profile.cultural_context}`);
  }

  // Content preferences
  const prefs: string[] = [];
  if (profile.preferred_tone) prefs.push(`Tone: ${profile.preferred_tone}`);
  if (profile.depth_preference) prefs.push(`Depth: ${profile.depth_preference}`);
  if (profile.political_sensitivity) prefs.push(`Political Sensitivity: ${profile.political_sensitivity}/10`);
  if (prefs.length > 0) {
    sections.push(`Content Preferences: ${prefs.join(', ')}`);
  }

  return sections.join('\n');
}

// ============================================================================
// Hash Generation (for cache invalidation)
// ============================================================================

export function generateStoriesHash(stories: Array<{ id: string; published_at: string | null }>): string {
  const data = stories.map(s => `${s.id}:${s.published_at}`).sort().join('|');
  // Simple hash - could use crypto if needed
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

export function generateTrendsHash(trends: TrendingContext[]): string {
  const data = trends.map(t => `${t.trend_query}:${t.platforms.join(',')}`).sort().join('|');
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}
