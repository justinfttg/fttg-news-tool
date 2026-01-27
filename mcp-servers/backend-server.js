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

class BackendServer {
  constructor() {
    this.server = new Server(
      {
        name: "fttg-backend-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.apiDomains = [
      "auth",
      "projects",
      "calendar",
      "news",
      "angles",
      "scripts",
      "approvals",
      "collaboration",
      "frameworks",
      "settings",
    ];

    this.setupHandlers();
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "generate_endpoint",
          description: "Generate a REST API endpoint with Express handler",
          inputSchema: {
            type: "object",
            properties: {
              method: {
                type: "string",
                enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
              },
              path: {
                type: "string",
                description: "API path (e.g., /api/calendar/items/:id)",
              },
              description: {
                type: "string",
                description: "What the endpoint does",
              },
              requires_auth: {
                type: "boolean",
                description: "Whether endpoint requires authentication",
              },
              request_body: {
                type: "string",
                description: "Expected request body structure",
              },
            },
            required: ["method", "path", "description"],
          },
        },
        {
          name: "generate_service",
          description: "Generate a service layer class for business logic",
          inputSchema: {
            type: "object",
            properties: {
              service_name: {
                type: "string",
                description: "Name of the service (e.g., CalendarService)",
              },
              methods: {
                type: "array",
                items: { type: "string" },
                description: "List of method names the service should have",
              },
              dependencies: {
                type: "array",
                items: { type: "string" },
                description: "Other services or modules this depends on",
              },
            },
            required: ["service_name", "methods"],
          },
        },
        {
          name: "generate_middleware",
          description: "Generate Express middleware",
          inputSchema: {
            type: "object",
            properties: {
              middleware_type: {
                type: "string",
                enum: ["auth", "validation", "error_handler", "rate_limit", "logging"],
              },
              description: { type: "string" },
            },
            required: ["middleware_type"],
          },
        },
        {
          name: "generate_validation",
          description: "Generate Zod validation schema for request/response",
          inputSchema: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "Schema name (e.g., CreateProjectSchema)",
              },
              fields: {
                type: "string",
                description: "Description of fields and their types/constraints",
              },
            },
            required: ["name", "fields"],
          },
        },
        {
          name: "review_api_security",
          description: "Review an API endpoint for security issues",
          inputSchema: {
            type: "object",
            properties: {
              code: {
                type: "string",
                description: "The API handler code to review",
              },
            },
            required: ["code"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "generate_endpoint":
          return await this.generateEndpoint(args);
        case "generate_service":
          return await this.generateService(args);
        case "generate_middleware":
          return await this.generateMiddleware(args);
        case "generate_validation":
          return await this.generateValidation(args);
        case "review_api_security":
          return await this.reviewApiSecurity(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  async generateEndpoint(args) {
    const { method, path: apiPath, description, requires_auth, request_body } = args;
    const domain = apiPath.split("/")[2] || "unknown";

    const code = `import { Request, Response } from 'express';
import { supabase } from '../../db/supabase';
${requires_auth !== false ? "import { authMiddleware } from '../../middleware/auth';" : ""}

/**
 * ${method} ${apiPath}
 * ${description}
 */
export async function handler(req: Request, res: Response) {
  try {
    ${requires_auth !== false ? `// Authenticated user from middleware
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }` : "// Public endpoint - no auth required"}

    ${method === "GET" ? this.generateGetHandler(apiPath) : ""}
    ${method === "POST" ? this.generatePostHandler(apiPath, request_body) : ""}
    ${method === "PUT" || method === "PATCH" ? this.generateUpdateHandler(apiPath, request_body) : ""}
    ${method === "DELETE" ? this.generateDeleteHandler(apiPath) : ""}

  } catch (error) {
    console.error('${method} ${apiPath} error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}`;

    return {
      content: [
        {
          type: "text",
          text: `API ENDPOINT GENERATED

Method: ${method}
Path: ${apiPath}
Domain: ${domain}
Auth Required: ${requires_auth !== false}

File: backend/src/api/${domain}/${method.toLowerCase()}-${apiPath.split("/").pop().replace(":", "")}.ts

\`\`\`typescript
${code}
\`\`\`

Route Registration (in backend/src/index.ts):
\`\`\`typescript
import { handler as ${method.toLowerCase()}${this.toPascalCase(apiPath)} } from './api/${domain}/handler';
app.${method.toLowerCase()}('${apiPath}', ${requires_auth !== false ? "authMiddleware, " : ""}${method.toLowerCase()}${this.toPascalCase(apiPath)});
\`\`\`

Checklist:
☐ Add input validation (Zod schema)
☐ Add proper error messages
☐ Test with curl/Postman
☐ Add to API documentation
☐ Consider rate limiting`,
        },
      ],
    };
  }

  generateGetHandler(apiPath) {
    const hasId = apiPath.includes(":id");
    if (hasId) {
      return `const { id } = req.params;

    const { data, error } = await supabase
      .from('${this.getTableFromPath(apiPath)}')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.json({ data });`;
    }

    return `const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const { data, error, count } = await supabase
      .from('${this.getTableFromPath(apiPath)}')
      .select('*', { count: 'exact' })
      .range(offset, offset + Number(limit) - 1)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ data, total: count, page: Number(page), limit: Number(limit) });`;
  }

  generatePostHandler(apiPath, requestBody) {
    return `const body = req.body;
    // TODO: Validate with Zod schema

    const { data, error } = await supabase
      .from('${this.getTableFromPath(apiPath)}')
      .insert({
        ...body,
        created_by_user_id: userId,
      })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({ data });`;
  }

  generateUpdateHandler(apiPath, requestBody) {
    return `const { id } = req.params;
    const body = req.body;
    // TODO: Validate with Zod schema

    const { data, error } = await supabase
      .from('${this.getTableFromPath(apiPath)}')
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.json({ data });`;
  }

  generateDeleteHandler(apiPath) {
    return `const { id } = req.params;

    const { error } = await supabase
      .from('${this.getTableFromPath(apiPath)}')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(204).send();`;
  }

  getTableFromPath(apiPath) {
    const parts = apiPath.split("/").filter(Boolean);
    // /api/calendar/items -> calendar_items
    if (parts.length >= 3 && parts[2] !== ":id") {
      return `${parts[1]}_${parts[2]}`;
    }
    return parts[1] || "unknown";
  }

  toPascalCase(str) {
    return str
      .split("/")
      .filter((s) => s && !s.startsWith(":"))
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join("");
  }

  async generateService(args) {
    const { service_name, methods, dependencies } = args;

    const code = `import { supabase } from '../db/supabase';
${(dependencies || []).map((d) => `import { ${d} } from './${d.charAt(0).toLowerCase() + d.slice(1)}';`).join("\n")}

export class ${service_name} {
  ${(dependencies || []).map((d) => `private ${d.charAt(0).toLowerCase() + d.slice(1)}: ${d};`).join("\n  ")}

  constructor(${(dependencies || []).map((d) => `${d.charAt(0).toLowerCase() + d.slice(1)}: ${d}`).join(", ")}) {
    ${(dependencies || []).map((d) => `this.${d.charAt(0).toLowerCase() + d.slice(1)} = ${d.charAt(0).toLowerCase() + d.slice(1)};`).join("\n    ")}
  }

${methods.map((m) => `  async ${m}(params: Record<string, unknown>): Promise<unknown> {
    try {
      // TODO: Implement ${m}
      throw new Error('Not implemented: ${m}');
    } catch (error) {
      console.error('${service_name}.${m} error:', error);
      throw error;
    }
  }`).join("\n\n")}
}

// Singleton instance
export const ${service_name.charAt(0).toLowerCase() + service_name.slice(1)} = new ${service_name}(${(dependencies || []).map((d) => `new ${d}()`).join(", ")});`;

    return {
      content: [
        {
          type: "text",
          text: `SERVICE GENERATED: ${service_name}

File: backend/src/services/${service_name.charAt(0).toLowerCase() + service_name.slice(1)}.ts

\`\`\`typescript
${code}
\`\`\`

Methods to implement:
${methods.map((m, i) => `${i + 1}. ${m}`).join("\n")}

Architecture Notes:
- Services handle business logic, not HTTP concerns
- Use dependency injection for testability
- Keep methods focused (single responsibility)
- Throw typed errors for proper HTTP mapping`,
        },
      ],
    };
  }

  async generateMiddleware(args) {
    const { middleware_type, description } = args;

    const templates = {
      auth: `import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; email: string; org_id: string; is_fttg_team: boolean };
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as Express.Request['user'];
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}`,

      validation: `import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message
        }))
      });
    }

    req.body = result.data;
    next();
  };
}`,

      error_handler: `import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code
    });
  }

  console.error('Unhandled error:', err);
  return res.status(500).json({
    error: 'Internal server error'
  });
}`,

      rate_limit: `import { Request, Response, NextFunction } from 'express';

const requests = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(maxRequests = 100, windowMs = 60000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const record = requests.get(key);

    if (!record || now > record.resetAt) {
      requests.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    record.count++;
    next();
  };
}`,

      logging: `import { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      \`[\${new Date().toISOString()}] \${req.method} \${req.path} \${res.statusCode} \${duration}ms\`
    );
  });

  next();
}`,
    };

    const code = templates[middleware_type] || "// Unknown middleware type";

    return {
      content: [
        {
          type: "text",
          text: `MIDDLEWARE GENERATED: ${middleware_type}

File: backend/src/middleware/${middleware_type}.ts

\`\`\`typescript
${code}
\`\`\`

Usage:
\`\`\`typescript
import { ${middleware_type === "auth" ? "authMiddleware" : middleware_type === "validation" ? "validate" : middleware_type === "error_handler" ? "errorHandler" : middleware_type === "rate_limit" ? "rateLimit" : "requestLogger"} } from './middleware/${middleware_type}';

// Apply to routes
app.use(${middleware_type === "error_handler" ? "errorHandler" : middleware_type === "logging" ? "requestLogger" : `/* apply as needed */`});
\`\`\``,
        },
      ],
    };
  }

  async generateValidation(args) {
    const { name, fields } = args;

    return {
      content: [
        {
          type: "text",
          text: `VALIDATION SCHEMA: ${name}

File: backend/src/validation/${name.charAt(0).toLowerCase() + name.slice(1)}.ts

\`\`\`typescript
import { z } from 'zod';

export const ${name} = z.object({
  // Based on: ${fields}
  // TODO: Define fields with proper Zod types
});

export type ${name.replace("Schema", "")}Input = z.infer<typeof ${name}>;
\`\`\`

Common Zod Patterns for FTTG:
\`\`\`typescript
// UUID fields
id: z.string().uuid()

// Status enums
status: z.enum(['draft', 'pending_review', 'approved', 'in_production', 'published', 'cancelled'])

// Dates
scheduled_date: z.string().datetime()

// Optional with defaults
posting_frequency: z.enum(['daily', 'weekly', 'bi-weekly', 'monthly', 'custom']).default('weekly')

// Constrained numbers
video_quota_per_year: z.number().int().min(1).max(365)

// JSONB arrays
social_platforms: z.array(z.string()).default([])
\`\`\`

Usage with middleware:
\`\`\`typescript
app.post('/api/...', validate(${name}), handler);
\`\`\``,
        },
      ],
    };
  }

  async reviewApiSecurity(args) {
    const { code } = args;
    const issues = [];

    // Check for common security issues
    if (!code.includes("auth") && !code.includes("middleware")) {
      issues.push("⚠️ No authentication check detected");
    }
    if (code.includes("req.body") && !code.includes("validate") && !code.includes("zod") && !code.includes("schema")) {
      issues.push("❌ Request body not validated - risk of injection");
    }
    if (code.includes("req.params") && !code.includes("uuid") && !code.includes("validate")) {
      issues.push("⚠️ URL params not validated - ensure UUID format");
    }
    if (!code.includes("try") || !code.includes("catch")) {
      issues.push("⚠️ Missing error handling");
    }
    if (code.includes("eval(") || code.includes("Function(")) {
      issues.push("❌ CRITICAL: eval() or Function() detected - code injection risk");
    }
    if (code.includes("sql") && !code.includes("parameterized") && !code.includes("supabase")) {
      issues.push("❌ Potential SQL injection - use parameterized queries or Supabase client");
    }
    if (code.includes("password") && !code.includes("hash")) {
      issues.push("❌ Password handling without hashing detected");
    }
    if (code.includes("res.json") && code.includes("password")) {
      issues.push("❌ CRITICAL: Password may be exposed in response");
    }

    return {
      content: [
        {
          type: "text",
          text: `SECURITY REVIEW

${issues.length === 0 ? "✅ No obvious security issues detected" : `Issues Found (${issues.length}):\n${issues.join("\n")}`}

Security Checklist:
☐ Authentication required for protected routes
☐ Input validation on all user inputs
☐ Parameterized queries (Supabase handles this)
☐ No sensitive data in responses (passwords, tokens)
☐ Rate limiting on auth endpoints
☐ CORS properly configured
☐ Error messages don't leak internal details
☐ File uploads validated (type, size)
☐ Authorization checks (user can access resource)`,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("FTTG Backend Server running on stdio");
  }
}

const server = new BackendServer();
server.run().catch(console.error);
