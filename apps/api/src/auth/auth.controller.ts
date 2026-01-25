import {
  Controller,
  Get,
  Post,
  Query,
  Res,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Request, Response } from 'express';
import { JwtCookieGuard } from './jwt-cookie.guard';
import type { AuthUser } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('google/start')
  googleStart(@Res() res: Response) {
    const url = this.auth.getGoogleAuthUrl();
    return res.redirect(url);
  }

  @Get('google/callback')
  async googleCallback(@Query('code') code: string, @Res() res: Response) {
    if (!code) return res.status(400).send('Missing code');

    const { jwt } = await this.auth.handleGoogleCallback(code);

    const cookieName = process.env.COOKIE_NAME ?? 'access_token';

    res.cookie(cookieName, jwt, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // localhost over http; set true in prod (https)
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
