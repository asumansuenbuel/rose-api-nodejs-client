/**
 * RoseAPI module main file
 *
 * All callback functions used in this API are expected to follow the
 * commonly used nodejs callback function signature
 *
 * (err, result) => {
 *     if (err) {
 *       // do error handling
 *      return;
 *     }
 *     // happy path: process the result parameter
 * }
 *
 * with the first parameter being the error parameter, which is
 * passed as a non-null value in case an * error is reported.
 * 
 * @author Asuman Suenbuel
 */

const { OAuth2Client } = require('google-auth-library');
const request = require('request');

const { Server, Auth } = require('./config');

const RoseJsonDecorator = '%JSN';

/**
 * The RoseAPI class contains the API methods. A singleton instance is
 * used for the module export. All methods of the RoseAPI class
 * defined in this file starting with the prefix "api_" are exported
 * as module functions without the "api_"
 * prefix (e.g. "api_getEntities" is exported as "getEntities").
 * @class
 * @hideconstructor
 * @ignore
 */
class RoseAPI {

    /**
     */
    constructor(tokens, apiUrl = Server.ApiUrl) {
	this.tokens = tokens
	this.apiUrl = apiUrl
    }

    /**
     * @ignore
     */
    _getOauth2Client() {
	const { access_token, refresh_token } = this.tokens;
	const oAuth2Client = new OAuth2Client(Auth.GoogleClientId, Auth.GoogleClientSecret);
	oAuth2Client.setCredentials({ access_token, refresh_token });
	return oAuth2Client;
    }

    /**
     * @ignore
     */
    _getRefreshedTokens() {
	const client = this._getOauth2Client();
	return new Promise((resolve, reject) => {
	    client.refreshAccessToken((error, tokens, response) => {
		if (error) {
		    return reject(error);
		}
		this.tokens = tokens;
		return resolve(tokens);
	    })
	})
    }
    
    /**
     * constructs the API url by prepending the apiUrl, apiPath to the
     * pathElements
     * @ignore
     */
    _getUrl(...pathElements) {
	return `${this.apiUrl}${Server.ApiPath}/${pathElements.join('/')}`;
    }

    /**
     * Uploads a binary to the server
     */
    _apiCallUploadBinary(path, getReadStream, callback) {
	const cb = ensureFunction(callback);
	const url = this._getUrl(path);
	const bearer = this.tokens.access_token;
	const auth = { bearer };
	const requestObject = {
	    url: url,
	    auth: auth,
	    method: 'POST',
	    encoding: null,
	    body: getReadStream()
	};
	request(requestObject, (err, res) => {
	    if (err) {
		return cb(err);
	    }
	    if (res.statusCode === 500) { // unauthorized
		console.log('--> unauthorized; trying to get a refreshed token...');
		this._getRefreshedTokens()
		    .then(tokens => {
			const requestObject = {
			    url: url,
			    auth: { bearer: tokens.access_token },
			    method: 'POST',
			    encoding: null,
			    body: getReadStream()
			};
			//requestObject.auth.bearer = tokens.access_token
			console.log('--> retrying request with refreshed token...');
			request(requestObject, (err, res) => {
			    if (err) {
				return cb(err);
			    }
			    cb(null, res);
			})
		    })
		    .catch(err => {
			cb(err);
		    })
	    } else {
		cb(null, res);
	    }
	});
    }
    
