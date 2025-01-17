/*
 *  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 *  Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
 *  SPDX-License-Identifier: Apache-2.0
 *  ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

import { RequestOptions as HttpRequestOptions } from 'http';
import { RequestOptions as HttpsRequestOptions } from 'https';
import * as url from 'url';
import { ApiClient, ApiClientRequest, ApiClientResponse } from './apiClient';

/**
 * Default implementation of {@link ApiClient} which uses the native HTTP/HTTPS library of Node.JS.
 */
export class DefaultApiClient implements ApiClient {
    private httpClient: any;
    private httpsClient: any;

    constructor(
        httpClient = require('http'),
        httpsClient = require('https')
    ) {
        this.httpClient = httpClient;
        this.httpsClient = httpsClient;
    }
    /**
     * Dispatches a request to an API endpoint described in the request.
     * An ApiClient is expected to resolve the Promise in the case an API returns a non-200 HTTP
     * status code. The responsibility of translating a particular response code to an error lies with the
     * caller to invoke.
     * @param {ApiClientRequest} request request to dispatch to the ApiClient
     * @returns {Promise<ApiClientResponse>} response from the ApiClient
     */
    public async invoke(request: ApiClientRequest): Promise<ApiClientResponse> {
        const urlObj = url.parse(request.url);

        const clientRequestOptions: HttpRequestOptions | HttpsRequestOptions = {
            // tslint:disable:object-literal-sort-keys
            hostname : urlObj.hostname,
            path : urlObj.path,
            port : urlObj.port,
            protocol : urlObj.protocol,
            auth : urlObj.auth,
            headers : arrayToObjectHeader(request.headers),
            method : request.method
        };

        const client = clientRequestOptions.protocol === 'https:' ? this.httpsClient : this.httpClient;

        return new Promise<ApiClientResponse>((resolve, reject) => {
            const clientRequest = client.request(clientRequestOptions, (response) => {
                const chunks: any = [];
                response.on('data', (chunk) => {
                    chunks.push(chunk);
                });

                response.on('end', () => {
                    const responseStr = chunks.join('');
                    const responseObj: ApiClientResponse = {
                        statusCode : response.statusCode,
                        body : responseStr,
                        headers : objectToArrayHeader(response.headers)
                    };

                    resolve(responseObj);
                });
            });

            clientRequest.on('error', (err) => {
                reject(new Error(err.message));
            });

            if (request.body) {
                clientRequest.write(request.body);
            }

            clientRequest.end();
        });
    }
}

/**
 * Converts the header array in {@link ApiClientRequest} to compatible JSON object.
 * @private
 * @param {{key : string, value : string}[]} header header array from ApiClientRequest}
 * @returns {Object.<string, string[]>} header object to pass into HTTP client
 */
function arrayToObjectHeader(header: Array<{key: string, value: string}>): {[key: string]: string[]} {
    const reducer = (obj: {[key: string]: string[]}, item: {key: string, value: string})
        : {[key: string]: string | string[]} => {
        if (obj[item.key]) {
            obj[item.key].push(item.value);
        } else {
            obj[item.key] = [item.value];
        }

        return obj;
    };

    return header.reduce(reducer, {});
}

/**
 * Converts JSON header object to header array required for {ApiClientResponse}
 * @private
 * @param {Object.<string, (string|string[])>} header JSON header object returned by HTTP client
 * @returns {{key : string, value : string}[]}
 */
function objectToArrayHeader(header: {[key: string]: string | string[]}): Array<{key: string, value: string}> {
    const arrayHeader = <Array<{key: string, value: string}>> [];

    Object.keys(header).forEach((key: string) => {
        const headerArray = Array.isArray(header[key]) ? header[key] : [header[key]];
        for (const value of <string[]> headerArray) {
            arrayHeader.push({
                key,
                value
            });
        }
    });

    return arrayHeader;
}
