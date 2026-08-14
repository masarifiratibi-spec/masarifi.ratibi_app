import { useLocalSearchParams } from 'expo-router';
import { SalaryReceiptReview } from '@/features/salary/SalaryReceiptReview';

export default function SalaryReceiptRoute() {
  const { receiptId } = useLocalSearchParams<{ receiptId: string }>();
  return <SalaryReceiptReview receiptId={receiptId} />;
}
