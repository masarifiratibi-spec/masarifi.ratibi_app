export function returnToAdminSignIn(): void {
  // Full navigation discards the App Router cache; Clerk protects this destination.
  window.location.replace("/admin");
}
