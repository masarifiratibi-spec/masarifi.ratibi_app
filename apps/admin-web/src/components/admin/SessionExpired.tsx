import { ClockAlert } from "lucide-react";
import { isSessionExpired } from "@/core/auth/session";

export function isExpired(expiresAt: string, now = new Date()): boolean {
  return isSessionExpired(expiresAt, now);
}

export function SessionExpired({
  temporary = false,
  unsavedChanges = false,
  onReturn,
}: {
  temporary?: boolean;
  unsavedChanges?: boolean;
  onReturn: () => void;
}) {
  return (
    <section className="state-box error" role="alert">
      <ClockAlert size={30} />
      <strong>{temporary ? "انتهت صلاحية الوصول المؤقت" : "انتهت الجلسة"}</strong>
      {unsavedChanges && <p>توجد تغييرات غير محفوظة ولن تُرسل بعد انتهاء الجلسة.</p>}
      <button className="button primary" onClick={onReturn}>العودة الآمنة</button>
    </section>
  );
}
