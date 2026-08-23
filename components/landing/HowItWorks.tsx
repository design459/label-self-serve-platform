import { Package, ImagePlus, PenLine, ShieldCheck, LayoutTemplate, Send } from "lucide-react";

const STEPS = [
  { icon: Package, title: "Pick your product", body: "Choose a product we already know, or start from the closest category." },
  { icon: ImagePlus, title: "Upload your logo", body: "Drop in your brand mark — you can swap it any time before you submit." },
  { icon: PenLine, title: "Add your marketing copy", body: "Your brand name and a short tagline, freely editable." },
  { icon: ShieldCheck, title: "Confirm regulatory details", body: "Real ingredients, claims and dosage text — never invented for you." },
  { icon: LayoutTemplate, title: "Design your label", body: "Drag, resize, and restyle anything, front and back, on one canvas." },
  { icon: Send, title: "Submit for review", body: "A compliance reviewer signs off before anything is print-ready." },
];

export default function HowItWorks() {
  return (
    <section className="landing-section">
      <h2 className="landing-section-title">How it works</h2>
      <p className="field-hint" style={{ marginBottom: 28 }}>
        Six steps from a blank label to a print-ready, compliance-checked file.
      </p>
      <div className="how-it-works-grid">
        {STEPS.map((step, i) => (
          <div className="how-it-works-card" key={step.title}>
            <span className="how-it-works-number">{i + 1}</span>
            <step.icon size={22} className="how-it-works-icon" />
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
