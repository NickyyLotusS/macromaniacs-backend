export type AuthenticatedUser = {
  userId: string;
  roles?: readonly string[];
};

export type JwtPayload = {
  sub: string;
  roles?: unknown;
};
