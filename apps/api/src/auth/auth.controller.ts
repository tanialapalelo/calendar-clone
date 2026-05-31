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

// Helper to build cookie options centralised so production flags (secure, domain, sameSite)
function buildCookieOptions(overrides: Partial<CookieOptions> = {}) {
  const secure = process.env.NODE_ENV === 'production';
  const sameSiteEnv = (process.env.COOKIE_SAME_SITE ?? 'lax').toLowerCase();
  // Accept 'lax', 'strict', or 'none'
  const sameSite: 'lax' | 'strict' | 'none' =
    sameSiteEnv === 'strict'
      ? 'strict'
      : sameSiteEnv === 'none'
        ? 'none'
        : 'lax';

  const base: CookieOptions = {
    httpOnly: true,
    sameSite,
    secure,
    path: '/',
  };

  // Apply overrides (e.g., different path or maxAge)
  return Object.assign(base, overrides);
}

interface CookieOptions {
  httpOnly?: boolean;
  sameSite?: 'lax' | 'strict' | 'none';
  secure?: boolean;
  path?: string;
  maxAge?: number;
  domain?: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('google/start')
  googleStart(@Res() res: Response) {
    // Cryptographically random, URL-safe state
    const state = randomBytes(32).toString('base64url');

    // Persist it in an httpOnly cookie scoped tightly to the callback path
    res.cookie(
      STATE_COOKIE,
      state,
      buildCookieOptions({
        path: '/v1/auth/google/callback',
        maxAge: STATE_TTL_MS,
      }),
    );

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
    res.clearCookie(
      STATE_COOKIE,
      buildCookieOptions({ path: '/v1/auth/google/callback' }),
    );

    const { jwt } = await this.auth.handleGoogleCallback(code);

    const cookieName = process.env.COOKIE_NAME ?? 'access_token';
    res.cookie(
      cookieName,
      jwt,
      buildCookieOptions({ path: '/', maxAge: 1000 * 60 * 60 * 24 * 7 }),
    );

    const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
    return res.redirect(webOrigin);
  }

  @Post('logout')
  logout(@Res() res: Response) {
    const cookieName = process.env.COOKIE_NAME ?? 'access_token';
    res.clearCookie(cookieName, buildCookieOptions({ path: '/' }));
    return res.json({ ok: true });
  }

  @Get('me')
  @UseGuards(JwtCookieGuard)
  me(@Req() req: Request & { user?: AuthUser }) {
    return { ok: true, user: req.user };
  }

  @Get('demo')
  async demoLogin(@Res() res: Response) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).send('Not found');
    }

    const { jwt } = await this.auth.createDemoToken();
    const cookieName = process.env.COOKIE_NAME ?? 'access_token';
    res.cookie(
      cookieName,
      jwt,
      buildCookieOptions({ path: '/', maxAge: 1000 * 60 * 60 * 24 * 7 }),
    );

    const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
    return res.redirect(webOrigin);
  }
}
