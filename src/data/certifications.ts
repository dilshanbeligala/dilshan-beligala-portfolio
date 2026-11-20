type Certification = {
  title: string;
  issuer: string;
  verificationUrl: `https://verify.skilljar.com/c/${string}`;
};

export const aiCertifications: readonly Certification[] = [
  { title: "Claude Code in Action", issuer: "Anthropic", verificationUrl: "https://verify.skilljar.com/c/ffcy4sswocuw" },
  { title: "Claude Code 101", issuer: "Anthropic", verificationUrl: "https://verify.skilljar.com/c/orffzpv25krz" },
  { title: "AI Fluency: Framework & Foundations", issuer: "Anthropic", verificationUrl: "https://verify.skilljar.com/c/x8j9okdobxzj" },
];
