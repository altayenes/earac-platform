import { UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string; // User ID
  phone: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}
