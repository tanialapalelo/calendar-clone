import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import type { AuthUser } from './auth.types';

@Injectable()
export class JwtCookieGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();

    const cookieName = process.env.COOKIE_NAME ?? 'access_token';
    const token = (req as any).cookies?.[cookieName] as string | undefined;

    if (!token) throw new UnauthorizedException('Missing auth cookie');

    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('Missing JWT_SECRET');

    try {
      const payload = jwt.verify(token, secret) as AuthUser;

      if (!payload?.sub)
        throw new UnauthorizedException('Invalid token payload');

      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
