import Anthropic from '@anthropic-ai/sdk';

export interface AngleGenerationParams {
  newsStory: {
    id: string;
    title: string;
    content: string;
    source: string;
    published_at: string | null;
  };
  audienceProfile: {
    id: string;
    name: string;
    age_range: string | null;
    location: string | null;
    education_level: string | null;
    primary_language: string | null;
    market_region: string | null;
    values: string[];
    fears: string[];
    aspirations: string[];
    cultural_context: string | null;
    preferred_tone: string | null;
    depth_preference: string | null;
    political_sensitivity: number | null;
  };
  frameworkType: 'fttg_investigative' | 'educational_deepdive';
  comparisonRegions?: string[];
}

export interface GeneratedAngle {
  framework_type: string;
  angle_data: Record<string, any>;
  audience_care_statement: string;
  comparison_regions: string[];
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

const FTTG_INVESTIGATIVE_SYSTEM_PROMPT = `You are an investigative journalist AI trained in FTTG's contrarian storytelling framework.

Your approach:
- Challenge mainstream narratives with evidence
- Expose disconnects between stated goals and reality
- Use specific data (prices, percentages, quotes) over generalities
- Show don't tell: Paint scenes, use concrete examples
- Question authority's true motives

Generate angles that make audiences think: "Wait, that's not what I was told."

Output Structure: Follow the 7-step FTTG Investigative framework precisely.
Return your response as a valid JSON object.`;

const EDUCATIONAL_DEEPDIVE_SYSTEM_PROMPT = `You are an educational content AI trained in John Oliver's Last Week Tonight style of explanatory journalism.

Your approach:
- Make complex topics accessible without dumbing them down
- Use humor to maintain engagement (absurdity, irony, relatable analogies)
- Build from simple to complex progressively
- Layer evidence systematically (data, clips, expert voices)
- Show human impact with specific stories
- Identify systemic causes, not just symptoms
- Suggest visual aids that clarify concepts
- End with actionable takeaways

Your tone: Conversational, witty, empathetic, educational
Your goal: Audiences leave understanding WHY this matters and WHAT should change

Output Structure: Follow the 8-step Educational Deep-Dive framework precisely.
Return your response as a valid JSON object.`;

function buildFTTGInvestigativePrompt(params: AngleGenerationParams): string {
  const { newsStory, audienceProfile, comparisonRegions } = params;

  return `STORY TO ANALYZE:
Title: ${newsStory.title}
Content: ${newsStory.content.slice(0, 6000)}
Source: ${newsStory.source}
Published: ${newsStory.published_at || 'Unknown'}

AUDIENCE CONTEXT:
Name: ${audienceProfile.name}
Demographics: ${audienceProfile.age_range || 'General'}, ${audienceProfile.location || 'Global'}
Language: ${audienceProfile.primary_language || 'English'}
Market: ${audienceProfile.market_region || 'Global'}
Values: ${JSON.stringify(audienceProfile.values)}
Fears: ${JSON.stringify(audienceProfile.fears)}
Aspirations: ${JSON.stringify(audienceProfile.aspirations)}
Cultural Context: ${audienceProfile.cultural_context || 'General audience'}
Preferred Tone: ${audienceProfile.preferred_tone || 'balanced'}
Political Sensitivity: ${audienceProfile.political_sensitivity || 5}/10

COMPARISON SCOPE: ${comparisonRegions?.join(', ') || 'Global comparisons'}

TASK: Generate ONE investigative angle using the 7-step FTTG framework.

Your response MUST be a JSON object with this exact structure:
{
  "contrarian_headline": "A headline that challenges the mainstream narrative (5-10 words)",
  "narrative_extraction": "The official story being told (2-3 sentences)",
  "contradiction_finder": [
    {"point": "Specific contradiction", "source": "Source or evidence"}
  ],
  "comparison_framework": {
    "subject": "How the subject handled it",
    "comparison_1": {"region": "Region name", "approach": "How they handled it differently", "outcome": "What happened"}
  },
  "emotional_core": "Who is affected and the hidden cost with specific examples",
  "authority_challenge": "Critical analysis of the real motives",
  "conclusion": "A punchy, memorable reframe of the 'why'",
  "audience_care_statement": "Why THIS specific audience should care, connecting to their fears and aspirations",
  "supporting_evidence": ["URL or source 1", "URL or source 2"]
}

Return ONLY the JSON object, no other text.`;
}

function buildEducationalDeepDivePrompt(params: AngleGenerationParams): string {
  const { newsStory, audienceProfile } = params;

  return `TOPIC TO EXPLAIN:
Title: ${newsStory.title}
Content: ${newsStory.content.slice(0, 6000)}
Source: ${newsStory.source}

AUDIENCE CONTEXT:
Name: ${audienceProfile.name}
Education level: ${audienceProfile.education_level || 'General'}
Language: ${audienceProfile.primary_language || 'English'}
Market: ${audienceProfile.market_region || 'Global'}
Values: ${JSON.stringify(audienceProfile.values)}
Cultural Context: ${audienceProfile.cultural_context || 'General audience'}
Depth preference: ${audienceProfile.depth_preference || 'medium'}

TASK: Create ONE educational deep-dive angle using the 8-step framework.

Your response MUST be a JSON object with this exact structure:
{
  "timely_hook": "Why talk about this NOW? (2-3 sentences with humor if appropriate)",
  "context_setup": "Explain basics assuming zero knowledge (3-5 sentences)",
  "problem_breakdown": [
    {"issue": "Key issue 1", "explanation": "Brief explanation"},
    {"issue": "Key issue 2", "explanation": "Brief explanation"},
    {"issue": "Key issue 3", "explanation": "Brief explanation"}
  ],
  "evidence_layering": [
    {"point": "Evidence point", "source": "Source", "type": "statistic|quote|clip|data"}
  ],
  "human_impact": [
    {"story": "Real-world impact example with specific details"}
  ],
  "systemic_analysis": "Why does this keep happening? Root causes (3-5 sentences)",
  "visual_suggestions": [
    {"visual": "Description of visual aid", "purpose": "What it clarifies"}
  ],
  "call_to_action": [
    {"action": "What needs to change", "who": "Who should do it"}
  ],
  "audience_care_statement": "Why THIS specific audience should care",
  "humor_opportunities": ["Moment 1", "Moment 2", "Moment 3"],
  "estimated_duration": "Estimated time to cover this topic thoroughly"
}

Return ONLY the JSON object, no other text.`;
}

export async function generateStoryAngle(params: AngleGenerationParams): Promise<GeneratedAngle> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const anthropic = getClient();

