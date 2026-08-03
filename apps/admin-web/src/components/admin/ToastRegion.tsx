export interface ToastMessage {
  id: string;
  message: string;
  tone?: "success" | "warning" | "error";
}

export function ToastRegion({ messages }: { messages: ToastMessage[] }) {
  return (
    <div className="toast-region" aria-live="polite" aria-atomic="false">
      {messages.map((message) => (
        <div className={`toast toast-${message.tone ?? "success"}`} key={message.id} role="status">
          {message.message}
        </div>
      ))}
    </div>
  );
}
