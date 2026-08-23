import { ShieldCheck } from "lucide-react";

// Small CSS-built mockups instead of screenshots or stock imagery — they
// stay accurate as the real editor/proof evolve, and (unlike a generic
// AI-generated graphic) they actually look like this product, not a
// plausible-looking stand-in for it.

function EditorMockup() {
  return (
    <div className="feature-mockup feature-mockup-editor">
      <div className="fm-editor-rail">
        <span />
        <span className="active" />
        <span />
        <span />
      </div>
      <div className="fm-editor-canvas">
        <div className="fm-editor-toolbar" />
        <div className="fm-editor-body">
          <div className="fm-editor-photo" />
          <div className="fm-editor-lines">
            <div className="fm-editor-line" style={{ width: "78%" }} />
            <div className="fm-editor-line" style={{ width: "52%" }} />
            <div className="fm-editor-badges">
              <span />
              <span />
              <span />
            </div>
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
    icon: true,
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
          <div className="feature-row-visual">
            {f.mockup ?? (
              <div className="feature-mockup feature-mockup-icon">
                <ShieldCheck size={64} strokeWidth={1.5} />
              </div>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
