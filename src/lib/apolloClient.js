import {
  ApolloClient,
  from,
  gql,
  HttpLink,
  InMemoryCache,
} from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import { getSessionToken, fetchSessionToken } from "./sessionToken";
import { getAuthToken } from "./getAuthToken";

function createSessionLink() {
  return setContext(async ({ context: { headers: currentHeaders } = {} }) => {
    const headers = { ...currentHeaders };
    const authToken = await getAuthToken();
    const sessionToken = await getSessionToken();

    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    if (sessionToken) {
      headers["woocommerce-session"] = `Session ${sessionToken}`;
    }

    if (authToken || sessionToken) {
      return { headers };
    }

    return {};
  });
}

function createErrorLink() {
  return onError(({ graphQLErrors, operation, forward }) => {
    const targetErrors = [
      "The iss do not match with this server",
      "invalid-secret-key | Expired token",
      "invalid-secret-key | Signature verification failed",
      "Expired token",
      "Wrong number of segments",
    ];
    let observable;
    if (graphQLErrors?.length) {
      graphQLErrors.map(({ debugMessage, message }) => {
        if (
          targetErrors.includes(message) ||
          targetErrors.includes(debugMessage)
        ) {
          observable = new Observable((observer) => {
            getSessionToken(true)
              .then((sessionToken) => {
                operation.setContext(({ headers = {} }) => {
                  const nextHeaders = headers;

                  if (sessionToken) {
                    nextHeaders[
                      "woocommerce-session"
                    ] = `Session ${sessionToken}`;
                  } else {
                    delete nextHeaders["woocommerce-session"];
                  }

                  return {
                    headers: nextHeaders,
                  };
                });
              })
              .then(() => {
                const subscriber = {
                  next: observer.next.bind(observer),
                  error: observer.error.bind(observer),
                  complete: observer.complete.bind(observer),
                };
                forward(operation).subscribe(subscriber);
              })
              .catch((error) => {
                observer.error(error);
              });
          });
        }
        return message;
      });
    }
    return observable;
  });
}

const client = new ApolloClient({
  link: from([
    createSessionLink(),
    createErrorLink(),
    new HttpLink({ uri: process.env.NEXT_PUBLIC_WOOCOMMERCE_STORE_URL }),
  ]),
  cache: new InMemoryCache(),
});

export default client;
