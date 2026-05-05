type Props = {
  message: string;
  availableIn?: string;
};

export default function PhasePlaceholder({ message, availableIn = "Próximamente" }: Props) {
  return (
    <div className="phase-placeholder" aria-label={availableIn}>
      <span className="phase-placeholder__badge">{availableIn}</span>
      <p className="phase-placeholder__message">{message}</p>
    </div>
  );
}