    /**
     * makes an authorized api call to the given path; retries the call if
     * access token is expired by getting a freshed token from the oauth2
     * endpoint.
     * @ignore
     */
    _apiCall(path, requestObject, callback, options) {
	const url = this._getUrl(path);
	const bearer = this.tokens.access_token;
	const auth = { bearer };
	const { returnResultAsIs, dontProcessRequestObject } = options || {};
	const cb = (typeof callback === 'function') ? callback : (() => {})
	requestObject.url = url;
	requestObject.auth = auth;
	if (returnResultAsIs) {
	    requestObject.encoding = null;
	}
	// if the requestObject has a json field, check whether any of the fields in there
	// have a JSON object as value. In that case, add the %JSN suffix to field name
	// and stringify the object value
	const stringifyJsonFields = () => {
	    const json = requestObject.json
	    if (typeof json !== 'object') {
		return
	    }
	    const keys = Object.keys(json);
	    keys.forEach(key => {
		const value = json[key];
		if (typeof value === 'object') {
		    const newValue = JSON.stringify(value, null, 2);
		    const newKey = `${key}${RoseJsonDecorator}`;
		    delete json[key];
		    json[newKey] = newValue;
		}
	    })
	};
	// checks for fields with the %JSN suffix and
	// - removes the %JSN suffix from the field name, and
	// - parses the value into a json object
	const _parseJsonFields = obj => {
	    const keys = Object.keys(obj);
	    keys.forEach(key => {
		if (key.endsWith(RoseJsonDecorator)) {
		    const newKey = key.substr(0, key.length - RoseJsonDecorator.length);
		    try {
			const valueStr = obj[key];
			const valueObj = JSON.parse(valueStr);
			delete obj[key];
			obj[newKey] = valueObj;
		    } catch (err) {
			//console.error(`problem while trying to parse JSON field "${key}": ${err}`);
			obj[newKey] = null;
		    }
		}
	    });
	    return obj;
	}
	const parseJsonFields = objOrArray => {
	    if (Array.isArray(objOrArray)) {
		objOrArray.forEach(_parseJsonFields);
	    } else {
		_parseJsonFields(objOrArray);
	    }
	    return objOrArray;
	}
	const jsonResult = body => {
	    if (typeof body === 'object') {
		return cb(null, parseJsonFields(body));
	    }
	    try {
		cb(null, parseJsonFields(JSON.parse(body)));
	    } catch(err) {
		cb(err);
	    }
	}
	const checkResult = res => {
	    if (res.statusCode === 200) {
		if (returnResultAsIs) {
		    console.log(`returning response body as-is: content-type: ${res.headers['content-type']}`);
		    return cb(null, res.body);
		} else {
		    return jsonResult(res.body);
		}
	    }
	    cb(res.body);
	}

	if (!dontProcessRequestObject) {
	    stringifyJsonFields();
	}
	//console.log(`sending request: ${JSON.stringify(requestObject, null, 2)}`)
	request(requestObject, (err, res) => {
	    if (err) {
		return cb(err);
	    }
	    if (res.statusCode === 500) { // unauthorized
		console.log('unauthorized; trying to get a refreshed token...');
		this._getRefreshedTokens()
		    .then(tokens => {
			requestObject.auth.bearer = tokens.access_token
			console.log('retrying request with refreshed token...');
			request(requestObject, (err, res) => {
			    if (err) {
				return cb(err);
			    }
			    checkResult(res);
			})
		    })
		    .catch(err => {
			cb(err);
		    })
	    } else {
		checkResult(res)
	    }
	});
    }

    // -----------------------------------------------------------------------------

    /**
     * retrieves the object representing the currently authenticated user
     * @alias module:rose-api#getUser
     * @param {callback} callback
     */
    api_getUser(callback) {
	this._apiCall('user', {}, callback);
    }

    // -----------------------------------------------------------------------------

    /**
     * @alias module:rose-api#getEntities
     * @param {entityName} entityName
     *
     */
    api_getEntities(entityName, callback) {
	this._apiCall(`rest/${entityName}`, {}, callback);
    }

    /**
     *
     * @alias module:rose-api#getBackendSystems
     */
    api_getBackendSystems(callback) {
	this.api_getEntities('backend_systems', callback);
    }

    /**
     *
     * @alias module:rose-api#getRobots
     */
    api_getRobots(callback) {
	this.api_getEntities('robots', callback);
    }

    /**
     *
     * @alias module:rose-api#getConnections
     */
    api_getConnections(callback) {
	this.api_getEntities('connections', callback);
    }

    /**
     *
     * @alias module:rose-api#getConnectionClasses
     */
    api_getConnectionClasses(callback) {
	const cb = (typeof callback === 'function') ? callback : (() => {});
	this.api_getConnections((err, connections) => {
	    if (err) {
		return cb(err);
	    }
	    cb(null, connections.filter(conn => !conn.CLASS_UUID));
	});
    }

    // -----------------------------------------------------------------------------

    /**
     *
     * @alias module:rose-api#getEntity
     */
    api_getEntity(entityName, uuid, callback) {
	this._apiCall(`rest/${entityName}/${uuid}`, {}, callback);
    }

