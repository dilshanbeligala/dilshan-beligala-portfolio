export type CompanyId = "efito" | "nova" | "epic";
export type ProjectGroup = CompanyId | "independent";

type Company = {
  id: CompanyId;
  name: string;
  shortName: string;
  role: string;
  period: "Current" | "Previous" | "Earlier";
};

export const professionalHistory = [
  { id: "efito", name: "Efito Solutions (Pvt) Ltd", shortName: "Efito Solutions", role: "Software Engineer", period: "Current" },
  { id: "nova", name: "Nova Solutions (Pvt) Ltd", shortName: "Nova Solutions", role: "Associate Software Engineer / Software Engineer", period: "Previous" },
  { id: "epic", name: "Epic Lanka (Pvt) Ltd", shortName: "Epic Lanka", role: "Software Engineer Intern", period: "Earlier" },
] as const satisfies readonly Company[];

type Project = {
  group: ProjectGroup;
  name: string;
  description: string;
  contribution?: string;
  category?: string;
};

export const leadershipRole = "Mobile Team Lead";

export const applications: Readonly<Record<string, Project>> = {
  zulu: {
    group: "efito", name: "Zulu",
    description: "Mobile software for delivery-driver workflows, route handling, and location-related functionality.",
    contribution: "Mobile application development", category: "Software development / Mobile application",
  },
  "toner-connect": {
    group: "efito", name: "Toner Connect",
    description: "A mobile application project. My work focuses on coordinating mobile implementation and maintaining engineering quality.",
    contribution: leadershipRole, category: "Mobile development / Technical leadership",
  },
  jss: { group: "nova", name: "JSS Mobile App", description: "Location-based check-in and check-out for cleaning operations, with progress and earnings tracking." },
  "nova-elite": { group: "nova", name: "Nova Elite Mobile App", description: "Business management and point-of-sale functionality." },
  "posha-crunch": { group: "nova", name: "Posha Crunch Mobile App", description: "Stock and order management for a biscuit company." },
  "mind-engineers": { group: "nova", name: "Mind Engineers Mobile App", description: "A platform for personal wellbeing and related services." },
  grip: { group: "nova", name: "GRIP Mobile App", description: "Gym management with scheduling, attendance, payments, and QR-based access." },
  dlb: { group: "epic", name: "Development Lotteries Board (DLB) App", description: "Lottery purchasing and results functionality." },
  "union-bank": { group: "epic", name: "Union Bank Mobile Banking App", description: "Transfers, recurring payments, transaction history, and branch and ATM discovery." },
  "boc-smart-pay": { group: "epic", name: "BOC Smart Pay Mobile Banking App", description: "School payments and biller management." },
  ticketsog: { group: "independent", name: "TicketsOG QR Scan Application", description: "Mobile ticket scanning and management, with QR scanning, scan summaries, tracking, and scan history." },
  dating: { group: "independent", name: "Dating Application", description: "A mobile project with location-based discovery, matching, and real-time chat." },
};

export const currentEmployer = professionalHistory[0];
export const zulu = applications.zulu;
export const tonerConnect = applications["toner-connect"];

export const projectGroups = [
  ...professionalHistory.map(company => ({ id: company.id, label: company.shortName, name: company.name })),
  { id: "independent", label: "Independent", name: "Independent projects" },
].map(group => ({
  ...group, projects: Object.entries(applications).filter(([, project]) => project.group === group.id),
}));

// Each stable project ID contributes once, including the independent projects.
export const projectCount = Object.keys(applications).length;
export const experienceStart = { year: 2023, month: 3, label: "March 2023" } as const;

export function completedExperienceYears(date: Date) {
  const beforeAnniversaryMonth = date.getUTCMonth() + 1 < experienceStart.month;
  return Math.max(0, date.getUTCFullYear() - experienceStart.year - Number(beforeAnniversaryMonth));
}

export const professionalDescription = `Dilshan Beligala, ${currentEmployer.role} at ${currentEmployer.name} and ${leadershipRole} on ${tonerConnect.name}, working across mobile, full-stack, and AI-assisted software engineering.`;
