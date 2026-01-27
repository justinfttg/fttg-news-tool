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

class DevOpsServer {
  constructor() {
    this.server = new Server(
      {
        name: "fttg-devops-server",
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
          name: "generate_github_action",
          description: "Generate a GitHub Actions workflow file",
          inputSchema: {
            type: "object",
            properties: {
              workflow_type: {
                type: "string",
                enum: ["ci", "cd", "test", "lint", "deploy_preview", "cron"],
              },
              trigger: {
                type: "string",
                enum: ["push", "pull_request", "schedule", "manual"],
              },
              description: { type: "string" },
            },
            required: ["workflow_type"],
          },
        },
        {
          name: "generate_vercel_config",
          description: "Generate or update Vercel deployment configuration",
          inputSchema: {
            type: "object",
            properties: {
              feature: {
                type: "string",
                enum: ["cron", "rewrites", "headers", "redirects", "env", "functions"],
              },
              details: {
                type: "string",
                description: "Specific configuration details",
              },
            },
            required: ["feature"],
          },
        },
        {
          name: "validate_env",
          description: "Validate environment variables configuration",
          inputSchema: {
            type: "object",
            properties: {
              environment: {
                type: "string",
                enum: ["development", "staging", "production"],
              },
            },
            required: ["environment"],
          },
        },
        {
          name: "generate_dockerfile",
          description: "Generate Dockerfile for containerized deployment",
          inputSchema: {
            type: "object",
            properties: {
              target: {
                type: "string",
                enum: ["frontend", "backend", "full_stack"],
              },
              base_image: { type: "string" },
            },
            required: ["target"],
          },
        },
        {
          name: "analyze_deployment",
          description: "Analyze deployment configuration for issues",
          inputSchema: {
            type: "object",
            properties: {
              config_type: {
                type: "string",
                enum: ["vercel", "github_actions", "docker", "env"],
              },
              config_content: {
                type: "string",
                description: "The configuration content to analyze",
              },
            },
            required: ["config_type"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "generate_github_action":
          return await this.generateGitHubAction(args);
        case "generate_vercel_config":
          return await this.generateVercelConfig(args);
        case "validate_env":
          return await this.validateEnv(args);
        case "generate_dockerfile":
          return await this.generateDockerfile(args);
        case "analyze_deployment":
          return await this.analyzeDeployment(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  async generateGitHubAction(args) {
    const { workflow_type, trigger, description } = args;

    const workflows = {
      ci: `name: CI Pipeline
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint --workspace=frontend
      - run: npm run lint --workspace=backend

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npx tsc --noEmit --project frontend/tsconfig.json
      - run: npx tsc --noEmit --project backend/tsconfig.json

  test:
    runs-on: ubuntu-latest
    needs: [lint, typecheck]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run test --workspace=frontend -- --coverage
      - run: npm run test --workspace=backend -- --coverage
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-reports
          path: |
            frontend/coverage/
            backend/coverage/

  build:
    runs-on: ubuntu-latest
    needs: [test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run build --workspace=frontend
      - uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: frontend/dist/`,

      cd: `name: Deploy to Production
on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run build --workspace=frontend
      - run: npm run test --workspace=backend
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: \${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: \${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: \${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'`,

      test: `name: Test Suite
on:
  push:
    branches: [main, develop, 'feature/**']
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        workspace: [frontend, backend]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run test --workspace=\${{ matrix.workspace }} -- --coverage --reporter=verbose
      - name: Upload Coverage
        if: matrix.workspace == 'backend'
        uses: codecov/codecov-action@v3
        with:
          file: \${{ matrix.workspace }}/coverage/lcov.info`,

      lint: `name: Lint & Format
on:
  pull_request:
    branches: [main, develop]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npx eslint frontend/src --ext .ts,.tsx
      - run: npx eslint backend/src --ext .ts
      - run: npx prettier --check "**/*.{ts,tsx,json,md}"`,

      deploy_preview: `name: Deploy Preview
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci
      - run: npm run build --workspace=frontend
      - name: Deploy Preview
        uses: amondnet/vercel-action@v25
        id: vercel-deploy
        with:
          vercel-token: \${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: \${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: \${{ secrets.VERCEL_PROJECT_ID }}
      - name: Comment PR
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '🚀 Preview deployed: \${{ steps.vercel-deploy.outputs.preview-url }}'
            })`,

      cron: `name: Scheduled Tasks
on:
  schedule:
    - cron: '*/15 * * * *'  # Every 15 minutes (news scraping)
    - cron: '0 */6 * * *'   # Every 6 hours (trending calculation)
  workflow_dispatch:

jobs:
  news-scrape:
    runs-on: ubuntu-latest
    if: github.event.schedule == '*/15 * * * *' || github.event_name == 'workflow_dispatch'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci --workspace=backend
      - run: node backend/src/jobs/scrape-news.js
        env:
          DATABASE_URL: \${{ secrets.DATABASE_URL }}
          SUPABASE_URL: \${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: \${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}

  trending-calc:
    runs-on: ubuntu-latest
    if: github.event.schedule == '0 */6 * * *' || github.event_name == 'workflow_dispatch'
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      - run: npm ci --workspace=backend
      - run: node backend/src/jobs/calculate-trending.js
        env:
          DATABASE_URL: \${{ secrets.DATABASE_URL }}
          SUPABASE_URL: \${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: \${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}`,
    };

    const workflow = workflows[workflow_type] || "# Unknown workflow type";
    const filename = `${workflow_type === "ci" ? "ci" : workflow_type === "cd" ? "deploy" : workflow_type}.yml`;

    return {
      content: [
        {
          type: "text",
          text: `GITHUB ACTION GENERATED: ${workflow_type}

File: .github/workflows/${filename}

\`\`\`yaml
${workflow}
\`\`\`

Setup Required:
1. Add GitHub secrets:
   - VERCEL_TOKEN
   - VERCEL_ORG_ID
   - VERCEL_PROJECT_ID
   - DATABASE_URL (for cron jobs)
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY

2. Create the workflow file:
\`\`\`bash
mkdir -p .github/workflows
# Save the above YAML to .github/workflows/${filename}
\`\`\`

3. Push to trigger the workflow`,
        },
      ],
    };
  }

  async generateVercelConfig(args) {
    const { feature, details } = args;

    const configs = {
      cron: `{
  "crons": [
    {
      "path": "/api/jobs/scrape-news",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/jobs/calculate-trending",
      "schedule": "0 */6 * * *"
    }
  ]
}`,

      rewrites: `{
  "rewrites": [
    { "source": "/api/:path*", "destination": "/api/:path*" },
    { "source": "/((?!api).*)", "destination": "/index.html" }
  ]
}`,

      headers: `{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" }
      ]
    }
  ]
}`,

      redirects: `{
  "redirects": [
    { "source": "/old-path", "destination": "/new-path", "statusCode": 301 }
  ]
}`,

      env: `Required Environment Variables:

Production:
  SUPABASE_URL=https://xxxxx.supabase.co
  SUPABASE_ANON_KEY=eyJ...
  SUPABASE_SERVICE_ROLE_KEY=eyJ...
  JWT_SECRET=[generated-secret]
  OPENAI_API_KEY=sk-...
  ANTHROPIC_API_KEY=sk-ant-...

Development:
  SUPABASE_URL=http://localhost:54321
  SUPABASE_ANON_KEY=[local-key]
  JWT_SECRET=dev-secret-change-me
  PORT=3001

Set via Vercel Dashboard:
  Settings → Environment Variables → Add for each environment`,

      functions: `{
  "functions": {
    "api/**/*.ts": {
      "runtime": "@vercel/node@3",
      "maxDuration": 30
    },
    "api/jobs/**/*.ts": {
      "runtime": "@vercel/node@3",
      "maxDuration": 60
    },
    "api/ai/**/*.ts": {
      "runtime": "@vercel/node@3",
      "maxDuration": 120
    }
  }
}`,
    };

    const config = configs[feature] || "// Unknown feature";

    return {
      content: [
        {
          type: "text",
          text: `VERCEL CONFIG: ${feature}

${feature === "env" ? config : `Add to vercel.json:\n\`\`\`json\n${config}\n\`\`\``}

${feature === "cron" ? `\nNote: Cron jobs require Vercel Pro plan.\nAlternative: Use GitHub Actions scheduled workflows.` : ""}
${feature === "functions" ? `\nNote: maxDuration limits depend on Vercel plan.\nHobby: 10s, Pro: 60s, Enterprise: 900s` : ""}
${feature === "headers" ? `\nSecurity headers protect against:\n- XSS attacks\n- Clickjacking\n- MIME sniffing\n- Man-in-the-middle attacks` : ""}`,
        },
      ],
    };
  }

  async validateEnv(args) {
    const { environment } = args;

    const requiredVars = {
      development: [
        { name: "SUPABASE_URL", description: "Supabase project URL" },
        { name: "SUPABASE_ANON_KEY", description: "Supabase anonymous key" },
        { name: "JWT_SECRET", description: "JWT signing secret" },
        { name: "PORT", description: "Backend server port", default: "3001" },
      ],
      staging: [
        { name: "SUPABASE_URL", description: "Supabase project URL" },
        { name: "SUPABASE_ANON_KEY", description: "Supabase anonymous key" },
        { name: "SUPABASE_SERVICE_ROLE_KEY", description: "Supabase service role key" },
        { name: "JWT_SECRET", description: "JWT signing secret" },
        { name: "OPENAI_API_KEY", description: "OpenAI API key" },
      ],
      production: [
        { name: "SUPABASE_URL", description: "Supabase project URL", sensitive: true },
        { name: "SUPABASE_ANON_KEY", description: "Supabase anonymous key", sensitive: true },
        { name: "SUPABASE_SERVICE_ROLE_KEY", description: "Supabase service role key", sensitive: true },
        { name: "JWT_SECRET", description: "JWT signing secret", sensitive: true },
        { name: "OPENAI_API_KEY", description: "OpenAI API key", sensitive: true },
        { name: "ANTHROPIC_API_KEY", description: "Anthropic API key", sensitive: true },
      ],
    };

    const vars = requiredVars[environment] || [];

    return {
      content: [
        {
          type: "text",
          text: `ENVIRONMENT VALIDATION: ${environment.toUpperCase()}

Required Variables (${vars.length}):
${vars.map((v) => `  ${v.sensitive ? "🔒" : "📝"} ${v.name}${v.default ? ` (default: ${v.default})` : ""}\n     ${v.description}`).join("\n")}

Validation Script:
\`\`\`typescript
const requiredEnvVars = [${vars.map((v) => `'${v.name}'`).join(", ")}];

for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    throw new Error(\`Missing required env var: \${varName}\`);
  }
}
\`\`\`

.env.example:
\`\`\`
${vars.map((v) => `${v.name}=${v.default || ""}`).join("\n")}
\`\`\`

Security Notes:
- Never commit .env files to git
- Use Vercel dashboard for production secrets
- Rotate JWT_SECRET periodically
- Use separate Supabase projects per environment`,
        },
      ],
    };
  }

  async generateDockerfile(args) {
    const { target, base_image } = args;

    const dockerfiles = {
      frontend: `# Frontend Dockerfile
FROM ${base_image || "node:18-alpine"} AS builder
WORKDIR /app
COPY package*.json ./
COPY frontend/package*.json ./frontend/
RUN npm ci --workspace=frontend
COPY frontend/ ./frontend/
COPY tsconfig.json ./
RUN npm run build --workspace=frontend

FROM nginx:alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`,

      backend: `# Backend Dockerfile
FROM ${base_image || "node:18-alpine"}
WORKDIR /app
COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm ci --workspace=backend --production
COPY backend/ ./backend/
COPY tsconfig.json ./
EXPOSE 3001
CMD ["node", "--loader", "tsx", "backend/src/index.ts"]`,

      full_stack: `# Full Stack Dockerfile (development)
FROM ${base_image || "node:18-alpine"}
WORKDIR /app
COPY package*.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/
RUN npm ci
COPY . .
EXPOSE 3000 3001
CMD ["npm", "run", "dev"]`,
    };

    const dockerfile = dockerfiles[target] || "# Unknown target";

    return {
      content: [
        {
          type: "text",
          text: `DOCKERFILE GENERATED: ${target}

File: ${target === "full_stack" ? "Dockerfile" : `Dockerfile.${target}`}

\`\`\`dockerfile
${dockerfile}
\`\`\`

docker-compose.yml:
\`\`\`yaml
version: '3.8'
services:
  ${target === "full_stack" ? "app" : target}:
    build:
      context: .
      dockerfile: ${target === "full_stack" ? "Dockerfile" : `Dockerfile.${target}`}
    ports:
      - "${target === "frontend" ? "80:80" : target === "backend" ? "3001:3001" : "3000:3000\\n      - 3001:3001"}"
    environment:
      - NODE_ENV=${target === "full_stack" ? "development" : "production"}
    ${target !== "frontend" ? "env_file:\\n      - .env" : ""}
\`\`\`

Build & Run:
\`\`\`bash
docker build -f ${target === "full_stack" ? "Dockerfile" : `Dockerfile.${target}`} -t fttg-${target} .
docker run -p ${target === "frontend" ? "80:80" : "3001:3001"} fttg-${target}
\`\`\`

Note: For production, prefer Vercel deployment over Docker.
Docker is useful for local development and testing.`,
        },
      ],
    };
  }

  async analyzeDeployment(args) {
    const { config_type, config_content } = args;
    const issues = [];

    switch (config_type) {
      case "vercel":
        if (config_content && !config_content.includes("rewrites")) {
          issues.push("⚠️ Missing rewrites for SPA routing");
        }
        if (config_content && !config_content.includes("headers")) {
          issues.push("⚠️ Missing security headers configuration");
        }
        break;

      case "github_actions":
        if (config_content && !config_content.includes("cache")) {
          issues.push("⚠️ No dependency caching - builds will be slow");
        }
        if (config_content && config_content.includes("npm install") && !config_content.includes("npm ci")) {
          issues.push("⚠️ Use 'npm ci' instead of 'npm install' in CI");
        }
        break;

      case "docker":
        if (config_content && !config_content.includes("alpine")) {
          issues.push("⚠️ Consider using Alpine base images for smaller size");
        }
        if (config_content && !config_content.includes("multi-stage") && !config_content.includes("AS builder")) {
          issues.push("⚠️ Consider multi-stage builds to reduce image size");
        }
        break;

      case "env":
        if (config_content && config_content.includes("secret") && config_content.includes("=")) {
          issues.push("❌ CRITICAL: Secrets appear to be hardcoded");
        }
        break;
    }

    return {
      content: [
        {
          type: "text",
          text: `DEPLOYMENT ANALYSIS: ${config_type}

${issues.length === 0 ? "✅ Configuration looks good" : `Issues Found:\n${issues.join("\n")}`}

Deployment Checklist:
☐ Environment variables set for all environments
☐ Build succeeds locally before deploying
☐ Tests pass in CI
☐ Security headers configured
☐ Error monitoring set up (Sentry, etc.)
☐ Performance monitoring enabled
☐ Backup strategy for database
☐ Rollback procedure documented
☐ DNS and SSL configured
☐ Rate limiting on API endpoints

FTTG Deployment Architecture:
- Frontend: Vercel Edge Network (static)
- Backend API: Vercel Serverless Functions
- Database: Supabase (managed PostgreSQL)
- Cron Jobs: Vercel Cron or GitHub Actions
- File Storage: Supabase Storage (if needed)`,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("FTTG DevOps Server running on stdio");
  }
}

const server = new DevOpsServer();
server.run().catch(console.error);
