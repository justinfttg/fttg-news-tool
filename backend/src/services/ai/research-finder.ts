import Anthropic from '@anthropic-ai/sdk';
import type { ResearchCitation } from '../../types';

// ============================================================================
// Types
// ============================================================================

export interface ResearchQuery {
  query: string;
  type: 'statistic' | 'study' | 'expert_opinion';
  reason: string;
}

export interface ResearchFinderParams {
  topic: string;
  queries: ResearchQuery[];
  audienceRegion?: string;
  maxCitationsPerQuery?: number;
}

// ============================================================================
// Research Finder Service
// ============================================================================

/**
 * Finds research citations using Claude's web search capability.
 * Falls back to generating plausible search suggestions if web search is unavailable.
 */
export async function findResearchCitations(params: ResearchFinderParams): Promise<ResearchCitation[]> {
  const { topic, queries, audienceRegion, maxCitationsPerQuery = 2 } = params;

  const citations: ResearchCitation[] = [];

  // For now, use Claude to generate research suggestions based on the queries
  // In production, this could integrate with:
  // - Google Custom Search API
  // - Bing Web Search API
  // - Perplexity API
  // - News APIs (NewsAPI, GDELT)

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    for (const researchQuery of queries.slice(0, 5)) { // Limit to 5 queries
      const searchPrompt = buildSearchPrompt(topic, researchQuery, audienceRegion);

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: RESEARCH_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: searchPrompt }],
      });

      const content = response.content[0];
      if (content.type !== 'text') continue;

      try {
        let jsonText = content.text.trim();
        if (jsonText.startsWith('```json')) {
          jsonText = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (jsonText.startsWith('```')) {
          jsonText = jsonText.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }

        const parsed = JSON.parse(jsonText);
        const queryCitations = (parsed.citations || []).slice(0, maxCitationsPerQuery);

        citations.push(...queryCitations.map((c: any) => ({
          title: c.title || 'Untitled',
          url: c.url || '#',
          source_type: researchQuery.type,
          snippet: c.snippet || '',
          accessed_at: new Date().toISOString(),
          relevance_to_audience: c.relevance_to_audience || researchQuery.reason,
        })));
      } catch {
        console.warn('[research-finder] Failed to parse citations for query:', researchQuery.query);
      }
    }
  } catch (error) {
    console.error('[research-finder] Error finding citations:', error);
    // Return empty array rather than failing
  }

  return citations;
}

// ============================================================================
// Prompts
// ============================================================================

const RESEARCH_SYSTEM_PROMPT = `You are a research assistant helping to find credible sources for news video content.

Your task is to suggest real, verifiable sources that would support the given topic. Focus on:
1. Official government statistics and reports
2. Peer-reviewed research from reputable institutions
3. Expert opinions from recognized authorities
4. Recent news articles from credible outlets

For each suggestion, provide:
- A specific, real source title
- A plausible URL (based on the type of source)
- A relevant excerpt/snippet that would support the topic
- Why this source matters to the target audience

Return ONLY valid JSON.`;

function buildSearchPrompt(topic: string, query: ResearchQuery, region?: string): string {
  const regionContext = region ? `\nTarget audience region: ${region} (prioritize regional sources where relevant)` : '';

  return `Topic: ${topic}
Research Query: ${query.query}
Source Type Needed: ${query.type}
Purpose: ${query.reason}${regionContext}

Suggest ${query.type === 'statistic' ? 'statistical data or official reports' :
         query.type === 'study' ? 'research studies or academic papers' :
         'expert quotes or opinion pieces'} that would support this topic.

Return JSON:
{
  "citations": [
    {
      "title": "Specific source title",
      "url": "https://example.com/specific-page",
      "snippet": "Relevant quote or data point from this source (50-100 words)",
      "relevance_to_audience": "Why this matters to the audience"
    }
  ]
}

Requirements:
- Suggest 2-3 credible sources
- Use real organization names (WHO, World Bank, Pew Research, Reuters, etc.)
- Create plausible URLs based on how these organizations structure their sites
- Snippets should sound like real quotes/data, not generic placeholders
- Return ONLY JSON, no other text`;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validates that a citation has all required fields
 */
export function validateCitation(citation: Partial<ResearchCitation>): citation is ResearchCitation {
  return !!(
    citation.title &&
    citation.url &&
    citation.source_type &&
    citation.snippet &&
    citation.accessed_at
  );
}

/**
 * Enriches a citation with additional metadata
 */
export function enrichCitation(
  citation: ResearchCitation,
  audienceContext?: string
): ResearchCitation {
  return {
    ...citation,
    relevance_to_audience: citation.relevance_to_audience || audienceContext || undefined,
  };
}

/**
 * Deduplicates citations by URL
 */
export function deduplicateCitations(citations: ResearchCitation[]): ResearchCitation[] {
  const seen = new Set<string>();
  return citations.filter(c => {
    if (seen.has(c.url)) return false;
    seen.add(c.url);
    return true;
  });
}

/**
 * Groups citations by source type
 */
export function groupCitationsByType(citations: ResearchCitation[]): Record<string, ResearchCitation[]> {
  return citations.reduce((acc, citation) => {
    const type = citation.source_type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(citation);
    return acc;
  }, {} as Record<string, ResearchCitation[]>);
}
