import assert from "node:assert/strict";
import { test } from "node:test";
import { services } from "../../src/data/services.ts";

const expected = [
  ["Mobile App Development", "Flutter · Dart · Firebase · REST APIs"],
  ["Mobile App Modernization", "Performance · UI/UX · Refactoring · Upgrades"],
  ["AI-Assisted Engineering Solutions", "Cursor · Claude Code · Kiro · Copilot"],
  ["Bug Fixing & Troubleshooting", "Flutter · APIs · Debugging · Root Cause Analysis"],
  ["Full-Stack Web Development", "React · Next.js · Node.js · APIs"],
  ["Automated Testing & Quality", "Unit · Widget · Integration · Regression"],
  ["Secure Software Development", "Authentication · API Security · Code Review"],
  ["API Integration & Backend Services", "REST APIs · Authentication · Firebase"],
  ["Git & CI/CD Automation", "GitHub Actions · Build · Test · Deployment"],
  ["Code Refactoring & Architecture", "Clean Architecture · Riverpod · BLoC"],
  ["Rapid MVP Development", "Prototyping · Planning · AI-Assisted Delivery"],
  ["Firebase & Cloud Integration", "Firebase Auth · Messaging · Realtime Database"],
  ["Technical Consulting & Planning", "Architecture · Feasibility · Implementation Plans"],
  ["AI Workflow Automation", "AI Coding Agents · Development Workflows"],
];

test("all 14 services retain their requested order and technology subtitles", () => {
  assert.equal(services.length, 14);
  assert.equal(new Set(services.map(service => service.id)).size, 14);
  assert.deepEqual(services.map(service => [service.title, service.technologies.join(" · ")]), expected);
  assert.ok(services.every(service => service.description.trim().length > 0));
  assert.deepEqual(services.filter(service => service.featured).map(service => service.id), ["ai-assisted-engineering"]);
});
