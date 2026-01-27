export type AuthUser = {
  sub: string; // User.id
  email: string;
  name?: string;
  googleSub?: string;
};
