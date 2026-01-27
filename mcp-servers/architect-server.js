#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";

const PROJECT_ROOT = process.env.PROJECT_ROOT || process.cwd();

class ArchitectServer {
  constructor() {
    this.server = new Server(
      {
        name: "fttg-architect-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupHandlers();
  }

  setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "validate_architecture",
          description: "Validate code against ARCHITECTURE.md principles",
          inputSchema: {
            type: "object",
            properties: {
              component_type: {
                type: "string",
                description: "Type: 'api', 'component', 'service', 'database'",
              },
              code_or_design: {
                type: "string",
                description: "Code snippet or design description to validate",
              },
            },
            required: ["component_type", "code_or_design"],
          },
        },
        {
          name: "review_integration",
          description: "Review how components integrate with each other",
          inputSchema: {
            type: "object",
            properties: {
              component_a: { type: "string" },
              component_b: { type: "string" },
              integration_point: { type: "string" },
            },
            required: ["component_a", "component_b"],
          },
        },
        {
          name: "suggest_design_pattern",
          description: "Suggest appropriate design pattern for a problem",
          inputSchema: {
            type: "object",
            properties: {
              problem_description: { type: "string" },
              context: { type: "string" },
            },
            required: ["problem_description"],
          },
        },
        {
          name: "read_architecture_doc",
          description: "Read sections from ARCHITECTURE.md",
          inputSchema: {
            type: "object",
            properties: {
              section: {
                type: "string",
                description: "Section to read: 'database', 'api', 'frameworks', 'all'",
              },
            },
            required: ["section"],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "validate_architecture":
          return await this.validateArchitecture(args);
        case "review_integration":
          return await this.reviewIntegration(args);
        case "suggest_design_pattern":
          return await this.suggestDesignPattern(args);
        case "read_architecture_doc":
          return await this.readArchitectureDoc(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  async validateArchitecture(args) {
    const { component_type, code_or_design } = args;

    // Read ARCHITECTURE.md
    const archPath = path.join(PROJECT_ROOT, "docs", "ARCHITECTURE.md");
    const architecture = await fs.readFile(archPath, "utf-8");

    // Validation logic based on component type
    const validationRules = {
      api: [
        "Should use Vercel serverless functions",
        "Must include authentication middleware where needed",
        "Should return consistent response format",
        "Error handling with proper HTTP codes",
      ],
      component: [
        "React functional component with TypeScript",
        "Use Tailwind CSS for styling",
        "Proper prop typing",
        "Accessibility considerations (ARIA labels)",
      ],
      service: [
        "Single responsibility principle",
        "Proper error handling and logging",
        "Type-safe interfaces",
        "Dependency injection where appropriate",
      ],
      database: [
        "Follows schema in ARCHITECTURE.md",
        "Proper foreign key relationships",
        "Indexes on frequently queried columns",
        "UUID primary keys",
      ],
    };

    const rules = validationRules[component_type] || [];

    return {
      content: [
        {
          type: "text",
          text: `ARCHITECT REVIEW - ${component_type.toUpperCase()}

Validation Rules for ${component_type}:
${rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}

Analysis:
${this.analyzeCode(code_or_design, rules)}

Recommendations:
- Ensure alignment with project architecture
- Check for proper error handling
- Validate type safety
- Consider performance implications

Reference relevant sections from ARCHITECTURE.md for details.`,
        },
      ],
    };
  }

  analyzeCode(code, rules) {
    // Simple heuristic analysis
    const issues = [];

    if (!code.includes("try") && !code.includes("catch")) {
      issues.push("⚠️ Missing error handling (try-catch)");
    }

    if (code.includes("any") && code.includes("TypeScript")) {
      issues.push("⚠️ Avoid using 'any' type in TypeScript");
    }

    if (!code.includes("export")) {
      issues.push("⚠️ Component/function should be exported");
    }

    return issues.length > 0
      ? `Issues Found:\n${issues.join("\n")}`
      : "✅ Code looks architecturally sound";
  }

  async reviewIntegration(args) {
    const { component_a, component_b, integration_point } = args;

    return {
      content: [
        {
          type: "text",
          text: `INTEGRATION REVIEW

Components:
- A: ${component_a}
- B: ${component_b}
${integration_point ? `- Integration Point: ${integration_point}` : ""}

Checklist:
☐ Data flow is unidirectional
☐ Error handling at boundaries
☐ Type safety across components
☐ No circular dependencies
☐ Proper state management
☐ API contracts are well-defined

Recommendations:
1. Define clear interfaces between components
2. Use TypeScript types to enforce contracts
3. Handle errors at integration boundaries
4. Consider using DTOs for data transfer
5. Document the integration in API.md`,
        },
      ],
    };
  }

  async suggestDesignPattern(args) {
    const { problem_description, context } = args;

    const patterns = {
      "state management": "Context API + useReducer for complex state",
      "data fetching": "React Query or SWR for caching and revalidation",
      "form handling": "react-hook-form + zod for validation",
      "authentication": "JWT with httpOnly cookies + refresh tokens",
      "calendar updates": "Optimistic updates with rollback on error",
      "drag and drop": "react-beautiful-dnd with onDragEnd handler",
    };

    return {
      content: [
        {
          type: "text",
          text: `DESIGN PATTERN SUGGESTION

Problem: ${problem_description}
${context ? `Context: ${context}` : ""}

Recommended Patterns:
${Object.entries(patterns)
  .map(([key, value]) => `- ${key}: ${value}`)
  .join("\n")}

For your specific case:
1. Analyze the problem domain
2. Consider scalability requirements
3. Check existing patterns in codebase
4. Ensure consistency with architecture

Consult ARCHITECTURE.md for approved patterns.`,
        },
      ],
    };
  }

  async readArchitectureDoc(args) {
    const { section } = args;
    const archPath = path.join(PROJECT_ROOT, "docs", "ARCHITECTURE.md");
    const content = await fs.readFile(archPath, "utf-8");

    if (section === "all") {
      return {
        content: [{ type: "text", text: content }],
      };
    }

    // Extract specific section
    const sectionRegex = new RegExp(
      `## ${section.toUpperCase()}[\\s\\S]*?(?=##|$)`,
      "i"
    );
    const match = content.match(sectionRegex);

    return {
      content: [
        {
          type: "text",
          text: match
            ? match[0]
            : `Section '${section}' not found in ARCHITECTURE.md`,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("FTTG Architect Server running on stdio");
  }
}

const server = new ArchitectServer();
server.run().catch(console.error);
