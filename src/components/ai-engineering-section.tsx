import { ArrowUpRight, BadgeCheck, ChevronDown, CircleCheck, FlaskConical } from "lucide-react";
import type { CSSProperties } from "react";
import { aiEngineering, aiResearchInterests, aiWorkflow } from "@/data/ai-engineering";
import { aiTools } from "@/data/ai-tools";
import { aiCertifications } from "@/data/certifications";
import { AiEngineeringMotion } from "./ai-engineering-motion";
import { MagneticLink } from "./magnetic-link";
import "./ai-engineering.css";

export function AiEngineeringSection() {
  return <AiEngineeringMotion>
    <header className="ai-intro" data-ai-reveal>
      <div>
        <p className="ai-label">{aiEngineering.label}</p>
        <h2 id="ai-engineering-heading" className="ai-title">
          {aiEngineering.heading.map(line => <span key={line}><span>{line}</span></span>)}
        </h2>
      </div>
      <div className="ai-intro-copy">
        <p className="ai-label">{aiEngineering.tagline}</p>
        <p>{aiEngineering.introduction}</p>
        <p className="ai-principle"><CircleCheck aria-hidden="true" size={18} />{aiEngineering.principle}</p>
      </div>
    </header>

    <section className="ai-block" aria-labelledby="ai-tools-heading">
      <h3 id="ai-tools-heading">{aiEngineering.toolsTitle}</h3>
      <div className="ai-tool-grid">
        {aiTools.map(tool => <details key={tool.id} className="ai-tool ai-panel">
          <summary>
            <span className="ai-tool-head">
              <span className="ai-tool-icon" aria-hidden="true" style={{ "--ai-mark": `url("${tool.mark}")` } as CSSProperties} />
              <span><strong>{tool.name}</strong><span className="ai-label">{tool.category}</span></span>
              <ChevronDown className="ai-tool-chevron" size={18} aria-hidden="true" />
            </span>
            <span className="ai-tool-description">{tool.description}</span>
          </summary>
          <ul className="ai-tags" aria-label={`${tool.name} use cases`}>
            {tool.uses.map(use => <li key={use}>{use}</li>)}
          </ul>
        </details>)}
      </div>
    </section>

    <section className="ai-block ai-workflow-layout" aria-labelledby="ai-workflow-heading">
      <div className="ai-workflow-lead">
        <p className="ai-label">Engineering workflow</p>
        <h3 id="ai-workflow-heading">{aiEngineering.workflowTitle}</h3>
      </div>
      <ol className="ai-workflow">
        {aiWorkflow.map((stage, index) => <li key={stage.title}>
          <span className="ai-stage-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
          <div className="ai-panel ai-stage">
            <h4>{stage.title}</h4>
            <p>{stage.description}</p>
          </div>
        </li>)}
      </ol>
    </section>

    <section className="ai-block ai-research ai-panel" aria-labelledby="ai-research-heading">
      <div>
        <p className="ai-label"><FlaskConical size={16} aria-hidden="true" />Ongoing exploration</p>
        <h3 id="ai-research-heading">{aiEngineering.learningTitle}</h3>
        <p>{aiEngineering.learningDescription}</p>
      </div>
      <ul className="ai-research-topics">
        {aiResearchInterests.map(topic => <li key={topic} data-ai-reveal>{topic}</li>)}
      </ul>
    </section>

    <section className="ai-block" aria-labelledby="ai-credentials-heading">
      <p className="ai-label">Certifications & Learning</p>
      <h3 id="ai-credentials-heading">{aiEngineering.credentialsTitle.join(" ")}</h3>
      <ul className="ai-credential-grid">
        {aiCertifications.map(cert => <li key={cert.verificationUrl} className="ai-credential ai-panel" data-ai-reveal>
          <p className="ai-label"><BadgeCheck size={18} aria-hidden="true" /> Certificate of completion</p>
          <h4>{cert.title}</h4>
          <p className="ai-issuer">{cert.issuer}</p>
          <MagneticLink className="text-link" href={cert.verificationUrl} target="_blank" rel="noopener noreferrer">
            View Credential <ArrowUpRight size={16} aria-hidden="true" />
            <span className="sr-only"> for {cert.title} (opens in a new tab)</span>
          </MagneticLink>
        </li>)}
      </ul>
    </section>
  </AiEngineeringMotion>;
}
