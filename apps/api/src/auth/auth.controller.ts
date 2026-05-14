import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtCookieGuard } from './jwt-cookie.guard';
import type { AuthUser } from './auth.types';

const STATE_COOKIE = 'oauth_state';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('google/start')
  googleStart(@Res() res: Response) {
    // Cryptographically random, URL-safe state
    const state = randomBytes(32).toString('base64url');

    // Persist it in an httpOnly cookie scoped tightly to the callback path
    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/v1/auth/google/callback',
      maxAge: STATE_TTL_MS,
    });

    const url = this.auth.getGoogleAuthUrl(state);
    return res.redirect(url);
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request & { cookies?: Record<string, string> },
    @Res() res: Response,
  ) {
    if (!code) throw new BadRequestException('Missing code');
    if (!state) throw new UnauthorizedException('Missing state');

    const expected = req.cookies?.[STATE_COOKIE];
    // Constant-time-ish compare: both are base64url strings of equal expected length
    if (!expected || expected.length !== state.length || expected !== state) {
      throw new UnauthorizedException('Invalid state');
    }

    // One-shot: clear the state cookie so it can't be replayed
    res.clearCookie(STATE_COOKIE, { path: '/v1/auth/google/callback' });

    const { jwt } = await this.auth.handleGoogleCallback(code);

    const cookieName = process.env.COOKIE_NAME ?? 'access_token';
    res.cookie(cookieName, jwt, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
    });

    const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
    return res.redirect(webOrigin);
  }

  @Post('logout')
  logout(@Res() res: Response) {
    const cookieName = process.env.COOKIE_NAME ?? 'access_token';
    res.clearCookie(cookieName, { path: '/' });
    return res.json({ ok: true });
  }

  @Get('me')
  @UseGuards(JwtCookieGuard)
  me(@Req() req: Request & { user?: AuthUser }) {
    return { ok: true, user: req.user };
  }
}
