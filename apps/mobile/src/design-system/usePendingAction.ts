export function usePendingAction(action: () => Promise<void>) {
  let pending = false;

  return {
    async run(): Promise<boolean> {
      if (pending) return false;
      pending = true;
      try {
        await action();
        return true;
      } finally {
        pending = false;
      }
    },
    isPending() {
      return pending;
    }
  };
}
