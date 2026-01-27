#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const PROJECT_ROOT = process.env.PROJECT_ROOT || process.cwd();

class AIServer {
  constructor() {
    this.server = new Server(
      {
        name: "fttg-ai-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.frameworks = {
      fttg_investigative: {
        name: "FTTG Investigative",
        steps: [
          "contrarian_headline",
          "narrative_extraction",
          "contradiction_finder",
          "comparison_framework",
          "emotional_core",
          "authority_challenge",
          "conclusion",
        ],
      },
      educational_deepdive: {
        name: "Educational Deep-Dive",
        steps: [
          "timely_hook",
          "context_setup",
          "problem_breakdown",
          "evidence_layering",
          "human_impact",
          "systemic_analysis",
          "visual_suggestions",
          "call_to_action",
        ],
      },
    };

    this.setupHandlers();
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "generate_framework_prompt",
          description: "Generate AI prompt for a storytelling framework",
          inputSchema: {
            type: "object",
            properties: {
              framework_type: {
                type: "string",
                enum: ["fttg_investigative", "educational_deepdive"],
              },
              news_story: { type: "string" },
              audience_context: { type: "string" },
            },
            required: ["framework_type", "news_story"],
          },
        },
        {
          name: "validate_framework_output",
          description: "Validate AI output matches framework structure",
          inputSchema: {
            type: "object",
            properties: {
              framework_type: { type: "string" },
              ai_output: { type: "string" },
            },
            required: ["framework_type", "ai_output"],
          },
        },
        {
          name: "estimate_tokens",
          description: "Estimate token count for prompt",
          inputSchema: {
            type: "object",
            properties: {
              prompt_text: { type: "string" },
            },
            required: ["prompt_text"],
          },
        },
        {
          name: "optimize_prompt",
          description: "Optimize prompt for token efficiency",
          inputSchema: {
            type: "object",
            properties: {
              original_prompt: { type: "string" },
              target_reduction: { type: "number" },
            },
            required: ["original_prompt"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "generate_framework_prompt":
          return await this.generateFrameworkPrompt(args);
        case "validate_framework_output":
          return await this.validateFrameworkOutput(args);
        case "estimate_tokens":
          return await this.estimateTokens(args);
        case "optimize_prompt":
          return await this.optimizePrompt(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  async generateFrameworkPrompt(args) {
    const { framework_type, news_story, audience_context } = args;
    const framework = this.frameworks[framework_type];

    if (!framework) {
      throw new Error(`Unknown framework: ${framework_type}`);
    }

    let prompt = "";

    if (framework_type === "fttg_investigative") {
      prompt = `SYSTEM PROMPT:
You are an investigative journalist AI using the FTTG Investigative framework.

Framework Steps:
${framework.steps.map((step, i) => `${i + 1}. ${step}`).join("\n")}

Core Principles:
- Challenge mainstream narratives with evidence
- Expose disconnects between stated goals and reality
- Use specific data (prices, percentages, quotes)
- Show don't tell: concrete examples over generalities
- Question authority's true motives

USER PROMPT:
Story: ${news_story}
${audience_context ? `Audience: ${audience_context}` : ""}

Generate 3 investigative angles using the 7-step framework.
Output as JSON array with each angle containing all 7 steps.`;
    } else if (framework_type === "educational_deepdive") {
      prompt = `SYSTEM PROMPT:
You are an educational content AI using the Educational Deep-Dive framework
(John Oliver Last Week Tonight style).

Framework Steps:
${framework.steps.map((step, i) => `${i + 1}. ${step}`).join("\n")}

Core Principles:
- Make complex topics accessible
- Use humor to maintain engagement
- Build from simple to complex progressively
- Layer evidence systematically
- Show human impact with specific stories
- Identify systemic causes
- Suggest visual aids
- End with actionable takeaways

USER PROMPT:
Topic: ${news_story}
${audience_context ? `Audience: ${audience_context}` : ""}

Create 2-3 educational angles using the 8-step framework.
Output as JSON array with each angle containing all 8 steps.`;
    }

    return {
      content: [
        {
          type: "text",
          text: `GENERATED PROMPT FOR ${framework.name}:

${prompt}

Token Estimate: ~${this.estimateTokenCount(prompt)} tokens

Tips:
- Test this prompt with sample news stories
- Adjust specificity based on results
- Monitor for hallucinations (especially in evidence_layering)
- Validate output structure matches framework steps`,
        },
      ],
    };
  }

  async validateFrameworkOutput(args) {
    const { framework_type, ai_output } = args;
    const framework = this.frameworks[framework_type];

    if (!framework) {
      throw new Error(`Unknown framework: ${framework_type}`);
    }

    try {
      const output = JSON.parse(ai_output);
      const issues = [];

      // Check if it's an array
      if (!Array.isArray(output)) {
        issues.push("❌ Output should be an array of angles");
      }

      // Validate each angle
      output.forEach((angle, i) => {
        framework.steps.forEach((step) => {
          if (!angle[step]) {
            issues.push(`❌ Angle ${i + 1} missing step: ${step}`);
          }
        });
      });

      return {
        content: [
          {
            type: "text",
            text: issues.length === 0
              ? `✅ OUTPUT VALID\n\nAll ${framework.steps.length} steps present in all angles.`
              : `VALIDATION ISSUES:\n\n${issues.join("\n")}\n\nRequired Steps:\n${framework.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ INVALID JSON\n\nError: ${error.message}\n\nOutput must be valid JSON array.`,
          },
        ],
      };
    }
  }

  async estimateTokens(args) {
    const { prompt_text } = args;
    const tokenCount = this.estimateTokenCount(prompt_text);

    return {
      content: [
        {
          type: "text",
          text: `TOKEN ESTIMATE

Prompt Length: ${prompt_text.length} characters
Estimated Tokens: ~${tokenCount}

Cost Estimates (Claude Sonnet 4):
- Input: $${((tokenCount / 1000) * 0.003).toFixed(4)}
- Output (assuming 1000 tokens): $${((1000 / 1000) * 0.015).toFixed(4)}
- Total per call: $${((tokenCount / 1000) * 0.003 + (1000 / 1000) * 0.015).toFixed(4)}

Monthly (100 calls): $${(((tokenCount / 1000) * 0.003 + (1000 / 1000) * 0.015) * 100).toFixed(2)}`,
        },
      ],
    };
  }

  async optimizePrompt(args) {
    const { original_prompt, target_reduction } = args;

    return {
      content: [
        {
          type: "text",
          text: `PROMPT OPTIMIZATION SUGGESTIONS

Original Token Count: ~${this.estimateTokenCount(original_prompt)}
Target Reduction: ${target_reduction || 20}%

Optimization Strategies:
1. Remove redundant examples
2. Use bullet points instead of paragraphs
3. Combine similar instructions
4. Remove meta-commentary ("please", "make sure to")
5. Use abbreviations where clear
6. Compress JSON structure examples

Example Optimizations:
❌ "Please make sure to include all 7 steps in your response"
✅ "Include all 7 steps"

❌ "The output should be formatted as a JSON array containing..."
✅ "Output: JSON array with..."

Apply these and re-run estimate_tokens to verify reduction.`,
        },
      ],
    };
  }

  estimateTokenCount(text) {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("FTTG AI Server running on stdio");
  }
}

const server = new AIServer();
server.run().catch(console.error);
