import { z } from 'zod';

const supportedCountryCodes = ['+20', '+966', '+971'] as const;
const phoneSchema = z.object({
  countryCode: z.enum(supportedCountryCodes),
  phoneValue: z.string().regex(/^\d{7,14}$/)
});

export interface PhoneInput {
  countryCode: string;
  phoneValue: string;
}

export type PhoneValidationResult =
  | { success: true; data: PhoneInput }
  | { success: false; errorCode: 'appShell.auth.phone.invalid' };

export function validatePhoneInput(input: PhoneInput): PhoneValidationResult {
  const normalized = {
    countryCode: input.countryCode.trim(),
    phoneValue: input.phoneValue.replace(/[\s\-\u200e\u200f]/g, '')
  };
  const parsed = phoneSchema.safeParse(normalized);
  return parsed.success
    ? { success: true, data: parsed.data }
    : { success: false, errorCode: 'appShell.auth.phone.invalid' };
}
