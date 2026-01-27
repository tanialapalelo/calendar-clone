import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';

type GoogleProfile = {
  sub: string;
  email?: string;
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

  getGoogleAuthUrl() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_REDIRECT_URI');
    }

    return this.oauth.generateAuthUrl({
      access_type: 'offline',
      scope: ['openid', 'email', 'profile'],
      prompt: 'consent',
    });
  }

  async handleGoogleCallback(code: string) {
    const { tokens } = await this.oauth.getToken(code);
    if (!tokens.id_token) throw new Error('Missing id_token from Google');

    const ticket = await this.oauth.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload() as GoogleProfile | undefined;
    if (!payload?.sub) throw new Error('Invalid Google token payload');

    const googleSub = payload.sub;
    const email = payload.email ?? null;
    const name = payload.name ?? null;

    const user = await this.prisma.user.upsert({
      where: { googleSub },
      create: {
        googleSub,
        email: email ?? `google-${googleSub}@no-email.local`,
        name,
      },
      update: {
        email: email ?? undefined,
        name: name ?? undefined,
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
