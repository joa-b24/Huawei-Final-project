type DashboardHeaderProps = {
  title: string;
  subtitle: string;
};

export default function DashboardHeader({ title, subtitle }: DashboardHeaderProps) {
  return (
    <header className="hero">
      <div>
        <p className="eyebrow">Proyecto Huawei</p>
        <h1>{title}</h1>
        <p className="hero-copy">{subtitle}</p>
      </div>
    </header>
  );
}
