import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Protects the destructive/administrative routes.
 *
 * The frontend inlines the API base URL into its client bundle, so this
 * hostname is public. Every write route was previously reachable by anyone who
 * read the page source, including `products/bulk-delete`, which empties the
 * catalogue when called with `{}`.
 *
 * This guard FAILS CLOSED: with no ADMIN_API_KEY configured the protected
 * routes are refused outright rather than left open. Nothing the website reads
 * goes through here, so an unset key never affects visitors - only admin
 * operations, which is the safe direction to fail in.
 *
 * To enable: set ADMIN_API_KEY on the Container App, then send it as
 * `x-admin-key: <value>` (or `Authorization: Bearer <value>`).
 */
@Injectable()
export class AdminKeyGuard implements CanActivate {
  private readonly logger = new Logger(AdminKeyGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const configured = (this.configService.get<string>('ADMIN_API_KEY') || '').trim();

    if (!configured) {
      this.logger.error(
        `ADMIN_API_KEY is not set - refusing ${req.method} ${req.originalUrl}. ` +
          `Set it on the Container App to enable administrative routes.`,
      );
      throw new ServiceUnavailableException(
        'Administrative routes are disabled because no admin key is configured.',
      );
    }

    const headerKey = (req.headers['x-admin-key'] as string | undefined)?.trim();
    const auth = (req.headers['authorization'] as string | undefined)?.trim();
    const bearer = auth?.toLowerCase().startsWith('bearer ')
      ? auth.slice(7).trim()
      : undefined;
    const provided = headerKey || bearer;

    if (!provided || !timingSafeEqual(provided, configured)) {
      this.logger.warn(`Rejected ${req.method} ${req.originalUrl} - bad or missing admin key.`);
      throw new UnauthorizedException('A valid admin key is required for this route.');
    }

    return true;
  }
}

/** Length-independent comparison, so the check does not leak the key by timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
