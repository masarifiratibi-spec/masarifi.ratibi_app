export function useAuth(): never {
  throw new Error("Clerk identity is outside the recovery browser fixture");
}
export function useClerk(): never {
  throw new Error("Clerk identity is outside the recovery browser fixture");
}
export function ClerkProvider({ children }: { children: React.ReactNode }) {
  return children;
}
