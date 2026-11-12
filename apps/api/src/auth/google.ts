import { decodeIdToken, Google } from 'arctic';

export interface GoogleProfile {
  email: string;
  emailVerified: boolean;
  givenName: string;
  familyName: string;
  name: string;
}

export interface GoogleOAuth {
  createAuthorizationURL(state: string, codeVerifier: string): URL;
  getProfile(code: string, codeVerifier: string): Promise<GoogleProfile>;
}

interface IdTokenClaims {
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
}

export function createGoogleOAuth(opts: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): GoogleOAuth {
  const google = new Google(opts.clientId, opts.clientSecret, opts.redirectUri);
  return {
    createAuthorizationURL: (state, verifier) =>
      google.createAuthorizationURL(state, verifier, ['openid', 'email', 'profile']),
    async getProfile(code, verifier) {
      const tokens = await google.validateAuthorizationCode(code, verifier);
      const claims = decodeIdToken(tokens.idToken()) as IdTokenClaims;
      return {
        email: (claims.email ?? '').toLowerCase(),
        emailVerified: claims.email_verified === true,
        givenName: claims.given_name ?? '',
        familyName: claims.family_name ?? '',
        name: claims.name ?? claims.given_name ?? '',
      };
    },
  };
}
