export const aiEngineering = {
  label: "AI ENGINEERING",
  heading: ["Engineering Smarter.", "Building Beyond."],
  tagline: "Human Expertise × AI Acceleration",
  introduction: "I integrate AI-assisted development into my engineering workflow to plan, build, debug, test, and improve software more effectively. I bring practical mobile and software engineering experience to building secure, maintainable applications.",
  principle: "AI is a powerful collaborator. I review generated code, validate decisions, test behavior, and take responsibility for what ships.",
  toolsTitle: "How I work with AI",
  workflowTitle: "From Idea to Production — With AI Assistance.",
  learningTitle: "Learning at the Speed of AI.",
  learningDescription: "I explore emerging developer tools, agentic workflows, and prompt engineering techniques to improve how I plan, build, and validate software.",
  credentialsTitle: ["Continuous Learning.", "Verified Progress."],
} as const;

type WorkflowStage = { title: string; description: string };

export const aiWorkflow: readonly WorkflowStage[] = [
  { title: "Plan", description: "Analyze requirements, explore solutions, and break the work into implementation tasks." },
  { title: "Design", description: "Research technical options and evaluate architecture, application structure, trade-offs, and maintainability." },
  { title: "Develop", description: "Use AI assistance to implement features and integrations while retaining control of engineering decisions." },
  { title: "Debug", description: "Investigate errors, trace root causes, and validate proposed fixes against the observed behavior." },
  { title: "Test", description: "Create unit, widget, and integration tests where appropriate, verify expected behavior, and catch regressions." },
  { title: "Secure & Review", description: "Review changes for security weaknesses, unsafe dependencies, authorization issues, and maintainability." },
  { title: "Version & Deliver", description: "Use AI to assist with Git workflows, change review, pull request preparation, and technical documentation for delivery." },
  { title: "Learn & Improve", description: "Evaluate new tools and techniques and apply what works to the next engineering task." },
];

export const aiResearchInterests = [
  "Agentic coding workflows",
  "Prompt engineering for development",
  "AI-assisted testing",
  "AI-assisted debugging",
  "Secure AI-assisted coding",
  "AI-supported software architecture",
  "AI-assisted development automation",
  "Emerging developer tools",
] as const;
