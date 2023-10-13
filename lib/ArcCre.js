const _ = require('lodash');
const axios = require('axios').default;

const DELIMITER = '|';
const RECORD_TYPES = {
    INSTRUCTOR: 'B',
    ORGANIZATION: 'A',
    STUDENT: 'C',
};

function ArcCre(options) {
    options = options || { };
    this.name = 'arcCre';
    this.apiVersion = options.apiVersion || options.version || 1;
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.debug = options.debug || false;
    this.host = options.host || 'arc-course-record-entry-sf-eapi-qa.us-e1.cloudhub.io';
    this.sourceSystem = options.sourceSystem;
}

ArcCre.prototype._buildApiUrl = function (endpoint) {
    if (endpoint.substring(0, 1) !== '/') endpoint = '/' + endpoint;
    return `https://${ this.host }/v${ this.apiVersion + endpoint }`;
};

/**
 * Makes a GET request to the ARC CRE API.
 * @param {String} endpoint      API endpoint
 * @param {Object} [params]      query parameters [optional]
 * @param {Object} [headers]     HTTP headers [optional]
 * @returns {Promise}
 * @private
 */
ArcCre.prototype._get = async function (endpoint, params, headers) {
    const options = {
        method: 'get',
        url: this._buildApiUrl(endpoint),
        params: params || { },
        headers,
    };
    return this._request(options);
};

/**
 * Makes a POST request to the ARC CRE API.
 * @param {String} endpoint      API endpoint
 * @param {Object} [params]      query parameters [optional]
 * @param {Object} [body]        body [optional]
 * @param {Object} [headers]     HTTP headers [optional]
 * @returns {Promise}
 * @private
 */
ArcCre.prototype._post = async function (endpoint, params, body, headers) {
    const options = {
        method: 'post',
        url: this._buildApiUrl(endpoint),
        params: params || { },
        data: body,
        headers,
    };
    return this._request(options);
};

/**
 * HTTP request to ARC CRE API. Automatically adds authorization headers.
 * @param {Object} config     Axios library configuration
 * @returns {Promise}
 * @private
 */
ArcCre.prototype._request = async function (config) {
    config = config || {};
    const defaultHeaders = {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        'Content-Type': 'text/plain',
        source_system: this.sourceSystem,
    };
    _.defaults(config.headers, defaultHeaders);
    try {
        const response = await axios(config);
        return response.data;
    } catch (e) {
        let err = new Error(`${ e.response.status } - ${ config.url } failed`);
        err.code = e.response.status;
        err.meta = e.response.data;
        throw err;
    }
};

/**
 * Used to create an Online, Blended or Classroom offering.
 * @param {String} organizationId     Organization ID for offering
 * @param {Number} batchId            Batch ID for offering
 * @param {Number} classId            Class ID for offering
 * @param {Array<Object>} options     Array of record options
 * @returns {Promise}
 */
ArcCre.prototype.createCRE = async function (organizationId, batchId, classId, options) {
    const endpoint = `/cre`;
    let lines = [ ];
    for (const option of options) {
        switch (option.type) {
            case RECORD_TYPES.ORGANIZATION: {
                let columns = [ organizationId, batchId, classId, RECORD_TYPES.ORGANIZATION, option.organizationName,
                    option.poAccountName, option.productSKU, option.startDate, option.endDate, option.numberOfStudents,
                    option.facilityName, option.address, option.city, option.state, option.zipCode ];
                lines.push(columns.join(DELIMITER));
            } break;
            case RECORD_TYPES.INSTRUCTOR: {
                let columns = [ organizationId, batchId, classId, RECORD_TYPES.ORGANIZATION, option.instructorID,
                    option.firstName, option.lastName, option.email ];
                lines.push(columns.join(DELIMITER));
            } break;
            case RECORD_TYPES.STUDENT: {
                let columns = [ organizationId, batchId, classId, RECORD_TYPES.ORGANIZATION, option.firstName,
                    option.lastName, option.email, option.phoneNumber, option.mastery, option.notes ];
                lines.push(columns.join(DELIMITER));
            } break;
        }
    }
    const body = lines.join('\r\n');
    return this._post(endpoint, null, body, null);
};

/**
 * Retrieve a posted CRE's class student roster.
 * @param {String} offeringId     Reference id of class
 * @returns {Promise}
 */
ArcCre.prototype.getCRE = async function (offeringId) {
    const endpoint = `/cre/${ offeringId }`;
    return this._get(endpoint);
};

/**
 * Health Check Ping Test for this API
 * @returns {Promise}
 */
ArcCre.prototype.ping = async function () {
    const endpoint = '/ping';
    return this._get(endpoint);
};

module.exports = ArcCre;
