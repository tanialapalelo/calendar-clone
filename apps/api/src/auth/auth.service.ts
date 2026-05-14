import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';

type GoogleProfile = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
};

@Injectable()
export class AuthService {
  private oauth = new OAuth2Client({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
  });

  constructor(private readonly prisma: PrismaService) {}

  /** Build the consent URL with a server-issued `state` for CSRF protection. */
  getGoogleAuthUrl(state: string): string {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REDIRECT_URI) {
      throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_REDIRECT_URI');
    }
    return this.oauth.generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'email', 'profile'],
      prompt: 'consent',
      state, // ← the controller passes the random state here
    });
  }

  async handleGoogleCallback(code: string) {
    const { tokens } = await this.oauth.getToken(code);
    if (!tokens.id_token)
      throw new UnauthorizedException('Missing id_token from Google');

    const ticket = await this.oauth.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload() as GoogleProfile | undefined;
    if (!payload?.sub)
      throw new UnauthorizedException('Invalid Google token payload');

    const googleSub = payload.sub;
    const name = payload.name ?? null;

    // Only trust the email if Google says it's verified.
    // Otherwise we keep the user but never expose a real email we can't trust.
    const verifiedEmail =
      payload.email && payload.email_verified === true ? payload.email : null;

    const user = await this.prisma.user.upsert({
      where: { googleSub },
      create: {
        googleSub,
        email: verifiedEmail ?? `google-${googleSub}@no-email.local`,
        name,
      },
      update: {
        ...(verifiedEmail ? { email: verifiedEmail } : {}),
        ...(name ? { name } : {}),
      },
    });

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) throw new Error('Missing JWT_SECRET');

    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name ?? undefined,
        googleSub,
      },
      jwtSecret,
      { expiresIn: '7d' },
    );

    return { user, jwt: token };
  }
}
