import { currentEmployer, leadershipRole, tonerConnect, zulu } from "@/lib/professional-history";

export function ProfessionalBio() {
  return <>
    <p>I’m Dilshan Beligala, a <strong>{currentEmployer.role}</strong> currently working at <strong>{currentEmployer.shortName}</strong> (Pvt) Ltd.</p>
    <p>I started in mobile application development and expanded into full-stack development, application architecture, and collaborative problem-solving.</p>
    <p>At {currentEmployer.shortName}, I’ve contributed to {zulu.name} and {tonerConnect.name}. On {tonerConnect.name}, I serve as the <strong>{leadershipRole}</strong>, helping guide mobile development and maintain engineering quality.</p>
    <p>I’m exploring <strong>AI-assisted software engineering</strong> and modern development workflows to improve how reliable, maintainable software is built.</p>
  </>;
}

export function LeadershipSummary() {
  return <p>On {tonerConnect.name}, I serve as the <strong>{leadershipRole}</strong>, helping coordinate development, guide technical implementation, and maintain a consistent focus on software quality.</p>;
}
