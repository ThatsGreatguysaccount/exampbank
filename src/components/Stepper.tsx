const STEPS = ["Register", "Documents", "Review", "Start banking"];

export function Stepper({ current }: { current: number }) {
  return (
    <div className="stepper">
      {STEPS.map((label, i) => (
        <div key={label} className={`step ${i < current ? "done" : i === current ? "current" : ""}`}>
          <div className="step-bar" />
          {i < current ? <i className="fas fa-check" /> : null} {label}
        </div>
      ))}
    </div>
  );
}
