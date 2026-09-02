export function SectionHeading({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <header className="section-heading">
      <h2>{title}</h2>
      {hint ? <p>{hint}</p> : null}
    </header>
  );
}

export function DemoLabel({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="demo-label">
      <h3>{title}</h3>
      {hint ? <p>{hint}</p> : null}
    </div>
  );
}
