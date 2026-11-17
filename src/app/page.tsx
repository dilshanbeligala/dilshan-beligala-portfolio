import { ArrowDown, ArrowUpRight, Code2, Layers3, Smartphone } from "lucide-react";
import { MagneticLink } from "@/components/magnetic-link";
import { SiteHeader } from "@/components/site-header";
import { HeroStage } from "@/components/hero-stage";
import { portfolio } from "@/lib/portfolio";

export default function Home() {
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <SiteHeader />
    <main id="main">
      <HeroStage>
        <div className="hero-content">
          <p className="eyebrow entrance"><span className="status-dot" /> ENGINEERING × IMAGINATION</p>
          <h1 className="entrance name"><span>DILSHAN</span><span>BELIGALA<span className="name-period">.</span></span></h1>
          <p className="role entrance">SOFTWARE ENGINEER <span> / </span> CREATIVE THINKER</p>
          <h2 className="hero-message entrance">Engineering intelligent<br />digital experiences.</h2>
          <p className="hero-description entrance">Building thoughtful software across mobile, web, and AI-assisted development — combining engineering discipline with creative problem-solving.</p>
          <div className="hero-actions entrance">
            <MagneticLink className="button button-primary magnetic" href="#projects">Explore My Work <ArrowUpRight size={17} /></MagneticLink>
            <MagneticLink className="button button-secondary magnetic" href="#contact">Let’s Connect <ArrowUpRight size={17} /></MagneticLink>
          </div>
          <a className="linkedin entrance" href={portfolio.linkedin} target="_blank" rel="noopener noreferrer"><span className="linkedin-mark">in</span> Find me on LinkedIn <ArrowUpRight size={13} /><span className="sr-only"> (opens in a new tab)</span></a>
        </div>
        <div className="hero-bottom"><a href="#about"><span className="scroll-box"><ArrowDown size={14} /></span> SCROLL TO DISCOVER</a><span className="bottom-note"><i /> BUILDING WHAT’S NEXT</span><span className="edition">PORTFOLIO — 01 / 2026</span></div>
      </HeroStage>
      <div className="discipline-strip" aria-label="Areas of focus"><span>THOUGHTFULLY ENGINEERED.</span><span><Smartphone size={16} /> Mobile development</span><span><Code2 size={17} /> Full-stack engineering</span><span><Layers3 size={17} /> AI-assisted development</span><span className="strip-symbol">✳</span></div>
      <section id="about" className="content-section about-section"><p className="eyebrow">01 / THE ENGINEER</p><div><h2>Curiosity at the core.<br /><span>Craft in every detail.</span></h2><p>I’m Dilshan Beligala, a software engineer working across mobile, web, and AI-assisted development. I care about the space where thoughtful engineering meets an intuitive digital experience.</p></div></section>
      <section id="experience" className="content-section"><p className="eyebrow">02 / MY APPROACH</p><div><h2>From a clear idea.<br /><span>To a considered experience.</span></h2><div className="approach-list">{[["01", "Understand the problem", "Start with the people, the purpose, and the constraints."], ["02", "Engineer with intention", "Connect mobile and web experiences through thoughtful full-stack development."], ["03", "Build with intelligence", "Bring AI into the development process with human judgment at the center."]].map(([number,title,description])=><article key={number}><span>{number}</span><div><h3>{title}</h3><p>{description}</p></div></article>)}</div></div></section>
      <section id="projects" className="content-section"><p className="eyebrow">03 / SELECTED WORK</p><div><h2>Good work deserves<br /><span>a closer look.</span></h2><p>Connect with me for project details and a conversation about my work across mobile, web, and AI-assisted development.</p><a className="text-link" href={portfolio.linkedin} target="_blank" rel="noopener noreferrer">Discuss my work on LinkedIn <ArrowUpRight size={17} /><span className="sr-only"> (opens in a new tab)</span></a></div></section>
      <section id="ai-engineering" className="content-section"><p className="eyebrow">04 / AI ENGINEERING</p><div><h2>Human imagination.<br /><span>Intelligent tools.</span></h2><p>I explore AI-assisted software development as a way to turn ideas into thoughtful software. The focus stays on understanding the problem, reviewing the output, and building experiences that make sense for the people using them.</p><div className="tags"><span>AI-assisted development</span><span>Creative problem-solving</span><span>Engineering discipline</span></div></div></section>
      <section id="contact" className="contact-section"><p className="eyebrow"><span className="status-dot" /> START A CONVERSATION</p><h2>Let’s build<br />what’s <span>next.</span></h2><MagneticLink className="button button-primary magnetic" href={portfolio.linkedin} target="_blank" rel="noopener noreferrer">Connect on LinkedIn <ArrowUpRight size={19} /><span className="sr-only"> (opens in a new tab)</span></MagneticLink></section>
    </main>
    <footer><a className="footer-brand" href="#home">DB<span> / DILSHAN BELIGALA</span></a><p>Thoughtfully designed. Intentionally engineered.</p><a href="#home">Back to top ↑</a></footer>
  </>;
}