    api_getBackendSystem(uuid, callback) {
	this.api_getEntity('backend_systems', uuid, callback);
    }

    api_getRobot(uuid, callback) {
	this.api_getEntity('robots', uuid, callback);
    }

    api_getConnection(uuid, callback) {
	this.api_getEntity('connections', uuid, callback);
    }

    // -----------------------------------------------------------------------------

    /**
     * find entity using a queryTerm.
     * @param {entityName} entityName
     * @param {string|object} queryTerm if queryTerm is a string, then
     * it's used as-is as a where condition to the SQL query; however,
     * it is recommended to use queryTerm as object, which loosely
     * follows the mongodb query format. E.g. { "NAME": "xyz" } as
     * queryTerm would return all entities with the given name. The
     * operator format is also supported, for instance
     * 
     * { "NAME": { "$like": "Fetch%" } }
     * 
     * would result in "NAME" LIKE 'Fetch%' condition; "$ilike" can be
     * used for case-insesitive comparision.
     * @param {callback} callback
     * @alias module:rose-api#findEntities
     */
    api_findEntities(entityName, queryTerm, callback) {
	let url = `rest/${entityName}`;
	if (typeof queryTerm === 'string') {
	    const filterCondition = escape(queryTerm);
	    url += `?filterCondition=${filterCondition}`;
	}
	else if (typeof queryTerm === 'object') {
	    url += `?filterCondition=${escape(JSON.stringify(queryTerm))}`
	}
	this._apiCall(url, {}, callback);
    }

    api_findBackendSystems(queryTerm, callback) {
	this.api_findEntities('backend_systems', queryTerm, callback);
    }
    
    api_findRobots(queryTerm, callback) {
	this.api_findEntities('robots', queryTerm, callback);
    }
    
    api_findConnections(queryTerm, callback) {
	this.api_findEntities('connections', queryTerm, callback);
    }
    
    // -----------------------------------------------------------------------------
    
    api_createEntity(entityName, obj, callback) {
	const url = `rest/${entityName}`
	const requestObj = {
	    method: 'POST',
	    json: obj
	};
	this._apiCall(url, requestObj, callback);
    }

    api_createBackendSystem(obj, callback) {
	const entityName = 'backend_systems';
	this.api_createEntity(entityName, obj, callback);
    }

    api_createRobot(obj, callback) {
	const entityName = 'robots';
	this.api_createEntity(entityName, obj, callback);
    }

    api_createConnection(obj, callback) {
	const entityName = 'connections';
	this.api_createEntity(entityName, obj, callback);
    }
    

    // -----------------------------------------------------------------------------

    api_updateEntity(entityName, uuid, obj, callback) {
	const url = `rest/${entityName}/${uuid}`;
	const requestObj = {
	    method: 'PUT',
	    json: obj
	};
	this._apiCall(url, requestObj, callback);
    }

    api_updateBackendSystem(uuid, obj, callback) {
	const entityName = 'backend_systems';
	this.api_updateEntity(entityName, uuid, obj, callback);
    }

    api_updateRobot(uuid, obj, callback) {
	const entityName = 'robots';
	this.api_updateEntity(entityName, uuid, obj, callback);
    }

    api_updateConnection(uuid, obj, callback) {
	const entityName = 'connections';
	this.api_updateEntity(entityName, uuid, obj, callback);
    }

    // -----------------------------------------------------------------------------

    _getConnectionJSON(uuid, callback) {
	const cb = ensureFunction(callback)
	this.api_getConnection(uuid, (err, obj) => {
	    if (err) {
		return cb(err);
	    }
	    const { __JSON } = obj;
	    if (!__JSON) return {}
	    try {
		const jsonObj = JSON.parse(__JSON);
		console.log(`__JSON: ${JSON.stringify(jsonObj, null, 2)}`);
		cb(null, jsonObj);
	    } catch (err) {
		return cb(err);
	    }
	})
    }

    api_getConnectionInstances(uuid, callback) {
	const qobj = { CLASS_UUID: uuid };
	this.api_findConnections(qobj, callback);
    }

    api_findConnectionInstances(uuid, queryObject, callback) {
	const qobj = queryObject || {};
	qobj.CLASS_UUID = uuid;
	this.api_findConnections(qobj, callback);
    }

