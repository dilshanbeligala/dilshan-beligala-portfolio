import { ArrowUpRight } from "lucide-react";
import { portfolio } from "@/lib/portfolio";
import { currentEmployer, leadershipRole, professionalHistory, projectGroups, tonerConnect, zulu } from "@/lib/professional-history";
import { EngineeringStatsSection } from "./engineering-stats-section";
import { MagneticLink } from "./magnetic-link";
import { LeadershipSummary, ProfessionalBio } from "./professional-bio";

export function HomeAbout() {
  return <section id="about" className="content-section home-professional home-bio" data-constellation="about">
    <div className="home-section-lead">
      <p className="eyebrow">01 / ABOUT ME</p>
      <h2>BEYOND<br /><span>THE CODE.</span></h2>
    </div>
    <div className="home-professional-copy">
      <ProfessionalBio />
      <MagneticLink className="text-link" href="/about">More about my engineering journey <ArrowUpRight size={17} /></MagneticLink>
    </div>
    <div className="home-stats-block">
      <h3>Engineering statistics</h3>
      <EngineeringStatsSection />
    </div>
  </section>;
}

export function HomeExperience() {
  return <section id="experience" className="content-section home-professional home-career" data-constellation="experience">
    <div className="home-section-lead">
      <p className="eyebrow">02 / EXPERIENCE</p>
      <h2>WHERE I’VE<br /><span>BUILT.</span></h2>
    </div>
    <div>
      <ol className="home-career-list">
        {professionalHistory.map(company => <li key={company.id}>
          <p className="home-career-status">{company.period}</p>
          <h3>{company.name}</h3>
          <p className="home-career-role">{company.role}</p>
          {company.id === currentEmployer.id && <p>Contributing to software development with a focus on reliable implementation, maintainable architecture, and collaborative delivery. My work includes {zulu.name} and {tonerConnect.name}.</p>}
          <a className="text-link" href={`#archive-${company.id}`}>See {company.shortName} applications <ArrowUpRight size={14} /></a>
        </li>)}
      </ol>
      <aside className="home-leadership" aria-labelledby="mobile-lead-heading">
        <p className="eyebrow">{tonerConnect.name.toUpperCase()} / {leadershipRole.toUpperCase()}</p>
        <h3 id="mobile-lead-heading">Leading the mobile experience.</h3>
        <LeadershipSummary />
      </aside>
    </div>
    <div className="home-approach" aria-labelledby="home-approach-heading">
      <h3 id="home-approach-heading">My engineering approach</h3>
      <ul>
        <li><strong>Understand the problem.</strong> Start with the people, the purpose, and the constraints.</li>
        <li><strong>Engineer with intention.</strong> Connect mobile and web experiences through thoughtful full-stack development.</li>
        <li><strong>Build with intelligence.</strong> Bring AI into development with human judgment at the center.</li>
      </ul>
    </div>
  </section>;
}

export function HomeProjectArchive() {
  return <section id="projects" className="content-section home-professional home-projects" data-constellation="projects">
    <div className="home-section-lead">
      <p className="eyebrow">03 / SELECTED WORK</p>
      <h2>APPLICATIONS<br /><span>I’VE WORKED ON.</span></h2>
    </div>
    <div className="home-professional-copy home-archive-lead">
      <p>Mobile applications from my work at {professionalHistory[0].shortName}, {professionalHistory[1].shortName}, and {professionalHistory[2].shortName}, alongside independent projects.</p>
      <nav className="home-archive-nav" aria-label="Application groups">
        {projectGroups.map(group => <a key={group.id} href={`#archive-${group.id}`}>{group.label}</a>)}
      </nav>
    </div>
    <div className="home-archive">
      {projectGroups.map(group => <section className="home-archive-group" id={`archive-${group.id}`} key={group.id} aria-labelledby={`archive-label-${group.id}`}>
        <h3 id={`archive-label-${group.id}`}>{group.name}</h3>
        <div className="home-project-grid">
          {group.projects.map(([id, project]) => <article className="home-project-card" key={id} data-project={id}>
            <p className="home-project-company">{group.id === "independent" ? "Independent project" : group.label}</p>
            <h4>{project.name}</h4>
            {project.contribution && <p className="home-project-role">{project.contribution}</p>}
            <p>{project.description}</p>
          </article>)}
        </div>
      </section>)}
      <a className="text-link" href={portfolio.linkedin} target="_blank" rel="noopener noreferrer">Discuss my work on LinkedIn <ArrowUpRight size={17} /><span className="sr-only"> (opens in a new tab)</span></a>
    </div>
  </section>;
}
