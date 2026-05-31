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
      sameSite: (process.env.COOKIE_SAME_SITE ?? 'lax') as
        | 'lax'
        | 'strict'
        | 'none',
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
    @Req() req: Request & { cookies: Record<string, string> },
    @Res() res: Response,
  ) {
    if (!code) throw new BadRequestException('Missing code');
    if (!state) throw new UnauthorizedException('Missing state');

    const expected =
      typeof req.cookies?.[STATE_COOKIE] === 'string'
        ? req.cookies[STATE_COOKIE]
        : undefined;

    // Constant-time-ish compare: both are base64url strings of equal expected length
    if (!expected || expected.length !== state.length || expected !== state) {
      throw new UnauthorizedException('Invalid state');
    }

    // One-shot: clear the state cookie so it can't be replayed
    res.clearCookie(STATE_COOKIE, {
      httpOnly: true,
      sameSite: (process.env.COOKIE_SAME_SITE ?? 'lax') as
        | 'lax'
        | 'strict'
        | 'none',
      secure: process.env.NODE_ENV === 'production',
      path: '/v1/auth/google/callback',
    });

    const { jwt } = await this.auth.handleGoogleCallback(code);

    const cookieName = process.env.COOKIE_NAME ?? 'access_token';
    res.cookie(cookieName, jwt, {
      httpOnly: true,
      sameSite: (process.env.COOKIE_SAME_SITE ?? 'lax') as
        | 'lax'
        | 'strict'
        | 'none',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
    return res.redirect(webOrigin);
  }

  @Post('logout')
  logout(@Res() res: Response) {
    const cookieName = process.env.COOKIE_NAME ?? 'access_token';
    res.clearCookie(cookieName, {
      httpOnly: true,
      sameSite: (process.env.COOKIE_SAME_SITE ?? 'lax') as
        | 'lax'
        | 'strict'
        | 'none',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });
    return res.json({ ok: true });
  }

  @Get('me')
  @UseGuards(JwtCookieGuard)
  me(@Req() req: Request & { user?: AuthUser }) {
    return { ok: true, user: req.user };
  }

  @Get('demo')
  async demoLogin(@Res() res: Response) {
    // By default the demo endpoint is disabled in production builds for safety.
    // To explicitly enable demo on a deployed environment set ALLOW_DEMO=true (or 1).
    const allowDemo =
      (process.env.ALLOW_DEMO ?? '').toLowerCase() === 'true' ||
      process.env.ALLOW_DEMO === '1';

    if (process.env.NODE_ENV === 'production' && !allowDemo) {
      return res.status(404).send('Not found');
    }

    const { jwt } = await this.auth.createDemoToken();
    const cookieName = process.env.COOKIE_NAME ?? 'access_token';
    // Prevent caching of the demo redirect/response to avoid 304 from caches/proxies
    res.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    );
    res.setHeader('Pragma', 'no-cache');

    res.cookie(cookieName, jwt, {
      httpOnly: true,
      sameSite: (process.env.COOKIE_SAME_SITE ?? 'lax') as
        | 'lax'
        | 'strict'
        | 'none',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
    return res.redirect(webOrigin);
  }
}
