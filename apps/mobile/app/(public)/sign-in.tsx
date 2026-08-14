import React from 'react';

import { AuthMethodChooser } from '@/features/auth/AuthMethodChooser';

export default function SignInRoute() {
  return <AuthMethodChooser titleKey="appShell.auth.signIn.title" />;
}
