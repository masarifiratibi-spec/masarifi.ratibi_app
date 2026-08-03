"use client";

import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { ApiError, safeApiMessage } from "@/core/api/errors";

const pendingKeys = new Set<string>();

export async function runLocked<T>(key: string, operation: () => Promise<T>): Promise<T> {
  if (pendingKeys.has(key)) {
    throw new ApiError("conflict", safeApiMessage("conflict"), 409);
  }
  pendingKeys.add(key);
  try {
    return await operation();
  } finally {
    pendingKeys.delete(key);
  }
}

export function useLockedMutation<TData, TVariables>({
  lockKey,
  mutationFn,
  onSuccess,
}: {
  lockKey: (variables: TVariables) => string;
  mutationFn: (variables: TVariables) => Promise<TData>;
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
}): UseMutationResult<TData, Error, TVariables> {
  return useMutation({
    mutationFn: (variables) => runLocked(lockKey(variables), () => mutationFn(variables)),
    onSuccess,
  });
}
