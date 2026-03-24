'use client';

import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Sign In</CardTitle>
          <CardDescription>Continue your media tracking journey</CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={() => signIn('google', { callbackUrl: '/' })}
            className="w-full"
          >
            Continue with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
