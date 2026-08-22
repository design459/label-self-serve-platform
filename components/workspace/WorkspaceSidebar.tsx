const STEPS = ["Photo & palette", "Marketing copy", "Regulatory details", "Generate & preview", "Submit"];

// Same presentational shape as components/admin/AppSidebar.tsx
// ({activeIndex, footer}), just with customer-facing step labels — driven
// by an IntersectionObserver scroll-spy in WorkspaceApp.tsx, same pattern
// NewOrderForm.tsx already proved for a long single-page form.
export default function WorkspaceSidebar({ activeIndex, footer }: { activeIndex: number; footer: string }) {
  return (
    <aside className="wizard-sidebar">
      <p className="wizard-brand">Your label</p>
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
