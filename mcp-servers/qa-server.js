#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const PROJECT_ROOT = process.env.PROJECT_ROOT || process.cwd();

class QAServer {
  constructor() {
    this.server = new Server(
      {
        name: "fttg-qa-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "generate_unit_test",
          description: "Generate unit tests for a function or component",
          inputSchema: {
            type: "object",
            properties: {
              target_type: {
                type: "string",
                enum: ["function", "component", "hook", "api_handler", "service"],
              },
              target_name: {
                type: "string",
                description: "Name of the function/component to test",
              },
              target_code: {
                type: "string",
                description: "The code to write tests for",
              },
              test_cases: {
                type: "array",
                items: { type: "string" },
                description: "Specific scenarios to test",
              },
            },
            required: ["target_type", "target_name"],
          },
        },
        {
          name: "generate_integration_test",
          description: "Generate integration tests for an API flow",
          inputSchema: {
            type: "object",
            properties: {
              flow_name: {
                type: "string",
                description: "Name of the flow (e.g., 'create project')",
              },
              endpoints: {
                type: "array",
                items: { type: "string" },
                description: "API endpoints involved",
              },
              steps: {
                type: "array",
                items: { type: "string" },
                description: "Steps in the integration flow",
              },
            },
            required: ["flow_name", "steps"],
          },
        },
        {
          name: "review_code_quality",
          description: "Review code for quality issues, bugs, and improvements",
          inputSchema: {
            type: "object",
            properties: {
              code: {
                type: "string",
                description: "The code to review",
              },
              language: {
                type: "string",
                enum: ["typescript", "javascript", "sql"],
              },
              context: {
                type: "string",
                description: "What the code does / where it's used",
              },
            },
            required: ["code"],
          },
        },
        {
          name: "security_audit",
          description: "Audit code for security vulnerabilities",
          inputSchema: {
            type: "object",
            properties: {
              code: {
                type: "string",
                description: "The code to audit",
              },
              audit_type: {
                type: "string",
                enum: ["api", "auth", "data_handling", "frontend", "full"],
              },
            },
            required: ["code", "audit_type"],
          },
        },
        {
          name: "generate_test_data",
          description: "Generate mock/fixture data for testing",
          inputSchema: {
            type: "object",
            properties: {
              entity_type: {
                type: "string",
                description: "The entity to create test data for (e.g., 'project', 'calendar_item')",
              },
              count: {
                type: "number",
                description: "Number of records to generate",
              },
              scenario: {
                type: "string",
                description: "Testing scenario (e.g., 'edge_cases', 'happy_path', 'error_states')",
              },
            },
            required: ["entity_type"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "generate_unit_test":
          return await this.generateUnitTest(args);
        case "generate_integration_test":
          return await this.generateIntegrationTest(args);
        case "review_code_quality":
          return await this.reviewCodeQuality(args);
        case "security_audit":
          return await this.securityAudit(args);
        case "generate_test_data":
          return await this.generateTestData(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  async generateUnitTest(args) {
    const { target_type, target_name, target_code, test_cases } = args;

    let testCode = "";

    switch (target_type) {
      case "function":
      case "service":
        testCode = this.generateFunctionTest(target_name, test_cases);
        break;
      case "component":
        testCode = this.generateComponentTest(target_name, test_cases);
        break;
      case "hook":
        testCode = this.generateHookTest(target_name, test_cases);
        break;
      case "api_handler":
        testCode = this.generateApiHandlerTest(target_name, test_cases);
        break;
    }

    return {
      content: [
        {
          type: "text",
          text: `UNIT TESTS GENERATED: ${target_name}

File: ${this.getTestFilePath(target_type, target_name)}
Framework: Vitest
${target_type === "component" ? "Rendering: @testing-library/react" : ""}

\`\`\`typescript
${testCode}
\`\`\`

Test Coverage Goals:
- Happy path: Normal operation
- Edge cases: Empty inputs, boundaries
- Error handling: Network failures, invalid data
- Security: Unauthorized access attempts

Run Tests:
\`\`\`bash
npx vitest run ${this.getTestFilePath(target_type, target_name)}
npx vitest --coverage
\`\`\``,
        },
      ],
    };
  }

  generateFunctionTest(name, testCases) {
    const cases = testCases || ["should work correctly", "should handle errors", "should validate inputs"];

    return `import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ${name} } from '../src/services/${name}';

// Mock dependencies
vi.mock('../src/db/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: {}, error: null }),
    })),
  },
}));

describe('${name}', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

${cases.map((tc) => `  it('${tc}', async () => {
    // Arrange
    const input = {}; // TODO: Set up test input

    // Act
    const result = await ${name}(input);

    // Assert
    expect(result).toBeDefined();
    // TODO: Add specific assertions
  });`).join("\n\n")}

  it('should throw on invalid input', async () => {
    await expect(${name}(null as any)).rejects.toThrow();
  });
});`;
  }

  generateComponentTest(name, testCases) {
    const cases = testCases || ["should render correctly", "should handle user interaction", "should show loading state"];

    return `import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ${name} } from '../src/components/${name}';

describe('${name}', () => {
${cases.map((tc) => `  it('${tc}', async () => {
    // Arrange
    const props = {}; // TODO: Set up props

    // Act
    render(<${name} {...props} />);

    // Assert
    // TODO: Add specific assertions
    // expect(screen.getByText('...')).toBeInTheDocument();
    // expect(screen.getByRole('button')).toBeEnabled();
  });`).join("\n\n")}

  it('should be accessible', () => {
    const { container } = render(<${name} />);
    // Check for basic accessibility
    const buttons = container.querySelectorAll('button');
    buttons.forEach(btn => {
      expect(btn.getAttribute('aria-label') || btn.textContent).toBeTruthy();
    });
  });
});`;
  }

  generateHookTest(name, testCases) {
    return `import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { ${name} } from '../src/hooks/${name}';

// Mock API
vi.mock('../src/services/api', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

describe('${name}', () => {
  it('should return initial state', () => {
    const { result } = renderHook(() => ${name}());

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should fetch data on mount', async () => {
    const { result } = renderHook(() => ${name}());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeDefined();
  });

  it('should handle errors', async () => {
    const { api } = await import('../src/services/api');
    vi.mocked(api.get).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => ${name}());

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
  });

  it('should support refetch', async () => {
    const { result } = renderHook(() => ${name}());

    await waitFor(() => expect(result.current.loading).toBe(false));

    result.current.refetch();

    expect(result.current.loading).toBe(true);
  });
});`;
  }

  generateApiHandlerTest(name, testCases) {
    return `import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { handler } from '../src/api/${name}';

// Mock supabase
vi.mock('../src/db/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'test-id' }, error: null }),
    })),
  },
}));

function createMockReq(overrides = {}): Partial<Request> {
  return {
    params: {},
    query: {},
    body: {},
    user: { id: 'user-1', email: 'test@test.com', org_id: 'org-1', is_fttg_team: false },
    ...overrides,
  };
}

function createMockRes(): Partial<Response> {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
}

describe('${name} handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if not authenticated', async () => {
    const req = createMockReq({ user: undefined });
    const res = createMockRes();

    await handler(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('should handle successful request', async () => {
    const req = createMockReq();
    const res = createMockRes();

    await handler(req as Request, res as Response);

    expect(res.status).not.toHaveBeenCalledWith(500);
  });

  it('should handle database errors', async () => {
    const { supabase } = await import('../src/db/supabase');
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    } as any);

    const req = createMockReq();
    const res = createMockRes();

    await handler(req as Request, res as Response);

    expect(res.status).toHaveBeenCalledWith(expect.any(Number));
  });
});`;
  }

  getTestFilePath(type, name) {
    if (type === "component" || type === "hook") {
      return `frontend/tests/${name}.test.tsx`;
    }
    return `backend/tests/${name}.test.ts`;
  }

  async generateIntegrationTest(args) {
    const { flow_name, endpoints, steps } = args;

    const code = `import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3001';
let authToken = '';

describe('Integration: ${flow_name}', () => {
  beforeAll(async () => {
    // Authenticate
    const response = await fetch(\`\${BASE_URL}/api/auth/login\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@test.com', password: 'test-password' }),
    });
    const data = await response.json();
    authToken = data.token;
  });

  const headers = () => ({
    'Content-Type': 'application/json',
    'Authorization': \`Bearer \${authToken}\`,
  });

${steps.map((step, i) => `  it('Step ${i + 1}: ${step}', async () => {
    // TODO: Implement step
    const response = await fetch(\`\${BASE_URL}${endpoints?.[i] || "/api/..."}\`, {
      method: '${i === 0 ? "POST" : "GET"}',
      headers: headers(),
      ${i === 0 ? "body: JSON.stringify({ /* request body */ })," : ""}
    });

    expect(response.status).toBeLessThan(400);
    const data = await response.json();
    expect(data).toBeDefined();
  });`).join("\n\n")}

  afterAll(async () => {
    // Cleanup test data
  });
});`;

    return {
      content: [
        {
          type: "text",
          text: `INTEGRATION TEST GENERATED: ${flow_name}

File: backend/tests/integration/${flow_name.replace(/\s+/g, "-").toLowerCase()}.test.ts

\`\`\`typescript
${code}
\`\`\`

Steps:
${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}

Run:
\`\`\`bash
# Start test server
npm run dev --prefix backend

# Run integration tests
npx vitest run backend/tests/integration/
\`\`\`

Notes:
- Uses real HTTP calls (not mocked)
- Requires running backend server
- Tests execute sequentially (ordered steps)
- Clean up test data in afterAll`,
        },
      ],
    };
  }

  async reviewCodeQuality(args) {
    const { code, language, context } = args;
    const issues = [];

    // General checks
    if (code.length > 200 && !code.includes("//") && !code.includes("/*")) {
      issues.push("⚠️ Missing code comments for complex logic");
    }

    if (code.includes("console.log") && !code.includes("test")) {
      issues.push("⚠️ console.log left in code - use proper logging");
    }

    if (code.includes("TODO") || code.includes("FIXME") || code.includes("HACK")) {
      issues.push("⚠️ Contains TODO/FIXME/HACK markers");
    }

    if (code.includes("any") && (language === "typescript" || code.includes("TypeScript"))) {
      issues.push("⚠️ Using 'any' type - prefer specific types");
    }

    // Duplicate code detection (simple)
    const lines = code.split("\n");
    const duplicates = lines.filter((line, i) => line.trim().length > 20 && lines.indexOf(line) !== i);
    if (duplicates.length > 0) {
      issues.push(`⚠️ Potential code duplication detected (${duplicates.length} repeated lines)`);
    }

    // Magic numbers
    const magicNumbers = code.match(/[^0-9.][0-9]{2,}[^0-9]/g);
    if (magicNumbers && magicNumbers.length > 2) {
      issues.push("⚠️ Magic numbers detected - consider named constants");
    }

    // Long functions
    const functionBodies = code.match(/\{[\s\S]*?\}/g) || [];
    const longFunctions = functionBodies.filter((f) => f.split("\n").length > 50);
    if (longFunctions.length > 0) {
      issues.push("⚠️ Long function(s) detected - consider breaking into smaller functions");
    }

    // Nested callbacks
    const nestingLevel = (code.match(/\(\s*\([^)]*\)\s*=>\s*\{/g) || []).length;
    if (nestingLevel > 3) {
      issues.push("⚠️ Deep callback nesting - consider async/await or extracting functions");
    }

    return {
      content: [
        {
          type: "text",
          text: `CODE QUALITY REVIEW
${context ? `Context: ${context}` : ""}

${issues.length === 0 ? "✅ Code quality looks good" : `Issues Found (${issues.length}):\n${issues.join("\n")}`}

Quality Metrics:
- Lines of code: ${lines.length}
- Complexity: ${nestingLevel > 3 ? "High" : nestingLevel > 1 ? "Medium" : "Low"}
- Type safety: ${code.includes("any") ? "Weak" : "Strong"}
- Documentation: ${code.includes("//") || code.includes("/*") ? "Present" : "Missing"}

Best Practices Checklist:
☐ Single responsibility per function
☐ Descriptive variable/function names
☐ Proper error handling
☐ No hardcoded values (use constants/config)
☐ Consistent formatting
☐ Type safety (no 'any')
☐ Testable code structure`,
        },
      ],
    };
  }

  async securityAudit(args) {
    const { code, audit_type } = args;
    const vulnerabilities = [];

    // Common checks
    if (code.includes("eval(")) {
      vulnerabilities.push("🔴 CRITICAL: eval() usage - code injection risk");
    }
    if (code.includes("innerHTML")) {
      vulnerabilities.push("🔴 HIGH: innerHTML usage - XSS vulnerability");
    }
    if (code.includes("dangerouslySetInnerHTML")) {
      vulnerabilities.push("🟡 MEDIUM: dangerouslySetInnerHTML - ensure sanitization");
    }

    // Auth-specific
    if (audit_type === "auth" || audit_type === "full") {
      if (code.includes("password") && !code.includes("bcrypt") && !code.includes("hash")) {
        vulnerabilities.push("🔴 CRITICAL: Password stored/compared without hashing");
      }
      if (code.includes("jwt") && code.includes("none")) {
        vulnerabilities.push("🔴 CRITICAL: JWT algorithm 'none' - auth bypass risk");
      }
      if (code.includes("secret") && code.includes("hardcoded")) {
        vulnerabilities.push("🔴 HIGH: Hardcoded secret detected");
      }
    }

    // API-specific
    if (audit_type === "api" || audit_type === "full") {
      if (code.includes("req.body") && !code.includes("validate") && !code.includes("zod")) {
        vulnerabilities.push("🟡 MEDIUM: Unvalidated request body");
      }
      if (code.includes("req.params") && !code.includes("uuid")) {
        vulnerabilities.push("🟡 LOW: URL params not validated as UUID");
      }
      if (!code.includes("rate") && !code.includes("limit")) {
        vulnerabilities.push("🟡 LOW: No rate limiting detected");
      }
    }

    // Data handling
    if (audit_type === "data_handling" || audit_type === "full") {
      if (code.includes("SELECT") && code.includes("*") && !code.includes("supabase")) {
        vulnerabilities.push("🟡 MEDIUM: SELECT * may expose sensitive columns");
      }
      if (code.includes("DELETE") && !code.includes("WHERE")) {
        vulnerabilities.push("🔴 CRITICAL: DELETE without WHERE clause");
      }
    }

    // Frontend
    if (audit_type === "frontend" || audit_type === "full") {
      if (code.includes("localStorage") && (code.includes("token") || code.includes("secret"))) {
        vulnerabilities.push("🟡 MEDIUM: Sensitive data in localStorage (use httpOnly cookies)");
      }
      if (code.includes("window.location") && code.includes("href") && code.includes("user")) {
        vulnerabilities.push("🟡 MEDIUM: Potential open redirect");
      }
    }

    const severity = vulnerabilities.some((v) => v.includes("CRITICAL"))
      ? "CRITICAL"
      : vulnerabilities.some((v) => v.includes("HIGH"))
        ? "HIGH"
        : vulnerabilities.some((v) => v.includes("MEDIUM"))
          ? "MEDIUM"
          : "LOW";

    return {
      content: [
        {
          type: "text",
          text: `SECURITY AUDIT - ${audit_type.toUpperCase()}

Severity: ${vulnerabilities.length === 0 ? "✅ PASS" : `⚠️ ${severity}`}

${vulnerabilities.length === 0 ? "No vulnerabilities detected." : `Vulnerabilities (${vulnerabilities.length}):\n${vulnerabilities.join("\n")}`}

OWASP Top 10 Checklist:
☐ A01: Broken Access Control
☐ A02: Cryptographic Failures
☐ A03: Injection (SQL, XSS, Command)
☐ A04: Insecure Design
☐ A05: Security Misconfiguration
☐ A06: Vulnerable Components
☐ A07: Auth Failures
☐ A08: Data Integrity
☐ A09: Logging Failures
☐ A10: SSRF

Recommendations:
1. Use parameterized queries (Supabase handles this)
2. Validate all inputs with Zod schemas
3. Hash passwords with bcrypt (cost factor 12+)
4. Use httpOnly cookies for tokens
5. Implement rate limiting on auth endpoints
6. Sanitize HTML output (DOMPurify)
7. Set security headers (helmet.js)`,
        },
      ],
    };
  }

  async generateTestData(args) {
    const { entity_type, count, scenario } = args;
    const numRecords = count || 3;

    const generators = {
      project: () => ({
        id: this.uuid(),
        name: `Test Project ${Math.random().toString(36).slice(2, 7)}`,
        description: "Auto-generated test project",
        owner_org_id: this.uuid(),
        created_by_user_id: this.uuid(),
        posting_frequency: ["daily", "weekly", "bi-weekly", "monthly"][Math.floor(Math.random() * 4)],
        video_quota_per_year: [52, 104, 156, 365][Math.floor(Math.random() * 4)],
        start_date: "2025-01-01",
        end_date: "2025-12-31",
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
      calendar_item: () => ({
        id: this.uuid(),
        project_id: this.uuid(),
        title: `Test Story: ${["Breaking News", "Deep Dive", "Analysis", "Update"][Math.floor(Math.random() * 4)]}`,
        scheduled_date: this.randomDate(),
        scheduled_time: `${String(Math.floor(Math.random() * 12) + 8).padStart(2, "0")}:00`,
        duration_seconds: [90, 210, 420, 720][Math.floor(Math.random() * 4)],
        status: ["draft", "pending_review", "approved", "in_production"][Math.floor(Math.random() * 4)],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
      user: () => ({
        id: this.uuid(),
        email: `user${Math.floor(Math.random() * 1000)}@test.com`,
        full_name: `Test User ${Math.floor(Math.random() * 100)}`,
        org_id: this.uuid(),
        is_fttg_team: Math.random() > 0.7,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
      news_story: () => ({
        id: this.uuid(),
        title: `News: ${["Policy Change", "Market Update", "Tech Innovation", "Climate Report"][Math.floor(Math.random() * 4)]}`,
        summary: "Auto-generated test news story summary",
        content: "Full content of the test news story...",
        source: ["Reuters", "AP", "BBC", "CNA"][Math.floor(Math.random() * 4)],
        url: `https://example.com/news/${Math.random().toString(36).slice(2)}`,
        region: ["asia", "southeast_asia", "east_asia", "global"][Math.floor(Math.random() * 4)],
        category: ["politics", "technology", "business", "science"][Math.floor(Math.random() * 4)],
        is_trending: Math.random() > 0.7,
        trend_score: Math.floor(Math.random() * 100),
        published_at: new Date().toISOString(),
        scraped_at: new Date().toISOString(),
      }),
    };

    const generator = generators[entity_type];
    if (!generator) {
      return {
        content: [
          {
            type: "text",
            text: `Unknown entity type: ${entity_type}\n\nAvailable: ${Object.keys(generators).join(", ")}`,
          },
        ],
      };
    }

    const records = Array.from({ length: numRecords }, () => generator());

    return {
      content: [
        {
          type: "text",
          text: `TEST DATA GENERATED: ${entity_type}

Count: ${numRecords}
Scenario: ${scenario || "random"}

\`\`\`typescript
export const mock${entity_type.charAt(0).toUpperCase() + entity_type.slice(1).replace(/_([a-z])/g, (_, c) => c.toUpperCase())}s = ${JSON.stringify(records, null, 2)};
\`\`\`

File: tests/fixtures/${entity_type}s.ts

Usage:
\`\`\`typescript
import { mock${entity_type.charAt(0).toUpperCase() + entity_type.slice(1)}s } from '../fixtures/${entity_type}s';

// In tests
const testData = mock${entity_type.charAt(0).toUpperCase() + entity_type.slice(1)}s[0];
\`\`\``,
        },
      ],
    };
  }

  uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  randomDate() {
    const start = new Date("2025-01-01");
    const end = new Date("2025-12-31");
    const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    return date.toISOString().split("T")[0];
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("FTTG QA Server running on stdio");
  }
}

const server = new QAServer();
server.run().catch(console.error);
