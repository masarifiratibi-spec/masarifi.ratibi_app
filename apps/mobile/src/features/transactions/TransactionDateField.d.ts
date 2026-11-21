export interface TransactionDateFieldProps {
  value: number;
  disabled?: boolean;
  label?: string;
  maximumDate?: Date;
  onChange: (value: number) => void;
}

export function TransactionDateField(
  props: TransactionDateFieldProps
): JSX.Element;
