import { execFileSync } from "node:child_process";

/**
 * Fails on any HIGH or CRITICAL npm audit advisory that is not explicitly
 * accepted below.
 */
const ACCEPTED_ADVISORIES = [];

const BLOCKING_SEVERITIES = new Set(["high", "critical"]);

function runAudit() {
  try {
    return execFileSync("npm", ["audit", "--json"], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (error) {
    if (typeof error.stdout === "string" && error.stdout.trim()) {
      return error.stdout;
    }
    throw error;
  }
}

function collectAdvisories(report) {
  const advisories = new Map();

  for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
    for (const via of vulnerability.via ?? []) {
      if (typeof via !== "object" || !BLOCKING_SEVERITIES.has(via.severity)) {
        continue;
      }
      advisories.set(via.url, {
        url: via.url,
        package: via.name,
        title: via.title,
        severity: via.severity,
      });
    }
  }

  return [...advisories.values()];
}

const report = JSON.parse(runAudit());
const advisories = collectAdvisories(report);
const acceptedUrls = new Set(ACCEPTED_ADVISORIES.map((entry) => entry.url));
const blocking = advisories.filter((entry) => !acceptedUrls.has(entry.url));
const accepted = advisories.filter((entry) => acceptedUrls.has(entry.url));

for (const entry of accepted) {
  const context = ACCEPTED_ADVISORIES.find((item) => item.url === entry.url);
  console.log(`Accepted: ${entry.package} — ${entry.title}`);
  console.log(`  ${entry.url}`);
  console.log(`  Reason: ${context.reason}`);
  console.log(`  Remove when: ${context.removeWhen}`);
}

const staleAcceptances = ACCEPTED_ADVISORIES.filter(
  (entry) => !advisories.some((advisory) => advisory.url === entry.url),
);

for (const entry of staleAcceptances) {
  console.log(
    `Note: accepted advisory ${entry.url} (${entry.package}) is no longer reported — remove it from scripts/audit-check.mjs.`,
  );
}

if (blocking.length > 0) {
  console.error(`\n${blocking.length} unaccepted high/critical advisories:`);
  for (const entry of blocking) {
    console.error(`  ${entry.severity} — ${entry.package}: ${entry.title}`);
    console.error(`    ${entry.url}`);
  }
  console.error(
    "\nFix them, or add an entry with a reason to ACCEPTED_ADVISORIES in scripts/audit-check.mjs.",
  );
  process.exit(1);
}

console.log("\nNo unaccepted high or critical vulnerabilities.");
