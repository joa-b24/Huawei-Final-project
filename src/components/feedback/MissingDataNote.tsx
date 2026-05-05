type Props = { count: number; total: number };

export default function MissingDataNote({ count, total }: Props) {
  if (count === 0) return null;
  return (
    <p className="missing-data-note" role="note">
      {count} de {total} estados sin dato para esta variable.
    </p>
  );
}
