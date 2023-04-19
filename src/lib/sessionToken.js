import { GraphQLClient } from 'graphql-request';
import { GetCartDocument } from './graphqlQueries';

// Session Token Management.
async function fetchSessionToken() {
    let sessionToken;
    try {
      const graphQLClient = new GraphQLClient(process.env.GRAPHQL_ENDPOINT);
  
      const cartData = await graphQLClient.request(GetCartDocument);
  
      // If user doesn't have an account return accountNeeded flag.
      sessionToken = cartData?.cart?.sessionToken;
  
      if (!sessionToken) {
        throw new Error('Failed to retrieve a new session token');
      }
    } catch (err) {
      console.error(err);
    }
  
    return sessionToken;
  }
  
  export async function getSessionToken(forceFetch = false) {
    let sessionToken = localStorage.getItem(process.env.SESSION_TOKEN_LS_KEY);
    if (!sessionToken || forceFetch) {
      sessionToken = await fetchSessionToken();
    }
    return sessionToken;
  }