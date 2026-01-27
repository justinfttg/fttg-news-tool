#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const PROJECT_ROOT = process.env.PROJECT_ROOT || process.cwd();

class FrontendServer {
  constructor() {
    this.server = new Server(
      {
        name: "fttg-frontend-server",
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
          name: "generate_component",
          description: "Generate a React component with TypeScript and Tailwind",
          inputSchema: {
            type: "object",
            properties: {
              component_name: {
                type: "string",
                description: "PascalCase component name (e.g., CalendarView)",
              },
              component_type: {
                type: "string",
                enum: ["page", "layout", "feature", "common", "form"],
              },
              props: {
                type: "string",
                description: "Description of props the component accepts",
              },
              features: {
                type: "array",
                items: { type: "string" },
                description: "Features to include (e.g., ['state', 'api_call', 'form', 'modal'])",
              },
            },
            required: ["component_name", "component_type"],
          },
        },
        {
          name: "generate_hook",
          description: "Generate a custom React hook",
          inputSchema: {
            type: "object",
            properties: {
              hook_name: {
                type: "string",
                description: "Hook name (e.g., useCalendarItems)",
              },
              purpose: {
                type: "string",
                description: "What the hook does",
              },
              dependencies: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["hook_name", "purpose"],
          },
        },
        {
          name: "generate_store",
          description: "Generate a Zustand store",
          inputSchema: {
            type: "object",
            properties: {
              store_name: {
                type: "string",
                description: "Store name (e.g., calendarStore)",
              },
              state_fields: {
                type: "array",
                items: { type: "string" },
                description: "State fields with types (e.g., 'items: CalendarItem[]')",
              },
              actions: {
                type: "array",
                items: { type: "string" },
                description: "Action names (e.g., 'fetchItems', 'addItem')",
              },
            },
            required: ["store_name", "state_fields", "actions"],
          },
        },
        {
          name: "generate_form",
          description: "Generate a form with react-hook-form and zod validation",
          inputSchema: {
            type: "object",
            properties: {
              form_name: {
                type: "string",
                description: "Form component name",
              },
              fields: {
                type: "array",
                items: { type: "string" },
                description: "Field definitions (e.g., 'title: string, required')",
              },
              submit_action: {
                type: "string",
                description: "What happens on submit",
              },
            },
            required: ["form_name", "fields"],
          },
        },
        {
          name: "review_accessibility",
          description: "Review a component for accessibility issues",
          inputSchema: {
            type: "object",
            properties: {
              component_code: {
                type: "string",
                description: "The React component code to review",
              },
            },
            required: ["component_code"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      switch (name) {
        case "generate_component":
          return await this.generateComponent(args);
        case "generate_hook":
          return await this.generateHook(args);
        case "generate_store":
          return await this.generateStore(args);
        case "generate_form":
          return await this.generateForm(args);
        case "review_accessibility":
          return await this.reviewAccessibility(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  async generateComponent(args) {
    const { component_name, component_type, props, features } = args;
    const featureSet = new Set(features || []);

    const imports = [`import React${featureSet.has("state") ? ", { useState }" : featureSet.has("api_call") ? ", { useState, useEffect }" : ""} from 'react';`];

    if (featureSet.has("form")) {
      imports.push("import { useForm } from 'react-hook-form';");
      imports.push("import { zodResolver } from '@hookform/resolvers/zod';");
      imports.push("import { z } from 'zod';");
    }

    if (featureSet.has("api_call")) {
      imports.push("import { api } from '../services/api';");
    }

    const propsInterface = props
      ? `\ninterface ${component_name}Props {\n  ${props}\n}\n`
      : "";

    const propsParam = props ? `{ ${props.split(",").map((p) => p.trim().split(":")[0].trim()).join(", ")} }: ${component_name}Props` : "";

    const stateDeclarations = [];
    if (featureSet.has("state")) {
      stateDeclarations.push("  const [loading, setLoading] = useState(false);");
      stateDeclarations.push("  const [error, setError] = useState<string | null>(null);");
    }
    if (featureSet.has("api_call")) {
      stateDeclarations.push("  const [data, setData] = useState<unknown>(null);");
      stateDeclarations.push("  const [loading, setLoading] = useState(true);");
    }

    const effectBlock = featureSet.has("api_call")
      ? `\n  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // const response = await api.get('/...');
        // setData(response.data);
      } catch (err) {
        console.error('Failed to fetch:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);\n`
      : "";

    const code = `${imports.join("\n")}
${propsInterface}
export function ${component_name}(${propsParam}) {
${stateDeclarations.join("\n")}
${effectBlock}
  ${featureSet.has("api_call") ? `if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }\n` : ""}
  return (
    <div className="${this.getContainerClass(component_type)}">
      <h2 className="text-xl font-semibold text-gray-900">
        ${component_name}
      </h2>
      {/* TODO: Implement component content */}
    </div>
  );
}`;

    const filePath = this.getFilePath(component_name, component_type);

    return {
      content: [
        {
          type: "text",
          text: `COMPONENT GENERATED: ${component_name}

File: frontend/src/${filePath}
Type: ${component_type}
Features: ${(features || ["none"]).join(", ")}

\`\`\`tsx
${code}
\`\`\`

Tailwind Classes Used:
- Container: ${this.getContainerClass(component_type)}
- Loading spinner: animate-spin with border trick
- Typography: text-xl font-semibold text-gray-900

Checklist:
☐ Add proper TypeScript types for all data
☐ Implement actual UI content
☐ Add error boundary
☐ Add ARIA labels for accessibility
☐ Test responsive behavior
☐ Add loading/error states`,
        },
      ],
    };
  }

  getContainerClass(type) {
    const classes = {
      page: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8",
      layout: "min-h-screen flex flex-col",
      feature: "bg-white rounded-lg shadow p-6",
      common: "inline-flex items-center",
      form: "space-y-6 max-w-lg",
    };
    return classes[type] || "p-4";
  }

  getFilePath(name, type) {
    const paths = {
      page: `pages/${name}.tsx`,
      layout: `components/layout/${name}.tsx`,
      feature: `components/${name.replace(/([A-Z])/g, "-$1").toLowerCase().slice(1)}/${name}.tsx`,
      common: `components/common/${name}.tsx`,
      form: `components/forms/${name}.tsx`,
    };
    return paths[type] || `components/${name}.tsx`;
  }

  async generateHook(args) {
    const { hook_name, purpose, dependencies } = args;

    const code = `import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

/**
 * ${purpose}
 */
export function ${hook_name}(${(dependencies || []).map((d) => `${d}: unknown`).join(", ")}) {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // TODO: Implement data fetching
      // const response = await api.get('/...');
      // setData(response.data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [${(dependencies || []).join(", ")}]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    data,
    loading,
    error,
    refetch: fetch,
  };
}`;

    return {
      content: [
        {
          type: "text",
          text: `HOOK GENERATED: ${hook_name}

File: frontend/src/hooks/${hook_name}.ts
Purpose: ${purpose}

\`\`\`typescript
${code}
\`\`\`

Usage:
\`\`\`tsx
const { data, loading, error, refetch } = ${hook_name}(${(dependencies || []).map(() => "/* param */").join(", ")});
\`\`\`

Patterns:
- Returns { data, loading, error, refetch }
- Uses useCallback for stable fetch reference
- Auto-fetches on mount and dependency changes
- Proper error typing`,
        },
      ],
    };
  }

  async generateStore(args) {
    const { store_name, state_fields, actions } = args;

    const code = `import { create } from 'zustand';

interface ${this.capitalize(store_name)}State {
  // State
${state_fields.map((f) => `  ${f};`).join("\n")}
  loading: boolean;
  error: string | null;

  // Actions
${actions.map((a) => `  ${a}: (...args: unknown[]) => Promise<void>;`).join("\n")}
}

export const use${this.capitalize(store_name)} = create<${this.capitalize(store_name)}State>((set, get) => ({
  // Initial state
${state_fields.map((f) => {
  const [name, type] = f.split(":").map((s) => s.trim());
  const defaultVal = type?.includes("[]") ? "[]" : type?.includes("null") ? "null" : "undefined";
  return `  ${name}: ${defaultVal},`;
}).join("\n")}
  loading: false,
  error: null,

  // Actions
${actions.map((a) => `  ${a}: async (...args: unknown[]) => {
    try {
      set({ loading: true, error: null });
      // TODO: Implement ${a}
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      set({ loading: false });
    }
  },`).join("\n\n")}
}));`;

    return {
      content: [
        {
          type: "text",
          text: `ZUSTAND STORE GENERATED: ${store_name}

File: frontend/src/stores/${store_name}.ts

\`\`\`typescript
${code}
\`\`\`

Usage:
\`\`\`tsx
import { use${this.capitalize(store_name)} } from '../stores/${store_name}';

function MyComponent() {
  const { ${state_fields.map((f) => f.split(":")[0].trim()).join(", ")}, loading, ${actions[0]} } = use${this.capitalize(store_name)}();

  // Use state and actions...
}
\`\`\`

Architecture Notes:
- Zustand stores are lightweight alternatives to Redux
- Each store handles one domain (e.g., calendar, projects)
- Actions handle async operations with loading/error states
- Use selectors for performance: useStore(state => state.field)`,
        },
      ],
    };
  }

  capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  async generateForm(args) {
    const { form_name, fields, submit_action } = args;

    const parsedFields = fields.map((f) => {
      const parts = f.split(",").map((p) => p.trim());
      const [nameType] = parts;
      const [name, type] = nameType.split(":").map((s) => s.trim());
      const required = parts.includes("required");
      return { name: name || f, type: type || "string", required };
    });

    const code = `import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const ${form_name}Schema = z.object({
${parsedFields.map((f) => {
  let zodType = "z.string()";
  if (f.type === "number") zodType = "z.number()";
  if (f.type === "date") zodType = "z.string().datetime()";
  if (f.type === "email") zodType = "z.string().email()";
  if (!f.required) zodType += ".optional()";
  else zodType += `.min(1, '${f.name} is required')`;
  return `  ${f.name}: ${zodType},`;
}).join("\n")}
});

type ${form_name}Data = z.infer<typeof ${form_name}Schema>;

interface ${form_name}Props {
  onSubmit: (data: ${form_name}Data) => void;
  defaultValues?: Partial<${form_name}Data>;
  isLoading?: boolean;
}

export function ${form_name}({ onSubmit, defaultValues, isLoading }: ${form_name}Props) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<${form_name}Data>({
    resolver: zodResolver(${form_name}Schema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
${parsedFields.map((f) => `      <div>
        <label htmlFor="${f.name}" className="block text-sm font-medium text-gray-700">
          ${f.name.charAt(0).toUpperCase() + f.name.slice(1).replace(/_/g, " ")}${f.required ? " *" : ""}
        </label>
        <input
          id="${f.name}"
          type="${f.type === "number" ? "number" : f.type === "email" ? "email" : f.type === "date" ? "date" : "text"}"
          {...register('${f.name}'${f.type === "number" ? ", { valueAsNumber: true }" : ""})}
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          aria-invalid={errors.${f.name} ? 'true' : 'false'}
          aria-describedby={errors.${f.name} ? '${f.name}-error' : undefined}
        />
        {errors.${f.name} && (
          <p id="${f.name}-error" className="mt-1 text-sm text-red-600" role="alert">
            {errors.${f.name}?.message}
          </p>
        )}
      </div>`).join("\n\n")}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
      >
        {isLoading ? 'Submitting...' : '${submit_action || "Submit"}'}
      </button>
    </form>
  );
}`;

    return {
      content: [
        {
          type: "text",
          text: `FORM GENERATED: ${form_name}

File: frontend/src/components/forms/${form_name}.tsx

\`\`\`tsx
${code}
\`\`\`

Features:
- Zod validation schema
- react-hook-form integration
- Accessible form with ARIA attributes
- Error messages per field
- Loading state handling
- Tailwind styling

Accessibility:
- Labels linked via htmlFor/id
- aria-invalid on error
- aria-describedby for error messages
- role="alert" on errors
- Required fields marked with *`,
        },
      ],
    };
  }

  async reviewAccessibility(args) {
    const { component_code } = args;
    const issues = [];

    // Check for alt text on images
    if (component_code.includes("<img") && !component_code.includes("alt=")) {
      issues.push("❌ Images missing alt text");
    }

    // Check for button/link text
    if (component_code.includes("<button") && component_code.includes(">{}<")) {
      issues.push("❌ Empty button - needs accessible label");
    }

    // Check for ARIA labels
    if (component_code.includes("onClick") && !component_code.includes("aria-label") && !component_code.includes("role=")) {
      issues.push("⚠️ Interactive elements may need aria-label or role");
    }

    // Check for heading hierarchy
    if (component_code.includes("<h3") && !component_code.includes("<h2") && !component_code.includes("<h1")) {
      issues.push("⚠️ Heading hierarchy may be skipped (h3 without h1/h2)");
    }

    // Check for color-only indicators
    if (component_code.includes("text-red") && !component_code.includes("aria-") && !component_code.includes("role=")) {
      issues.push("⚠️ Color may be sole indicator - add text/icon for color-blind users");
    }

    // Check for keyboard navigation
    if (component_code.includes("onClick") && !component_code.includes("onKeyDown") && !component_code.includes("<button") && !component_code.includes("<a ")) {
      issues.push("⚠️ onClick on non-button element - ensure keyboard accessibility");
    }

    // Check for form labels
    if (component_code.includes("<input") && !component_code.includes("<label") && !component_code.includes("aria-label")) {
      issues.push("❌ Form inputs missing labels");
    }

    return {
      content: [
        {
          type: "text",
          text: `ACCESSIBILITY REVIEW

${issues.length === 0 ? "✅ No obvious accessibility issues detected" : `Issues Found (${issues.length}):\n${issues.join("\n")}`}

WCAG 2.1 AA Checklist:
☐ All images have alt text
☐ Color is not the only visual indicator
☐ Interactive elements are keyboard accessible
☐ Form inputs have associated labels
☐ Heading hierarchy is logical (h1 → h2 → h3)
☐ Focus is visible and managed
☐ ARIA attributes used correctly
☐ Sufficient color contrast (4.5:1 text, 3:1 large)
☐ Motion can be paused/reduced (prefers-reduced-motion)
☐ Touch targets are at least 44x44px

Quick Fixes:
- Add aria-label to icon-only buttons
- Use semantic HTML (button, nav, main, aside)
- Add skip-to-content link
- Ensure focus trap in modals`,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("FTTG Frontend Server running on stdio");
  }
}

const server = new FrontendServer();
server.run().catch(console.error);
