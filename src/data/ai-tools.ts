type AiTool = {
  id: string;
  name: string;
  mark: string;
  category: string;
  description: string;
  uses: readonly string[];
};

export const aiTools: readonly AiTool[] = [
  {
    id: "cursor",
    name: "Cursor",
    mark: "/ai-tools/cursor.svg",
    category: "AI-Powered Development Environment",
    description: "I use Cursor to explore existing codebases, implement features, investigate bugs, refactor code, and develop automated tests with AI assistance.",
    uses: ["Codebase exploration", "Feature implementation", "Debugging", "Refactoring", "Test generation"],
  },
  {
    id: "claude-code",
    name: "Claude Code",
    mark: "/ai-tools/claude.svg",
    category: "Agentic Coding Assistant",
    description: "I use Claude Code to plan implementations, investigate issues, review changes, and work through complex development tasks.",
    uses: ["Multi-step development", "Codebase exploration", "Debugging", "Planning", "Code review"],
  },
  {
    id: "kiro",
    name: "Kiro",
    mark: "/ai-tools/kiro.svg",
    category: "AI-Assisted Development Environment",
    description: "I explore Kiro for structured, AI-assisted development, from feature requirements through implementation and task organization.",
    uses: ["Structured development", "Requirements planning", "Implementation assistance", "Workflow organization"],
  },
  {
    id: "copilot",
    name: "GitHub Copilot",
    mark: "/ai-tools/githubcopilot.svg",
    category: "AI Coding Assistant",
    description: "I use GitHub Copilot for everyday development, including code suggestions, implementation assistance, and small refactors.",
    uses: ["Code suggestions", "Development assistance", "Refactoring support", "Everyday coding"],
  },
];
