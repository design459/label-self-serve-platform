import { Check, ShieldCheck, CheckCircle2 } from "lucide-react";

// Small CSS-built mockups instead of screenshots or stock imagery — they
// stay accurate as the real editor/proof evolve, and (unlike a generic
// AI-generated graphic) they actually look like this product, not a
// plausible-looking stand-in for it. The checklist labels below are the
// real fields on every order (see RegulatoryContent in lib/types.ts), not
// invented ones.

const CHECK_FIELDS = ["Ingredients", "Claims", "Batch code", "Statutory marks"];

function EditorMockup() {
  return (
    <div className="feature-mockup feature-mockup-editor-pro">
      <div className="fm-pro-topbar">
        <span className="fm-pro-dot" />
        <span className="fm-pro-dot" />
        <span className="fm-pro-dot" />
        <span className="fm-pro-title">Label editor</span>
        <span className="fm-pro-export">Export</span>
      </div>
      <div className="fm-pro-body">
        <div className="fm-pro-rail">
          <span className="active" />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="fm-pro-canvas">
          <div className="fm-pro-label">
            <div className="fm-pro-photo" />
            <div className="fm-pro-lines">
              <div className="fm-pro-line fm-pro-line-lg" style={{ width: "72%" }} />
              <div className="fm-pro-line" style={{ width: "48%" }} />
              <div className="fm-pro-badges">
                <span />
                <span />
                <span />
              </div>
            </div>
            <div className="fm-pro-panel">
              <div className="fm-pro-panel-title" />
              <div className="fm-pro-panel-row" />
              <div className="fm-pro-panel-row" />
              <div className="fm-pro-panel-row" />
              <div className="fm-pro-panel-row" style={{ width: "70%" }} />
            </div>
          </div>
        </div>
        <div className="fm-pro-checklist">
          {CHECK_FIELDS.map((label) => (
            <div className="fm-pro-check-row" key={label}>
              <Check size={10} strokeWidth={3} />
              <span>{label}</span>
            </div>
          ))}
          <div className="fm-pro-compliant">
            <ShieldCheck size={12} />
            Compliant
          </div>
        </div>
      </div>
    </div>
  );
}

function ProofMockup() {
  return (
    <div className="feature-mockup feature-mockup-proof">
      <div className="fm-proof-ribbon">Proof</div>
      <div className="fm-proof-line" style={{ width: "70%" }} />
      <div className="fm-proof-line" style={{ width: "45%" }} />
      <div className="fm-proof-badges">
        <span />
        <span />
        <span />
      </div>
      <div className="fm-proof-panel">
        <div className="fm-proof-line" style={{ width: "80%" }} />
        <div className="fm-proof-line" style={{ width: "60%" }} />
      </div>
    </div>
  );
}

function ComplianceMockup() {
  const rows = [
    { label: "Ingredients", note: "from product data" },
    { label: "Claims", note: "from product data" },
    { label: "Batch code & dates", note: "entered by you" },
    { label: "Statutory marks", note: "from product data" },
  ];
  return (
    <div className="feature-mockup feature-mockup-compliance">
      {rows.map((r) => (
        <div className="fm-compliance-row" key={r.label}>
          <CheckCircle2 size={16} />
          <div>
            <strong>{r.label}</strong>
            <span>{r.note}</span>
          </div>
        </div>
      ))}
      <div className="fm-compliance-footer">
        <ShieldCheck size={16} />
        Signed off by a compliance reviewer
      </div>
    </div>
  );
}

const FEATURES = [
  {
    eyebrow: "The design canvas",
    title: "Every element, exactly where you put it",
    body: "Drag, resize, and restyle your photo, brand name, tagline, icons, and the regulatory panel itself — pick a background color or gradient, add a second page for the back of the label, all on one freeform canvas.",
    mockup: <EditorMockup />,
    reverse: false,
  },
  {
    eyebrow: "Compliance, by construction",
    title: "Nothing on the label gets invented",
    body: "Ingredients, claims, and dosage text come straight from verified product data, not a guess. Every submission goes through a real compliance reviewer before it's ever marked print-ready.",
    mockup: <ComplianceMockup />,
    reverse: true,
  },
  {
    eyebrow: "Free live preview",
    title: "Check your design as often as you like",
    body: "Your saved edits are always one click away to review, for free. When it's ready, generate the official proof and submit it — no surprises about what staff actually see.",
    mockup: <ProofMockup />,
    reverse: false,
  },
];

export default function FeatureHighlights() {
  return (
    <section className="landing-section">
      {FEATURES.map((f) => (
        <div className={`feature-row ${f.reverse ? "feature-row-reverse" : ""}`} key={f.title}>
          <div className="feature-row-copy">
            <p className="feature-eyebrow">{f.eyebrow}</p>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </div>
          <div className="feature-row-visual">{f.mockup}</div>
        </div>
      ))}
    </section>
  );
}
