import { ContactLinks } from "@/components/contact-links";
import { FuturisticFooter } from "@/components/futuristic-footer";
import { ServicesSection } from "@/components/services/services-section";
import { AiEngineeringSection } from "@/components/ai-engineering-section";
import { ArrowDown, ArrowUpRight, Code2, Layers3, Smartphone } from "lucide-react";
import { MagneticLink } from "@/components/magnetic-link";
import { HomeAbout, HomeExperience, HomeProjectArchive } from "@/components/home-professional";
import { SiteHeader } from "@/components/site-header";
import { GlitchTypography } from "@/components/glitch-typography";
import { HeroStage } from "@/components/hero-stage";
import { portfolio } from "@/lib/portfolio";

const heroName = [
  { text: "DILSHAN" },
  { text: "BELIGALA.", accents: [0, 8] },
] as const;

export default function Home() {
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <SiteHeader />
    <main id="main">
      <HeroStage>
        <div className="hero-content">
          <p className="eyebrow entrance"><span className="status-dot" /> ENGINEERING × IMAGINATION</p>
          <GlitchTypography lines={heroName} label="Dilshan Beligala." />
          <p className="role entrance">SOFTWARE ENGINEER <span className="role-separator">/</span> <span className="role-title">CREATIVE THINKER</span></p>
          <h2 className="hero-message entrance">Engineering intelligent digital experiences.</h2>
          <p className="hero-description entrance">Building thoughtful software across mobile, web, and AI-assisted development — combining engineering discipline with creative problem-solving.</p>
          <div className="hero-actions entrance">
            <MagneticLink className="button button-primary magnetic" href="#projects">Explore My Work <ArrowUpRight size={17} /></MagneticLink>
            <MagneticLink className="button button-secondary magnetic" href="#contact">Let’s Connect <ArrowUpRight size={17} /></MagneticLink>
          </div>
          <a className="linkedin entrance" href={portfolio.linkedin} target="_blank" rel="noopener noreferrer"><span className="linkedin-mark">in</span> Find me on LinkedIn <ArrowUpRight size={13} /><span className="sr-only"> (opens in a new tab)</span></a>
        </div>
        <div className="hero-bottom"><a href="#about"><span className="scroll-box"><ArrowDown size={14} /></span> SCROLL TO DISCOVER</a><span className="bottom-note"><i /> BUILDING WHAT’S NEXT</span><span className="edition">PORTFOLIO — 01 / 2026</span></div>
      </HeroStage>
      <HomeAbout />
      <div className="discipline-strip" aria-label="Areas of focus"><span>THOUGHTFULLY ENGINEERED.</span><span><Smartphone size={16} /> Mobile development</span><span><Code2 size={17} /> Full-stack engineering</span><span><Layers3 size={17} /> AI-assisted development</span><span className="strip-symbol">✳</span></div>
      <HomeExperience />
      <HomeProjectArchive />
      <ServicesSection />
      <AiEngineeringSection />
      <section id="contact" className="contact-section" data-constellation="contact"><p className="eyebrow"><span className="status-dot" /> START A CONVERSATION</p><h2>Let’s build<br />what’s <span>next.</span></h2><MagneticLink className="button button-primary magnetic" href={portfolio.linkedin} target="_blank" rel="noopener noreferrer">Connect on LinkedIn <ArrowUpRight size={19} /><span className="sr-only"> (opens in a new tab)</span></MagneticLink><ContactLinks /></section>
    </main>
    <FuturisticFooter />
  </>;
}
