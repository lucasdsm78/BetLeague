/**
 * HTTP facade
 *
 * Objectif: n'avoir qu'un seul client HTTP côté front.
 * On centralise ici le client et les types communs.
 */

import secureApiClient, { type ApiResponse, type RequestConfig } from './secureApiClient';

export type { ApiResponse, RequestConfig };

export const http = secureApiClient;
export default http;

