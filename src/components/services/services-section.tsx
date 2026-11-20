import { ArrowUpRight, Mail } from "lucide-react";
import { services, type Service } from "@/data/services";
import { portfolio } from "@/lib/portfolio";
import { MagneticLink } from "../magnetic-link";
import { ServicesMotion } from "./services-motion";
import "./services.css";

const stages = ["Plan", "Develop", "Debug", "Test", "Review", "Deliver"];

function ServiceRow({ service, index }: { service: Service; index: number }) {
  const detailsId = `service-${service.id}`;
  return <li data-service-reveal>
    <details className="service-row" name="portfolio-services" data-featured={service.featured || undefined}>
      <summary aria-controls={detailsId}>
        <span className="service-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <span className="service-label">
          <strong>{service.title}</strong>
          <span>{service.technologies.join(" · ")}</span>
        </span>
        {service.featured && <span className="service-flow-preview" aria-hidden="true">
          {stages.map(stage => <span key={stage}>{stage}</span>)}
        </span>}
        <ArrowUpRight className="service-arrow" size={25} aria-hidden="true" />
      </summary>
      <div id={detailsId} className="service-details">
        <p>{service.description}</p>
        {service.featured && <div className="service-flow-details">
          <p>AI assists each stage. Human judgment guides what moves forward.</p>
          <ol aria-label="AI-assisted engineering workflow">
            {stages.map(stage => <li key={stage}>{stage}</li>)}
          </ol>
        </div>}
      </div>
    </details>
  </li>;
}

export function ServicesSection() {
  return <ServicesMotion>
    <header className="services-intro" data-service-reveal>
      <div>
        <p className="services-eyebrow">06 / WHAT I DO</p>
        <h2 id="services-heading">
          <span><span>Engineering Solutions.</span></span>
          <span><span>Built for What’s Next.</span></span>
        </h2>
      </div>
      <div className="services-intro-copy">
        <p>From mobile applications and full-stack platforms to AI-assisted engineering, I help turn ideas into reliable software, improve existing systems, and solve complex development challenges.</p>
        <p>Combining practical engineering experience with modern tools, thoughtful architecture, and AI-assisted workflows.</p>
      </div>
    </header>
    <ol className="services-list" aria-label="Engineering services">
      {services.map((service, index) => <ServiceRow key={service.id} service={service} index={index} />)}
    </ol>
    <div className="services-cta" data-service-reveal>
      <div>
        <h3>Have a challenge worth solving?</h3>
        <p>Whether you’re building something new, improving an existing application, or exploring AI-assisted development, let’s discuss the possibilities.</p>
      </div>
      <div className="services-actions">
        <MagneticLink className="button button-primary magnetic" href="#contact">Let’s Discuss Your Project</MagneticLink>
        <MagneticLink className="button button-secondary magnetic" href={`mailto:${portfolio.email}`}><Mail size={16} aria-hidden="true" /> Send an Email</MagneticLink>
      </div>
    </div>
  </ServicesMotion>;
}
