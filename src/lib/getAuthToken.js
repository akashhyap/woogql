import { gql } from '@apollo/client';
import { GraphQLClient } from 'graphql-request';

export const RefreshAuthTokenDocument = gql`
  mutation RefreshAuthToken($refreshToken: String!) {
    refreshJwtAuthToken(input: { jwtRefreshToken: $refreshToken }) {
      authToken
    }
  }
`;

function saveCredentials(authToken, sessionToken, refreshToken = null) {
  sessionStorage.setItem(process.env.AUTH_TOKEN_LS_KEY, authToken);
  sessionStorage.setItem(process.env.SESSION_TOKEN_LS_KEY, sessionToken);
  if (refreshToken) {
    localStorage.setItem(process.env.REFRESH_TOKEN_LS_KEY, refreshToken);
  }
}

export function hasCredentials() {
  const authToken = sessionStorage.getItem(process.env.AUTH_TOKEN_LS_KEY);
  const refreshToken = localStorage.getItem(process.env.REFRESH_TOKEN_LS_KEY);

  if (!!authToken && !!refreshToken) {
    return true;
  }

  return false;
}

let tokenSetter;
async function fetchAuthToken() {
  const refreshToken = localStorage.getItem(process.env.REFRESH_TOKEN_LS_KEY);
  if (!refreshToken) {
    // No refresh token means the user is not authenticated.
    throw new Error('Not authenticated');
  }

  try {
    const graphQLClient = new GraphQLClient(process.env.NEXT_PUBLIC_WOOCOMMERCE_STORE_URL);

    const results = await graphQLClient.request(RefreshAuthTokenDocument, { refreshToken });

    const authToken = results?.refreshJwtAuthToken?.authToken;

    if (!authToken) {
      throw new Error('Failed to retrieve a new auth token');
    }

    const customerResults = await graphQLClient.request(
      GetCartDocument,
      undefined,
      { Authorization: `Bearer ${authToken}` },
    );

    const customer = customerResults?.customer;
    const sessionToken = customer?.sessionToken;
    if (!sessionToken) {
      throw new Error('Failed to retrieve a new session token');
    }
  } catch (err) {
    if (isDev()) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  }

  saveCredentials(authToken, sessionToken);
  if (tokenSetter) {
    clearInterval(tokenSetter);
  }
  tokenSetter = setInterval(
    async () => {
      if (!hasCredentials()) {
        clearInterval(tokenSetter);
        return;
      }
      fetchAuthToken();
    },
    Number(process.env.AUTH_KEY_TIMEOUT || 30000),
  );

  return authToken;
}

export async function getAuthToken() {
  let authToken = sessionStorage.getItem(process.env.AUTH_TOKEN_LS_KEY );
  if (!authToken || !tokenSetter) {
    authToken = await fetchAuthToken();
  }
  return authToken;
}

const LoginDocument = gql`
  mutation Login($username: String!, $password: String!) {
    login(input: { username: $username, password: $password }) {
      authToken
      refreshToken
      customer {
        sessionToken
      }
    }
  }
`;

export async function login(username, password) {
    try {
        const graphQLClient = new GraphQLClient(process.env.NEXT_PUBLIC_WOOCOMMERCE_STORE_URL);
        const results = await graphQLClient.request(
            LoginDocument,
            { username, password },
        );
        const loginResults = results?.login;
        const {
            authToken,
            refreshToken,
            customer,
        } = loginResults;

        if (!authToken || !refreshToken || !customer?.sessionToken) {
            throw new Error( 'Failed to retrieve credentials.');
        }
    } catch (error) {
        throw new Error(error);
    }

    saveCredentials(authToken, customer.sessionToken, refreshToken);

    return customer;
}