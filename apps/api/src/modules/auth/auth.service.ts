import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import type { LoginInput, RegisterTeacherInput } from './auth.schema.js';

type JwtPayload = {
  sub: string;
  role: 'teacher' | 'staff' | 'parent';
};

function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as StringValue,
  });
}

function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as StringValue,
  });
}

export async function registerTeacher(input: RegisterTeacherInput) {
  const existing = await prisma.teacher.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new Error('Email already registered');
  }

  const hashedPassword = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);

  const teacher = await prisma.teacher.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone,
      password_hash: hashedPassword,
      institute_name: input.instituteName,
      city: input.city,
      subjects_taught: input.subjectsTaught,
      timezone: 'Asia/Kolkata',
      subscription_plan: 'free',
    },
  });

  const payload: JwtPayload = { sub: teacher.id, role: 'teacher' };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  return {
    teacher: {
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      instituteName: teacher.institute_name,
      subscriptionPlan: teacher.subscription_plan,
    },
    accessToken,
    refreshToken,
  };
}

export async function loginTeacher(input: LoginInput) {
  const teacher = await prisma.teacher.findUnique({ where: { email: input.email } });
  if (!teacher) {
    throw new Error('Invalid credentials');
  }

  const passwordMatches = await bcrypt.compare(input.password, teacher.password_hash);
  if (!passwordMatches) {
    throw new Error('Invalid credentials');
  }

  const payload: JwtPayload = { sub: teacher.id, role: 'teacher' };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  return {
    teacher: {
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      instituteName: teacher.institute_name,
      subscriptionPlan: teacher.subscription_plan,
    },
    accessToken,
    refreshToken,
  };
}

export function refreshAccessToken(refreshToken: string) {
  try {
    const payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as JwtPayload;
    const accessToken = signAccessToken({ sub: payload.sub, role: payload.role });
    return { accessToken };
  } catch {
    throw new Error('Invalid refresh token');
  }
}