  const systemPrompt = params.frameworkType === 'fttg_investigative'
    ? FTTG_INVESTIGATIVE_SYSTEM_PROMPT
    : EDUCATIONAL_DEEPDIVE_SYSTEM_PROMPT;

  const userPrompt = params.frameworkType === 'fttg_investigative'
    ? buildFTTGInvestigativePrompt(params)
    : buildEducationalDeepDivePrompt(params);

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{ role: 'user', content: userPrompt }],
      system: systemPrompt,
    });

    let responseText = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    // Strip markdown code blocks if present
    responseText = responseText.trim();
    if (responseText.startsWith('```json')) {
      responseText = responseText.slice(7);
    } else if (responseText.startsWith('```')) {
      responseText = responseText.slice(3);
    }
    if (responseText.endsWith('```')) {
      responseText = responseText.slice(0, -3);
    }
    responseText = responseText.trim();

    const parsed = JSON.parse(responseText);

    // Extract audience_care_statement from the response
    const audienceCareStatement = parsed.audience_care_statement ||
      'This story impacts the daily lives and futures of this audience.';

    // Remove audience_care_statement from angle_data since it's stored separately
    delete parsed.audience_care_statement;

    return {
      framework_type: params.frameworkType,
      angle_data: parsed,
      audience_care_statement: audienceCareStatement,
      comparison_regions: params.comparisonRegions || [],
    };
  } catch (error) {
    console.error('[angle-generator] Error:', error instanceof Error ? error.message : error);
    throw error;
  }
}
