import type { Post } from "../posts-types";

export const secureSoftware: Post = {
  slug: "break-your-own-api",
  focus: "secure-software-engineering",
  title: "Break Your Own API Before Someone Else Does",
  subtitle: "Threat modeling, object-level authorization and pipeline gates — the three habits behind most real API security.",
  date: "2026-10-03",
  minutes: 14,
  accent: "#34d399",
  motif: "lattice",
  kit: {
    name: "API Breaker Lab Kit",
    tagline: "Everything to threat-model, attack and gate an API in one afternoon.",
    includes: [
      "Two-user authorization test harness (TypeScript + Vitest) for BOLA and BFLA",
      "STRIDE-per-element worksheet pre-filled for a REST service",
      "GitHub Actions workflow: SBOM (Syft) + vulnerability gate (Grype)",
      "Release checklist mapped to NIST SSDF practices",
    ],
  },
  sections: [
    {
      id: "why",
      access: "anonymous",
      title: "Why APIs break: it's usually authorization",
      teaser: "",
      blocks: [
        {
          kind: "p",
          text: "Most API breaches are not exotic. In the OWASP API Security Top 10 (2023 edition), the number-one risk is Broken Object Level Authorization (BOLA): the server checks that you are logged in, but not that the object you asked for is yours. Change /notes/1041 to /notes/1042 and you are reading someone else's data. Number five, Broken Function Level Authorization (BFLA), is the same mistake one level up: an ordinary user can call an admin function because nobody checked the role.",
        },
        {
          kind: "p",
          text: "Both bugs survive code review because each endpoint looks fine on its own. They are found by asking, deliberately and early, what can go wrong — which is what threat modeling is.",
        },
        { kind: "diagram", name: "trust-boundary", caption: "A data-flow view of a small notes API. Every arrow that crosses a dashed trust boundary is a place to ask: who is calling, and are they allowed to touch this object?" },
        { kind: "h", text: "The four questions" },
        {
          kind: "list",
          ordered: true,
          items: [
            "What are we working on? — draw the data flow, mark the trust boundaries.",
            "What can go wrong? — walk each element with STRIDE: Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege.",
            "What are we going to do about it? — a control, a test, or an explicit accepted risk for each threat.",
            "Did we do a good job? — re-check after the system changes; the model is a living document.",
          ],
        },
        { kind: "video", id: "nd02oPnMdR4", title: "Threat Modeling Lessons from Star Wars", by: "Adam Shostack · IT-SECX 2019 keynote", note: "The author of the four-question framework, on why every team can threat-model — and how the Death Star's designers didn't." },
        {
          kind: "resources",
          items: [
            { title: "OWASP API Security Top 10 — 2023", by: "OWASP Foundation", url: "https://owasp.org/API-Security/editions/2023/en/0x11-t10/", kind: "standard", note: "The ten most critical API risks with attack scenarios and prevention." },
            { title: "Threat Modeling Cheat Sheet", by: "OWASP Cheat Sheet Series", url: "https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html", kind: "doc", note: "A compact, practical method you can run in a one-hour meeting." },
            { title: "The Four Question Framework", by: "Adam Shostack", url: "https://github.com/adamshostack/4QuestionFrame", kind: "doc", note: "The framework itself, openly licensed." },
            { title: "Secure Software Development Framework (SP 800-218)", by: "NIST", url: "https://csrc.nist.gov/pubs/sp/800/218/final", kind: "standard", note: "The practices US federal suppliers attest to — a good backbone for any team." },
            { title: "Software Bill of Materials", by: "CISA", url: "https://www.cisa.gov/sbom", kind: "standard", note: "What an SBOM is, the minimum elements, and why it matters for dependency risk." },
          ],
        },
      ],
    },
    {
      id: "stride-walkthrough",
      access: "member",
      title: "Walkthrough: STRIDE on a real endpoint",
      teaser: "A worked threat model of GET /notes/:id, the two-account BOLA test, and how SQL injection fits the same picture.",
      blocks: [
        { kind: "p", text: "Take one endpoint, GET /notes/:id, behind a session cookie, backed by PostgreSQL. Walk STRIDE across each element of the flow and write down one concrete threat and one control per letter." },
        {
          kind: "table",
          head: ["STRIDE", "Threat on GET /notes/:id", "Control", "Test"],
          rows: [
            ["Spoofing", "Stolen session cookie reused from another device", "HttpOnly + Secure + SameSite cookies, short session TTL", "Replay a captured cookie after logout → expect 401"],
            ["Tampering", "Client edits the id in the URL", "Never trust the id: load by (id, owner_id)", "User B requests A's note id → expect 404"],
            ["Repudiation", "User denies deleting a shared note", "Append-only audit log with actor and object id", "Delete, then query the audit log"],
            ["Information disclosure", "Error leaks SQL or stack trace", "Generic error body, details only in logs", "Send a malformed id → no stack trace"],
            ["Denial of service", "Unbounded list endpoint", "Pagination limits and rate limiting", "Request limit=100000 → capped"],
            ["Elevation of privilege", "User calls DELETE /admin/notes", "Role check in the handler, deny by default", "Member token on admin route → expect 403"],
          ],
        },
        { kind: "h", text: "The two-account test that finds BOLA" },
        {
          kind: "list",
          ordered: true,
          items: [
            "Create two ordinary accounts, A and B.",
            "As A, create an object and note its id.",
            "As B, call every endpoint that takes an id — GET, PUT, PATCH, DELETE — with A's id.",
            "Anything other than 403 or 404 is a finding. Repeat for every object type and every role.",
          ],
        },
        { kind: "callout", tone: "info", text: "Return 404 rather than 403 for objects the caller doesn't own, so an attacker can't even learn that the id exists." },
        { kind: "video", id: "ZtSrcq7gscE", title: "Threat Modeling Made Interactive", by: "OWASP AppSecUSA 2014", note: "How to run a threat-modeling session with a team instead of a document nobody reads." },
        { kind: "video", id: "ciNHn38EyRc", title: "Running an SQL Injection Attack", by: "Computerphile", note: "Tampering in its classic form — and why parameterised queries are the control." },
      ],
    },
    {
      id: "lab",
      access: "platinum",
      title: "Lab: an authorization test harness and a pipeline gate",
      teaser: "Copy-ready test harness for BOLA/BFLA across every route, plus a CI workflow that blocks releases with critical vulnerable dependencies.",
      blocks: [
        { kind: "p", text: "The goal of this lab is to make authorization bugs impossible to merge. You will write one test that walks every route with two users and two roles, then add SBOM generation and a vulnerability gate to CI." },
        { kind: "h", text: "1 · Describe your routes once" },
        {
          kind: "code",
          lang: "ts",
          title: "tests/routes.ts",
          text: `// Every route that touches an object, with the role it needs. New routes must be added here — a test fails if one is missing.
export const ROUTES = [
  { method: "GET", path: "/api/notes/:id", role: "member" },
  { method: "PATCH", path: "/api/notes/:id", role: "member" },
  { method: "DELETE", path: "/api/notes/:id", role: "member" },
  { method: "GET", path: "/api/admin/notes", role: "admin" },
] as const;`,
        },
        { kind: "h", text: "2 · Walk them with two users" },
        {
          kind: "code",
          lang: "ts",
          title: "tests/authz.test.ts",
          text: `import { describe, expect, it } from "vitest";
import { ROUTES } from "./routes";
import { as, createNote } from "./helpers"; // as(user) returns a fetch bound to that user's session

describe("object-level authorization (BOLA)", () => {
  for (const route of ROUTES.filter((r) => r.path.includes(":id"))) {
    it(\`\${route.method} \${route.path} refuses another member's object\`, async () => {
      const note = await createNote(as("alice"));
      const res = await as("bob")(route.path.replace(":id", note.id), { method: route.method });
      expect([403, 404]).toContain(res.status);
    });
  }
});

describe("function-level authorization (BFLA)", () => {
  for (const route of ROUTES.filter((r) => r.role === "admin")) {
    it(\`\${route.method} \${route.path} refuses a member\`, async () => {
      const res = await as("bob")(route.path, { method: route.method });
      expect(res.status).toBe(403);
    });
  }
});`,
        },
        { kind: "h", text: "3 · Gate the pipeline on dependencies" },
        {
          kind: "code",
          lang: "yaml",
          title: ".github/workflows/supply-chain.yml",
          text: `name: supply-chain
on: [pull_request]
jobs:
  sbom-and-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Generate SBOM (CycloneDX)
        uses: anchore/sbom-action@v0
        with:
          format: cyclonedx-json
          output-file: sbom.cdx.json
      - name: Fail on critical vulnerabilities
        uses: anchore/scan-action@v6
        with:
          sbom: sbom.cdx.json
          fail-build: true
          severity-cutoff: critical
      - uses: actions/upload-artifact@v4
        with:
          name: sbom
          path: sbom.cdx.json`,
        },
        { kind: "h", text: "Release checklist (mapped to NIST SSDF)" },
        {
          kind: "list",
          items: [
            "PW.1 — Threat model updated for every new trust boundary in this release.",
            "PW.7 — Authorization tests cover every route in routes.ts; the coverage test passes.",
            "PW.4 — SBOM generated and archived with the release artifact.",
            "RV.1 — No unresolved critical findings from the dependency gate; exceptions have an owner and a date.",
            "PO.5 — Secrets come from the platform's secret store, never from the repository.",
          ],
        },
      ],
    },
  ],
};
