import React from 'react';

import { AuthMethodChooser } from '@/features/auth/AuthMethodChooser';

export default function SignUpRoute() {
  return <AuthMethodChooser titleKey="appShell.auth.signUp.title" />;
}
