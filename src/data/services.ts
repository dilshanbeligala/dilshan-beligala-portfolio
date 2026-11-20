export interface Service {
  id: string;
  title: string;
  technologies: readonly string[];
  description: string;
  category: "development" | "engineering" | "ai";
  featured?: boolean;
}

export const services: readonly Service[] = [
  {
    id: "mobile-development",
    title: "Mobile App Development",
    technologies: ["Flutter", "Dart", "Firebase", "REST APIs"],
    description: "Build responsive, scalable Android and iOS applications with clean architecture and maintainable code.",
    category: "development",
  },
  {
    id: "mobile-modernization",
    title: "Mobile App Modernization",
    technologies: ["Performance", "UI/UX", "Refactoring", "Upgrades"],
    description: "Improve existing applications through performance optimization, modern interfaces, dependency updates, and architectural improvements.",
    category: "development",
  },
  {
    id: "ai-assisted-engineering",
    title: "AI-Assisted Engineering Solutions",
    technologies: ["Cursor", "Claude Code", "Kiro", "Copilot"],
    description: "Use AI-assisted engineering workflows to accelerate planning, development, debugging, testing, and implementation while maintaining human review.",
    category: "ai",
    featured: true,
  },
  {
    id: "bug-fixing",
    title: "Bug Fixing & Troubleshooting",
    technologies: ["Flutter", "APIs", "Debugging", "Root Cause Analysis"],
    description: "Investigate application issues, identify root causes, and implement validated fixes.",
    category: "engineering",
  },
  {
    id: "full-stack-web",
    title: "Full-Stack Web Development",
    technologies: ["React", "Next.js", "Node.js", "APIs"],
    description: "Develop modern web applications and connected backend services.",
    category: "development",
  },
  {
    id: "automated-testing",
    title: "Automated Testing & Quality",
    technologies: ["Unit", "Widget", "Integration", "Regression"],
    description: "Create and improve automated test suites, including AI-assisted test development and verification.",
    category: "engineering",
  },
  {
    id: "secure-development",
    title: "Secure Software Development",
    technologies: ["Authentication", "API Security", "Code Review"],
    description: "Apply security-conscious development practices, review risks, and improve application safeguards.",
    category: "engineering",
  },
  {
    id: "api-integration",
    title: "API Integration & Backend Services",
    technologies: ["REST APIs", "Authentication", "Firebase"],
    description: "Integrate mobile and web applications with APIs, authentication, and backend services.",
    category: "development",
  },
  {
    id: "git-delivery",
    title: "Git & CI/CD Automation",
    technologies: ["GitHub Actions", "Build", "Test", "Deployment"],
    description: "Improve repeatable development workflows with version control, automated checks, and delivery pipelines.",
    category: "engineering",
  },
  {
    id: "refactoring",
    title: "Code Refactoring & Architecture",
    technologies: ["Clean Architecture", "Riverpod", "BLoC"],
    description: "Improve code organization, maintainability, testability, and application structure.",
    category: "engineering",
  },
  {
    id: "mvp-development",
    title: "Rapid MVP Development",
    technologies: ["Prototyping", "Planning", "AI-Assisted Delivery"],
    description: "Turn product concepts into working prototypes with scoped requirements and iterative engineering.",
    category: "development",
  },
  {
    id: "firebase-cloud",
    title: "Firebase & Cloud Integration",
    technologies: ["Firebase Auth", "Messaging", "Realtime Database"],
    description: "Integrate Firebase authentication, real-time data, messaging, and supporting cloud functionality.",
    category: "development",
  },
  {
    id: "consulting",
    title: "Technical Consulting & Planning",
    technologies: ["Architecture", "Feasibility", "Implementation Plans"],
    description: "Explore technical options, structure implementation plans, and assess engineering trade-offs.",
    category: "engineering",
  },
  {
    id: "ai-automation",
    title: "AI Workflow Automation",
    technologies: ["AI Coding Agents", "Development Workflows"],
    description: "Explore and implement practical AI-assisted workflows for repetitive engineering tasks with review and validation.",
    category: "ai",
  },
];
