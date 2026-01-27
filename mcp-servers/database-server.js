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

class DatabaseServer {
  constructor() {
    this.server = new Server(
      {
        name: "fttg-database-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.tables = {
      organizations: {
        columns: ["id", "name", "type", "license_type", "seat_limit", "created_at", "updated_at"],
        indexes: [],
      },
      users: {
        columns: ["id", "email", "password_hash", "full_name", "org_id", "is_fttg_team", "created_at", "updated_at"],
        indexes: ["idx_users_email", "idx_users_org"],
      },
      projects: {
        columns: ["id", "name", "description", "owner_org_id", "created_by_user_id", "posting_frequency", "custom_frequency_days", "video_quota_per_year", "start_date", "end_date", "status", "created_at", "updated_at"],
        indexes: ["idx_projects_org", "idx_projects_status"],
      },
      project_members: {
        columns: ["id", "project_id", "user_id", "role", "can_create_stories", "can_approve_stories", "can_generate_scripts", "can_invite_members", "invited_by_user_id", "invited_at"],
        indexes: ["idx_project_members_project", "idx_project_members_user"],
      },
      calendar_items: {
        columns: ["id", "project_id", "news_story_id", "title", "scheduled_date", "scheduled_time", "duration_seconds", "status", "selected_angle_id", "script_id", "created_by_user_id", "approved_by_user_id", "approved_at", "notes", "created_at", "updated_at"],
        indexes: ["idx_calendar_project_date", "idx_calendar_status"],
      },
      storytelling_frameworks: {
        columns: ["id", "name", "type", "description", "framework_steps", "system_prompt", "user_prompt_template", "is_active", "is_team_only", "created_at", "updated_at"],
        indexes: ["idx_frameworks_type"],
      },
      news_stories: {
        columns: ["id", "title", "summary", "content", "source", "url", "region", "category", "is_trending", "social_platforms", "trend_score", "published_at", "scraped_at", "search_vector"],
        indexes: ["idx_news_region_category", "idx_news_trending", "idx_news_published", "idx_news_search"],
      },
      story_angles: {
        columns: ["id", "news_story_id", "framework_id", "audience_profile_id", "project_id", "created_by_user_id", "angle_data", "audience_care_statement", "related_stories", "comparison_regions", "status", "created_at", "updated_at"],
        indexes: ["idx_angles_story", "idx_angles_project", "idx_angles_framework"],
      },
      scripts: {
        columns: ["id", "story_angle_id", "project_id", "created_by_user_id", "duration_seconds", "format", "framework_id", "script_content", "word_count", "production_notes", "version", "is_exported", "created_at", "updated_at"],
        indexes: ["idx_scripts_angle", "idx_scripts_project"],
      },
      approvals: {
        columns: ["id", "calendar_item_id", "approver_user_id", "status", "comments", "created_at"],
        indexes: ["idx_approvals_calendar_item"],
      },
      audience_profiles: {
        columns: ["id", "project_id", "name", "age_range", "location", "education_level", "values", "fears", "aspirations", "preferred_tone", "depth_preference", "political_sensitivity", "created_at", "updated_at"],
        indexes: ["idx_audience_project"],
      },
      usage_logs: {
        columns: ["id", "user_id", "project_id", "action", "metadata", "created_at"],
        indexes: ["idx_usage_user_date", "idx_usage_project_date"],
      },
    };

    this.setupHandlers();
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "generate_migration",
          description: "Generate a SQL migration for schema changes",
          inputSchema: {
            type: "object",
            properties: {
              action: {
                type: "string",
                enum: ["create_table", "add_column", "drop_column", "add_index", "modify_column"],
              },
              table_name: { type: "string" },
              details: {
                type: "string",
                description: "Description of the migration (e.g., column name, type, constraints)",
              },
            },
            required: ["action", "table_name", "details"],
          },
        },
        {
          name: "generate_query",
          description: "Generate an optimized SQL query",
          inputSchema: {
            type: "object",
            properties: {
              operation: {
                type: "string",
                enum: ["select", "insert", "update", "delete", "join"],
              },
              tables: {
                type: "array",
                items: { type: "string" },
              },
              description: {
                type: "string",
                description: "What the query should accomplish",
              },
              filters: { type: "string" },
            },
            required: ["operation", "tables", "description"],
          },
        },
        {
          name: "analyze_indexes",
          description: "Analyze and suggest indexes for a table or query pattern",
          inputSchema: {
            type: "object",
            properties: {
              table_name: { type: "string" },
              query_pattern: {
                type: "string",
                description: "The typical query pattern to optimize for",
              },
            },
            required: ["table_name"],
          },
        },
        {
          name: "validate_schema",
          description: "Validate a schema change against project conventions",
          inputSchema: {
            type: "object",
            properties: {
              table_name: { type: "string" },
              proposed_schema: {
                type: "string",
                description: "The proposed CREATE TABLE or ALTER TABLE statement",
              },
            },
            required: ["table_name", "proposed_schema"],
          },
        },
        {
          name: "get_table_info",
          description: "Get schema information for a table",
          inputSchema: {
            type: "object",
            properties: {
              table_name: {
                type: "string",
                description: "Table name or 'all' for complete schema overview",
              },
            },
            required: ["table_name"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "generate_migration":
          return await this.generateMigration(args);
        case "generate_query":
          return await this.generateQuery(args);
        case "analyze_indexes":
          return await this.analyzeIndexes(args);
        case "validate_schema":
          return await this.validateSchema(args);
        case "get_table_info":
          return await this.getTableInfo(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  async generateMigration(args) {
    const { action, table_name, details } = args;
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, "").slice(0, 14);
    const filename = `${timestamp}_${action}_${table_name}.sql`;

    let migrationSQL = "";

    switch (action) {
      case "create_table":
        migrationSQL = `-- Migration: Create ${table_name}
-- Generated: ${new Date().toISOString()}

CREATE TABLE ${table_name} (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ${details}
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add indexes as needed
-- CREATE INDEX idx_${table_name}_... ON ${table_name}(...);`;
        break;

      case "add_column":
        migrationSQL = `-- Migration: Add column to ${table_name}
-- Generated: ${new Date().toISOString()}

ALTER TABLE ${table_name}
ADD COLUMN ${details};

-- Rollback:
-- ALTER TABLE ${table_name} DROP COLUMN IF EXISTS [column_name];`;
        break;

      case "drop_column":
        migrationSQL = `-- Migration: Drop column from ${table_name}
-- Generated: ${new Date().toISOString()}
-- WARNING: This is destructive!

ALTER TABLE ${table_name}
DROP COLUMN IF EXISTS ${details};`;
        break;

      case "add_index":
        migrationSQL = `-- Migration: Add index to ${table_name}
-- Generated: ${new Date().toISOString()}

CREATE INDEX idx_${table_name}_${details.replace(/[^a-z0-9]/gi, "_").toLowerCase()}
ON ${table_name}(${details});`;
        break;

      case "modify_column":
        migrationSQL = `-- Migration: Modify column in ${table_name}
-- Generated: ${new Date().toISOString()}

ALTER TABLE ${table_name}
ALTER COLUMN ${details};`;
        break;
    }

    return {
      content: [
        {
          type: "text",
          text: `DATABASE MIGRATION GENERATED

Filename: ${filename}
Action: ${action}
Table: ${table_name}

SQL:
\`\`\`sql
${migrationSQL}
\`\`\`

Checklist:
☐ Review SQL for correctness
☐ Check for data loss risks
☐ Verify foreign key constraints
☐ Test on development database first
☐ Create rollback migration
☐ Update ARCHITECTURE.md if schema changed

Supabase Command:
\`\`\`bash
# Run via Supabase dashboard SQL editor or CLI
supabase db push
\`\`\``,
        },
      ],
    };
  }

  async generateQuery(args) {
    const { operation, tables, description, filters } = args;

    let query = "";
    const tableList = tables.join(", ");

    switch (operation) {
      case "select":
        query = `SELECT
  ${this.getColumnsForTables(tables)}
FROM ${tables[0]}
${tables.length > 1 ? tables.slice(1).map((t) => `JOIN ${t} ON ${tables[0]}.id = ${t}.${tables[0].slice(0, -1)}_id`).join("\n") : ""}
${filters ? `WHERE ${filters}` : "-- Add WHERE clause"}
ORDER BY created_at DESC
LIMIT 50;`;
        break;

      case "insert":
        query = `INSERT INTO ${tables[0]} (
  ${this.tables[tables[0]]?.columns.filter((c) => c !== "id" && c !== "created_at" && c !== "updated_at").join(",\n  ") || "-- columns"}
) VALUES (
  -- values
) RETURNING *;`;
        break;

      case "update":
        query = `UPDATE ${tables[0]}
SET
  -- column = value,
  updated_at = NOW()
${filters ? `WHERE ${filters}` : "WHERE id = $1"}
RETURNING *;`;
        break;

      case "delete":
        query = `DELETE FROM ${tables[0]}
${filters ? `WHERE ${filters}` : "WHERE id = $1"}
RETURNING id;`;
        break;

      case "join":
        query = `SELECT
  ${tables.map((t) => `${t}.*`).join(",\n  ")}
FROM ${tables[0]}
${tables.slice(1).map((t) => {
  const fk = this.findForeignKey(tables[0], t);
  return `LEFT JOIN ${t} ON ${fk}`;
}).join("\n")}
${filters ? `WHERE ${filters}` : "-- Add WHERE clause"}
ORDER BY ${tables[0]}.created_at DESC;`;
        break;
    }

    return {
      content: [
        {
          type: "text",
          text: `GENERATED QUERY

Purpose: ${description}
Operation: ${operation}
Tables: ${tableList}

\`\`\`sql
${query}
\`\`\`

Performance Notes:
- ${this.getIndexAdvice(tables, operation)}
- Consider pagination for large result sets
- Use EXPLAIN ANALYZE to verify query plan

Supabase JS Equivalent:
\`\`\`typescript
const { data, error } = await supabase
  .from('${tables[0]}')
  .${operation === "select" || operation === "join" ? "select('*')" : operation === "insert" ? "insert({...})" : operation === "update" ? "update({...}).eq('id', id)" : "delete().eq('id', id)"}
\`\`\``,
        },
      ],
    };
  }

  getColumnsForTables(tables) {
    return tables
      .map((t) => {
        const info = this.tables[t];
        if (!info) return `${t}.*`;
        return info.columns.slice(0, 5).map((c) => `${t}.${c}`).join(`, `);
      })
      .join(",\n  ");
  }

  findForeignKey(tableA, tableB) {
    // Check if tableA has a reference to tableB
    const singularB = tableB.replace(/s$/, "");
    const colA = this.tables[tableA]?.columns || [];
    const fkCol = colA.find((c) => c === `${singularB}_id`);
    if (fkCol) return `${tableA}.${fkCol} = ${tableB}.id`;

    // Check reverse
    const singularA = tableA.replace(/s$/, "");
    const colB = this.tables[tableB]?.columns || [];
    const fkColB = colB.find((c) => c === `${singularA}_id`);
    if (fkColB) return `${tableB}.${fkColB} = ${tableA}.id`;

    return `${tableA}.id = ${tableB}.${tableA.slice(0, -1)}_id -- VERIFY FK`;
  }

  getIndexAdvice(tables, operation) {
    const advice = [];
    tables.forEach((t) => {
      const info = this.tables[t];
      if (info) {
        if (info.indexes.length === 0) {
          advice.push(`Table '${t}' has no custom indexes - consider adding based on query patterns`);
        } else {
          advice.push(`Table '${t}' has indexes: ${info.indexes.join(", ")}`);
        }
      }
    });
    return advice.join("\n- ") || "Check indexes for optimal performance";
  }

  async analyzeIndexes(args) {
    const { table_name, query_pattern } = args;
    const tableInfo = this.tables[table_name];

    if (!tableInfo) {
      return {
        content: [
          {
            type: "text",
            text: `Table '${table_name}' not found in schema. Available tables: ${Object.keys(this.tables).join(", ")}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `INDEX ANALYSIS: ${table_name}

Current Indexes:
${tableInfo.indexes.length > 0 ? tableInfo.indexes.map((idx) => `  ✓ ${idx}`).join("\n") : "  ⚠️ No custom indexes defined"}

Columns:
${tableInfo.columns.map((c) => `  - ${c}`).join("\n")}

${query_pattern ? `Query Pattern: ${query_pattern}\n` : ""}
Recommendations:
1. ${table_name.includes("calendar") ? "Composite index on (project_id, scheduled_date) for calendar queries" : "Consider composite indexes for common WHERE + ORDER BY patterns"}
2. Add indexes on foreign key columns used in JOINs
3. For JSONB columns, consider GIN indexes for containment queries
4. For text search, ensure GIN index on tsvector columns

Index Template:
\`\`\`sql
CREATE INDEX idx_${table_name}_[columns]
ON ${table_name}([columns]);

-- For JSONB:
CREATE INDEX idx_${table_name}_[jsonb_col]
ON ${table_name} USING GIN([jsonb_col]);
\`\`\`

Performance Testing:
\`\`\`sql
EXPLAIN ANALYZE [your query here];
\`\`\``,
        },
      ],
    };
  }

  async validateSchema(args) {
    const { table_name, proposed_schema } = args;
    const issues = [];

    // Check for UUID primary key
    if (!proposed_schema.includes("UUID PRIMARY KEY")) {
      issues.push("❌ Missing UUID primary key (project convention)");
    }

    // Check for timestamps
    if (!proposed_schema.includes("created_at")) {
      issues.push("❌ Missing created_at TIMESTAMP column");
    }
    if (!proposed_schema.includes("updated_at") && !proposed_schema.includes("DROP")) {
      issues.push("⚠️ Missing updated_at TIMESTAMP column");
    }

    // Check for proper references
    if (proposed_schema.includes("REFERENCES") && !proposed_schema.includes("ON DELETE")) {
      issues.push("⚠️ Foreign keys should specify ON DELETE behavior");
    }

    // Check for CHECK constraints on status/type columns
    if ((proposed_schema.includes("status") || proposed_schema.includes("type")) && !proposed_schema.includes("CHECK")) {
      issues.push("⚠️ Status/type columns should have CHECK constraints");
    }

    // Check for gen_random_uuid()
    if (proposed_schema.includes("UUID PRIMARY KEY") && !proposed_schema.includes("gen_random_uuid()")) {
      issues.push("⚠️ Use gen_random_uuid() for UUID default values");
    }

    return {
      content: [
        {
          type: "text",
          text: `SCHEMA VALIDATION: ${table_name}

${issues.length === 0 ? "✅ Schema follows project conventions" : `Issues Found:\n${issues.join("\n")}`}

Project Schema Conventions:
1. UUID primary keys with gen_random_uuid()
2. created_at and updated_at timestamps
3. CHECK constraints on enum-like columns
4. Foreign keys with ON DELETE behavior
5. Indexes on frequently queried columns
6. JSONB for flexible structured data

${issues.length > 0 ? "\nSuggested Fix:\n" + this.suggestFix(proposed_schema, issues) : ""}`,
        },
      ],
    };
  }

  suggestFix(schema, issues) {
    let fixed = schema;
    if (issues.some((i) => i.includes("UUID primary key"))) {
      fixed = fixed.replace(
        /CREATE TABLE (\w+) \(/,
        "CREATE TABLE $1 (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),"
      );
    }
    return `Review and apply necessary changes based on the issues above.`;
  }

  async getTableInfo(args) {
    const { table_name } = args;

    if (table_name === "all") {
      const overview = Object.entries(this.tables)
        .map(([name, info]) => `${name}: ${info.columns.length} columns, ${info.indexes.length} indexes`)
        .join("\n");

      return {
        content: [
          {
            type: "text",
            text: `COMPLETE SCHEMA OVERVIEW

Tables (${Object.keys(this.tables).length}):
${overview}

Relationships:
- organizations → users (org_id)
- organizations → projects (owner_org_id)
- projects → project_members (project_id)
- projects → calendar_items (project_id)
- projects → story_angles (project_id)
- projects → scripts (project_id)
- projects → audience_profiles (project_id)
- news_stories → story_angles (news_story_id)
- news_stories → calendar_items (news_story_id)
- story_angles → scripts (story_angle_id)
- calendar_items → approvals (calendar_item_id)
- storytelling_frameworks → story_angles (framework_id)`,
          },
        ],
      };
    }

    const info = this.tables[table_name];
    if (!info) {
      return {
        content: [
          {
            type: "text",
            text: `Table '${table_name}' not found.\n\nAvailable tables: ${Object.keys(this.tables).join(", ")}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `TABLE: ${table_name}

Columns (${info.columns.length}):
${info.columns.map((c) => `  - ${c}`).join("\n")}

Indexes:
${info.indexes.length > 0 ? info.indexes.map((idx) => `  - ${idx}`).join("\n") : "  (none)"}

Foreign Keys:
${info.columns.filter((c) => c.endsWith("_id") && c !== "id").map((c) => `  - ${c} → ${c.replace("_id", "")}s`).join("\n") || "  (none)"}`,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("FTTG Database Server running on stdio");
  }
}

const server = new DatabaseServer();
server.run().catch(console.error);
