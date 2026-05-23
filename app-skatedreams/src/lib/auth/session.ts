import { getIronSession, IronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { env } from "@/env";

export type SessionData = {
  userId?: string;
  email?: string;
  role?: "admin" | "professor";
};

const options: SessionOptions = {
  password: env.SESSION_SECRET,
  cookieName: "skatedreams_session",
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), options);
}
