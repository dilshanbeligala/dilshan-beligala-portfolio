import { ArrowUp } from "lucide-react";
import { currentEmployer } from "@/lib/professional-history";
import { footerTechnologies } from "@/data/footer-technologies";
import { FooterSocialLinks } from "./contact-links";
import { FooterMotion } from "./footer-motion";
import "./futuristic-footer.css";

export function FuturisticFooter({ homeHref = "#home" }: { homeHref?: string }) {
  return <FooterMotion>
    <div className="footer-universe">
      <p className="footer-technical-label">The Infinite Engineering Universe</p>
      <div className="footer-word-field" aria-hidden="true">
        {footerTechnologies.map(({ text, tier }) => <span key={text} className="footer-word" data-tier={tier}>{text}</span>)}
      </div>
    </div>
    <div className="footer-identity">
      <div className="footer-identity-heading">
        <p className="footer-technical-label">{currentEmployer.role}</p>
        <h2 id="footer-identity-name">DILSHAN <span>BELIGALA</span></h2>
      </div>
      <div className="footer-identity-copy">
        <p className="footer-tagline">Engineering ideas into intelligent digital experiences.</p>
        <p>Building thoughtful software across mobile, web, and AI-assisted development.</p>
      </div>
      <div className="footer-actions">
        <FooterSocialLinks />
        <a className="footer-back-to-top" href={homeHref}>
          <span>Back to Top</span>
          <span className="footer-progress-ring" aria-hidden="true">
            <svg viewBox="0 0 48 48" width="48" height="48">
              <circle className="footer-progress-track" cx="24" cy="24" r="22" />
              <circle className="footer-progress-value" cx="24" cy="24" r="22" pathLength="100" strokeDasharray="100" strokeDashoffset="100" />
            </svg>
            <ArrowUp size={18} />
          </span>
        </a>
      </div>
    </div>
  </FooterMotion>;
}
