import { ArrowUpRight, Code2, Mail, MessageCircle } from "lucide-react";
import Image from "next/image";
import { portfolio } from "@/lib/portfolio";
import { MagneticLink } from "./magnetic-link";
import "./contact-links.css";

const externalLink = { target: "_blank", rel: "noopener noreferrer" } as const;

const contactLinks = [
  { label: "GitHub", action: "View Profile", href: portfolio.github, icon: <Code2 size={20} aria-hidden="true" />, external: true },
  {
    label: "Facebook",
    action: "View Profile",
    href: portfolio.facebook,
    icon: <Image src="/facebook.ico" width={20} height={20} alt="" unoptimized />,
    external: true,
  },
  { label: "Email", detail: portfolio.email, action: "Send Email", href: `mailto:${portfolio.email}`, icon: <Mail size={20} aria-hidden="true" />, external: false },
  { label: "WhatsApp", detail: portfolio.whatsapp.phone, action: "Start Chat", href: portfolio.whatsapp.url, icon: <MessageCircle size={20} aria-hidden="true" />, external: true },
] as const;

export function ContactLinks() {
  return <ul className="contact-links" aria-label="More ways to get in touch">
    {contactLinks.map(link => <li key={link.label}>
      <MagneticLink className="contact-link magnetic" href={link.href} {...(link.external ? externalLink : {})}>
        <span className="contact-link-icon">{link.icon}</span>
        <span className="contact-link-copy">
          <strong>{link.label}</strong>
          {"detail" in link && <span>{link.detail}</span>}
          <span className="contact-link-action">{link.action} <ArrowUpRight size={14} aria-hidden="true" /></span>
        </span>
        {link.external && <span className="sr-only"> (opens in a new tab)</span>}
      </MagneticLink>
    </li>)}
  </ul>;
}

export function FooterSocialLinks() {
  return <nav className="footer-social-links" aria-label="Social and contact links">
    <a href={portfolio.linkedin} {...externalLink}><span className="footer-linkedin-mark" aria-hidden="true">in</span>LinkedIn<span className="sr-only"> (opens in a new tab)</span></a>
    {contactLinks.map(link => <a key={link.label} href={link.href} {...(link.external ? externalLink : {})}>
      <span aria-hidden="true">{link.icon}</span>
      {link.label === "Email" ? "Email Me" : link.label}
      {link.external && <span className="sr-only"> (opens in a new tab)</span>}
    </a>)}
  </nav>;
}
