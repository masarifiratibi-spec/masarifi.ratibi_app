export function MaskedField({
  label,
  maskedValue,
}: {
  label: string;
  maskedValue: string;
}) {
  return (
    <span className="masked-field">
      <span className="sr-only">{label}: </span>
      <bdi>{maskedValue}</bdi>
    </span>
  );
}
