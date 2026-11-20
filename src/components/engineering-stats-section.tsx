import { cacheLife } from "next/cache";
import { completedExperienceYears, experienceStart, projectCount } from "@/lib/professional-history";

export async function EngineeringStatsSection() {
  "use cache";
  cacheLife("days");

  const facts = [
    { label: "Years of experience", value: `${completedExperienceYears(new Date())}+`, note: `Since ${experienceStart.label}` },
    { label: "Projects worked on", value: String(projectCount), note: "Employer and independent projects" },
  ];

  return <dl className="engineering-stats" aria-label="Engineering statistics">
    {facts.map(({ label, value, note }) => <div className="engineering-stat" key={label}>
      <dt>{label}</dt>
      <dd>{value}</dd>
      <dd className="engineering-stat-note">{note}</dd>
    </div>)}
  </dl>;
}
