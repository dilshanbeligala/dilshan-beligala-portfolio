import { statSync } from "node:fs";
import { join } from "node:path";
import { ArrowDown, ArrowUpRight, FileText } from "lucide-react";
import "../editorial-sections.css";
import "./resume-section.css";

const filename = "Dilshan_Beligala_CV.pdf";
const pdfUrl = `/${filename}`;

export function ResumeSection() {
  const file = statSync(join(process.cwd(), "public", filename), { throwIfNoEntry: false });
  const available = file?.isFile() && file.size > 0;

  return <section id="resume" className="editorial-section resume-section" aria-labelledby="resume-heading">
    <header className="editorial-section-heading resume-heading">
      <p>09 / MY RESUME</p>
      <h2 id="resume-heading">MY EXPERIENCE.<br /><span>ONE DOCUMENT.</span></h2>
      <p>Explore my professional experience, technical expertise, projects, and AI-assisted software engineering journey.</p>
    </header>
    <article className="resume-card" aria-labelledby="resume-document-title">
      <div className="resume-card-glow" aria-hidden="true" />
      <div className="resume-file-icon" aria-hidden="true"><FileText size={30} strokeWidth={1.4} /></div>
      <div className="resume-document">
        <p className="resume-filename">{filename}</p>
        <h3 id="resume-document-title">Dilshan Beligala — Curriculum Vitae</h3>
        <p className="resume-document-role">Software Engineer <span>PDF</span></p>
      </div>
      {available ? <div className="resume-actions">
        <a className="button button-primary" href={pdfUrl} download={filename}>
          Download My CV <ArrowDown size={17} aria-hidden="true" />
        </a>
        <a className="button button-secondary" href={pdfUrl} target="_blank" rel="noopener noreferrer">
          View CV <ArrowUpRight size={17} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div> : <p className="resume-status">The CV is currently unavailable.</p>}
    </article>
  </section>;
}
