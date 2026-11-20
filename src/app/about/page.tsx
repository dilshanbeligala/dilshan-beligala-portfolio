import { FuturisticFooter } from "@/components/futuristic-footer";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { EngineeringStatsSection } from "@/components/engineering-stats-section";
import { LeadershipSummary, ProfessionalBio } from "@/components/professional-bio";
import { currentEmployer, professionalDescription, professionalHistory, tonerConnect, zulu } from "@/lib/professional-history";
import { MagneticLink } from "@/components/magnetic-link";
import { SiteHeader } from "@/components/site-header";
import "./about.css";

export const metadata: Metadata = {
  title: "About Dilshan Beligala | Software Engineer",
  description: professionalDescription,
};

const principles = [
  ["Build with purpose", "Understand the problem before choosing the solution."],
  ["Design for maintainability", "Build software that remains clear, testable, and adaptable as requirements evolve."],
  ["Keep learning", "Explore better tools, workflows, and approaches without losing sight of engineering fundamentals."],
];

export default function AboutPage() {
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <SiteHeader page="about" />
    <main id="main" className="about-page">
      <section className="about-hero" data-constellation="hero">
        <div className="about-hero-content">
          <p className="eyebrow entrance about-eyebrow"><span className="status-dot" aria-hidden="true" /> ABOUT / THE ENGINEER</p>
          <h1 className="entrance about-hero-title">BEYOND<br />THE <em>CODE</em>.</h1>
          <p className="entrance about-lede">I’m Dilshan Beligala, a <strong>{currentEmployer.role}</strong> building thoughtful digital products through modern engineering, collaboration, and continuous learning.</p>
          <div className="entrance about-role">
            <span>{currentEmployer.role}</span>
            <span>{currentEmployer.name}</span>
          </div>
        </div>
        <div className="entrance about-hero-stats"><EngineeringStatsSection /></div>
      </section>

      <section className="about-section about-intro" data-constellation="about">
        <h2>A LITTLE<br />ABOUT ME.</h2>
        <div className="about-prose"><ProfessionalBio /></div>
      </section>

      <section className="about-section about-efito" data-constellation="experience">
        <div className="about-section-heading">
          <p className="eyebrow about-eyebrow">Currently building</p>
          <h2>ENGINEERING<br />AT EFITO.</h2>
        </div>
        <div className="about-company">
          <header>
            <h3>{currentEmployer.name}</h3>
            <p>{currentEmployer.role}</p>
          </header>
          <div className="about-prose">
            <p>At {currentEmployer.shortName}, I contribute to the development of software solutions with a focus on reliable implementation, maintainable architecture, and collaborative delivery.</p>
            <p>My work includes <strong>{zulu.name}</strong> and <strong>{tonerConnect.name}</strong>, where I apply practical engineering experience to building and improving mobile software.</p>
          </div>
        </div>
      </section>

      <section className="about-section about-leadership" data-constellation="experience">
        <div className="about-section-heading">
          <p className="eyebrow about-eyebrow">Leadership experience</p>
          <h2>Leading mobile<br />development.</h2>
        </div>
        <div className="about-prose">
          <LeadershipSummary />
          <ul className="about-keywords">
            <li>Technical coordination</li><li>Mobile architecture</li>
            <li>Code quality</li><li>Team collaboration</li>
          </ul>
        </div>
      </section>

      <section className="about-section about-stacked" data-constellation="projects">
        <h2>Selected project experience.</h2>
        <div className="about-projects">
          {[zulu, tonerConnect].map(project => <article className="about-project" key={project.name}>
            <p className="about-project-category">{project.category}</p>
            <h3>{project.name}</h3>
            {project.contribution && <p className="about-project-role">{project.contribution}</p>}
            <p>{project.description}</p>
          </article>)}
        </div>
      </section>

      <section className="about-section about-stacked">
        <h2>How I think<br />about engineering.</h2>
        <div className="about-principles">
          {principles.map(([title, body]) => <article key={title}>
            <h3>{title}</h3>
            <p>{body}</p>
          </article>)}
        </div>
      </section>

      <section className="about-section about-stacked">
        <h2>Professional journey.</h2>
        <div className="about-journey">
          <div>
            <h3 className="about-journey-label">Experience</h3>
            <ol className="about-timeline">
              {professionalHistory.map(({ id, period, role, name }) => <li key={id}>
                <span>{period}</span>
                <h4>{role}</h4>
                <p>{name}</p>
              </li>)}
            </ol>
          </div>
          <div>
            <h3 className="about-journey-label">Education</h3>
            <ul className="about-timeline">
              <li><h4>BSc (Hons) Computing</h4><p>Wrexham University</p></li>
              <li><h4>Diploma in Information Technology</h4><p>Institute of Technology, University of Moratuwa</p></li>
            </ul>
          </div>
        </div>
      </section>

      <section className="about-section about-ai" data-constellation="ai">
        <h2>EXPLORING<br />WHAT’S NEXT.</h2>
        <div className="about-prose">
          <p>Alongside my software engineering work, I’m exploring how <strong>AI-assisted development</strong> tools can improve everyday engineering workflows.</p>
          <p>I’m interested in using AI to support code understanding, debugging, refactoring, testing, and faster experimentation, while keeping <strong>technical judgment</strong> and code quality at the center of the process.</p>
        </div>
      </section>

      <section className="about-closing" data-constellation="contact">
        <h2>Let’s build something <br />meaningful.</h2>
        <p>I’m always interested in thoughtful engineering conversations, new ideas, and opportunities to build useful software.</p>
        <div className="about-actions">
          <MagneticLink className="button button-primary magnetic" href="/#contact">Get in touch <ArrowUpRight size={17} /></MagneticLink>
          <MagneticLink className="button button-secondary magnetic" href="/#projects">View projects <ArrowUpRight size={17} /></MagneticLink>
        </div>
      </section>
    </main>
    <FuturisticFooter homeHref="/#home" />
  </>;
}
