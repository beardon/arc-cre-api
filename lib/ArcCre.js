const _ = require('lodash');
const axios = require('axios').default;

const DELIMITER = '|';
const RECORD_TYPES = {
    INSTRUCTOR: 'B',
    ORGANIZATION: 'A',
    STUDENT: 'C',
};

function ArcCre(options, logger) {
    options = options || { };
    this.name = 'arc-cre';
    this.apiVersion = options.apiVersion || options.version || 1;
    this.host = options.host || 'arc-course-record-entry-sf-eapi-qa.us-e1.cloudhub.io';
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.sourceSystem = options.sourceSystem;
    this.logger = logger || null;
    this.loggerConfig = options.loggerConfig;
    this.logLevel = options.logLevel || 'verbose';
    this.protocol = options.protocol || 'https';
    this.timeout = options.timeout || (1000 * 60 * 3); // 30 minutes
}

ArcCre.prototype._buildApiUrl = function (endpoint) {
    return this._buildScheme() + this._buildPath(endpoint);
};

ArcCre.prototype._buildPath = function(endpoint) {
    if (endpoint.substring(0, 1) !== '/') endpoint = '/' + endpoint;
    return `/course/recordentry/eapi/v${ this.apiVersion + endpoint }`;
}

ArcCre.prototype._buildScheme = function () {
    return `${ this.protocol }://${ this.host }`;
};

/**
 * Used to create an Online, Blended or Classroom offering.
 * @param {String} organizationId Organization ID for offering
 * @param {Number} batchId        Batch ID for offering
 * @param {Number} classId        Class ID for offering
 * @param {Array<Object>} options Array of record options
 * @returns {Promise}
 */
ArcCre.prototype.createCRE = async function (organizationId, batchId, classId, options) {
    const endpoint = `/cre`;
    let lines = [ ];
    for (const option of options) {
        switch (option.type) {
            case RECORD_TYPES.ORGANIZATION: {
                let columns = [ organizationId, batchId, classId, RECORD_TYPES.ORGANIZATION, organizationId,
                    this.sourceSystem, option.poAccountName, option.productSKU, option.startDate, option.endDate,
                    option.numberOfStudents, option.facilityName, option.address, option.city, option.state, option.zipCode ];
                lines.push(columns.join(DELIMITER));
            } break;
            case RECORD_TYPES.INSTRUCTOR: {
                let columns = [ organizationId, batchId, classId, RECORD_TYPES.INSTRUCTOR, option.instructorID,
                    option.firstName, option.lastName, option.email ];
                lines.push(columns.join(DELIMITER));
            } break;
            case RECORD_TYPES.STUDENT: {
                let columns = [ organizationId, batchId, classId, RECORD_TYPES.STUDENT, option.firstName,
                    option.lastName, option.email, option.phoneNumber, option.mastery, option.notes ];
                lines.push(columns.join(DELIMITER));
            } break;
        }
    }
    const body = lines.join('\n');
    return this.post(endpoint, null, body, null);
};

/**
 * Makes a GET request to the ARC CRE API.
 * @param {String} endpoint  API endpoint
 * @param {Object} [params]  URL parameters [optional]
 * @param {Object} [headers] HTTP headers [optional]
 * @returns {Promise}
 * @private
 */
ArcCre.prototype.get = async function (endpoint, params, headers) {
    const config = {
        method: 'GET',
        params: params || { },
        headers,
    };
    return this._request(endpoint, config);
};

/**
 * Retrieve a posted CRE's class student roster.
 * @param {String} offeringId Reference id of class
 * @returns {Promise}
 */
ArcCre.prototype.getCRE = async function (offeringId) {
    const endpoint = `/cre/${ offeringId }`;
    return this.get(endpoint);
};

/**
 * Makes a POST request to the ARC CRE API.
 * @param {String} endpoint  API endpoint
 * @param {Object} [params]  URL parameters [optional]
 * @param {Object} [data]    POST data [optional]
 * @param {Object} [headers] HTTP headers [optional]
 * @returns {Promise}
 * @private
 */
ArcCre.prototype.post = async function (endpoint, params, data, headers) {
    const config = {
        method: 'POST',
        params: params || { },
        data: data,
        headers,
    };
    return this._request(endpoint, config);
};

/**
 * Health Check Ping Test for this API
 * @returns {Promise}
 */
ArcCre.prototype.ping = async function () {
    const endpoint = '/ping';
    return this.get(endpoint);
};

/**
 * HTTP request to ARC CRE API. Automatically adds authorization headers.
 * @param {String} endpoint API endpoint
 * @param {Object} config   Axios library configuration
 * @returns {Promise}
 * @private
 */
ArcCre.prototype._request = async function (endpoint, config) {
    config = config || { };
    config.url = this._buildApiUrl(endpoint);
    config.headers = config.headers || { };
    const defaultHeaders = {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        'Content-Type': 'text/plain',
        source_system: this.sourceSystem,
    };
    _.defaults(config.headers, defaultHeaders);
    if (this.timeout) config.timeout = this.timeout;
    const instance = axios.create();
    let response = null;
    try {
        response = await instance(config);
    } catch (e) {
        if (e.response) {
            this._writeLog(endpoint, config, e.response, 'error');
            if (e.response.status === 404) return null;
        }
        throw e;
    }
    this._writeLog(endpoint, config, response);
    return response.data;
};

ArcCre.prototype._writeLog = function (endpoint, axiosConfig, response, logLevel = this.logLevel) {
    if (this.logger) {
        let logParts = [ `[${ this.name }:${ this.host }]`, axiosConfig.method ];
        logParts.push(this.loggerConfig.url ? this._buildScheme() : null);
        logParts.push(this.loggerConfig.params ? response.request.path : endpoint);
        logParts.push(this.loggerConfig.data ? JSON.stringify(axiosConfig.data) : null);
        logParts.push(`${ response.status } ${ response.statusText }`);
        logParts.push(this.loggerConfig.response ? JSON.stringify(response.data) : null);
        const log = _.compact(logParts).join(' ');
        this.logger[ logLevel ](log);
    }
}

module.exports = ArcCre;