    /**
     * retrieve the config json object of the connection class or
     * instance
     */
    api_getConnectionConfigJson(uuid, callback) {
	const cb = ensureFunction(callback);
	this._getConnectionJSON(uuid, (err, jsonObj) => {
	    if (err) {
		return cb(err);
	    }
	    const { configJsonObj } = jsonObj;
	    if (!configJsonObj) {
		return cb(null, {});
	    }
	    cb(null, configJsonObj);
	})
    }

    _getConnectionClassForInstanceUuid(instanceUuid, callback) {
	this.api_getConnection(instanceUuid, (err, instanceObject) => {
	    if (err) {
		return callback(err);
	    }
	    const { CLASS_UUID } = instanceObject;
	    if (!CLASS_UUID) {
		return callback(`uuid ${instanceUuid} doesn't belong to an instance object.`);
	    }
	    this.api_getConnection(CLASS_UUID, callback);
	})
    }

    /**
     * This method returns a zip-file binary containing the generated
     * code of an connection instance.  The uuid given must be one of
     * an connection instance object. The method triggers the run of
     * the code generation on the given instance and returns the
     * entire folder structure in the zip-binary.
     * @param {string} uuid - the uuid of the connection instance
     * object
     * @param {function} callback - the callback function; in this
     * case the response is a binary representing the content of a
     * zip-file.
     * @alias module:rose-api#getCodeZip
     */
    api_getCodeZip(uuid, callback) {
	const cb = ensureFunction(callback);
	this._getConnectionClassForInstanceUuid(uuid, (err, classObject) => {
	    if (err) {
		return cb(err);
	    }
	    const { UUID } = classObject;
	    const gitUrl = classObject['Git Clone URL'];
	    const gitSubfolder = classObject['Git Subfolder'];
	    if (!gitUrl) {
		return cb(`no gitUrl found in class object with uuid ${UUID}`);
	    }
	    const url = 'git/createzip';
	    const json = { instanceUuid: uuid, gitUrl, gitSubfolder };
	    const method = 'POST';
	    const requestObj = { method, json };
	    const returnResultAsIs = true;
	    const dontProcessRequestObject = true;
	    const options = { returnResultAsIs, dontProcessRequestObject };
	    this._apiCall(url, requestObj, cb, options);
	})
    }

    /**
     * Uploads the zip-file for the given connection class
     */
    api_postCodeZip(uuid, callback) {
	const cb = ensureFunction(callback);
	const url = `binary/zip/${uuid}`;
	const testFile = '/tmp/code.zip';
	const { createReadStream } = require('fs');
	const getReadStream = () => {
	    console.log('(re)creating read stream for request...');
	    return createReadStream(testFile);
	};
	this._apiCallUploadBinary(url, getReadStream, (err, res) => {
	    if (err) {
		console.error(`ERROR: ${err}`)
		return cb(err);
	    }
	    console.log(`upload successful.`);
	    cb(null, res);
	});
    }
}

// ---------------------------------------------------------------------------------

/** @ignore */
const ensureFunction = callback => (
    (typeof callback === 'function') ? callback : (() => {})
)

/**
 * @name rose-api
 * @module rose-api
 * @global 
 * @description
 * The rose-api module exports nodejs functions to access the
 * different functionality offered by the RoseStudio environment.
 */
module.exports = (tokens, apiUrl) => {
    const rose = new RoseAPI(tokens, apiUrl);
    const apiObject = {};
    const roseProto = Object.getPrototypeOf(rose);

    // export all methods starting with "api_" as functions with this prefix removed.
    // e.g. "api_getUser" is exported as "getUser"
    Object.getOwnPropertyNames(roseProto)
	.filter(p => (typeof roseProto[p] === 'function') && (p.startsWith('api_')))
	.forEach(fn => {
	    //console.log(`method found: ${fn}`);
	    const apiName = fn.substring(4)
	    apiObject[apiName] = rose[fn].bind(rose)
	});
    
    return apiObject;
}

/**
 * The format of callback function used in the API methods
 * @callback callback
 * @param {(string|object)} err The err as returned by the API method, or null if no error occurred.
 * @param {object} response the response object generated by the API method.
 */

/**
 * @typedef {string} entityName
 * @property {string} 'backend_systems' entity name for backend systems
 * @property {string} 'robots' entity name for robots
 * @property {string} 'connections' entity name for connections (classes and instances)
 */
