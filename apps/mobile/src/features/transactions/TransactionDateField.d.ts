export interface TransactionDateFieldProps {
  value: number;
  disabled?: boolean;
  label?: string;
  onChange: (value: number) => void;
}

export function TransactionDateField(props: TransactionDateFieldProps): JSX.Element;
