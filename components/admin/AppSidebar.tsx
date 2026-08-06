const STEPS = [
  "Customer info",
  "Product details",
  "Pack format",
  "Regulatory content",
  "Review & submit",
];

export default function AppSidebar({ activeIndex, footer }: { activeIndex: number; footer: string }) {
  return (
    <aside className="wizard-sidebar">
      <p className="wizard-brand">Label platform</p>
      <ol className="wizard-steps">
        {STEPS.map((label, i) => (
          <li key={label} className={`wizard-step ${i === activeIndex ? "active" : ""} ${i < activeIndex ? "done" : ""}`}>
            <span className="wizard-step-circle">{i < activeIndex ? "✓" : i + 1}</span>
            <span className="wizard-step-label">{label}</span>
          </li>
        ))}
      </ol>
      <div className="wizard-sidebar-decor" aria-hidden="true" />
      <p className="wizard-step-count">{footer}</p>
    </aside>
  );
}
