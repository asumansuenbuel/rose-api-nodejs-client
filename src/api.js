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

const { Server, Auth, Settings } = require('./config');
const ZipFile = require('./create-zip');

const { fileContainsPreprocessorSyntax } = require('./server_utils');

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
    constructor(tokens, options) {
	const { debug, apiUrl } = options || {};
	this.tokens = tokens;
	this.apiUrl = apiUrl || Server.ApiUrl;
	this.debug = debug;
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

	const checkResult = res => {
	    if (res.statusCode !== 200) {
		cb(res.body);
	    } else {
		cb(null, res.body);
	    }
	};
	
	request(requestObject, (err, res) => {
	    if (err) {
		return cb(err);
	    }
	    if (res.statusCode === 500) { // unauthorized
		this.debug && console.log('--> unauthorized; trying to get a refreshed token...');
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
			this.debug && console.log('--> retrying request with refreshed token...');
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
		checkResult(res);
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
		    //this.debug && console.log(`returning response body as-is: content-type: ${res.headers['content-type']}`);
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
		this.debug && console.log('unauthorized; trying to get a refreshed token...');
		this._getRefreshedTokens()
		    .then(tokens => {
			requestObject.auth.bearer = tokens.access_token
			this.debug && console.log('retrying request with refreshed token...');
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
     * returns the RoseStudio server url that is used for api calls
     * @global
     * @alias getServerUrl
     */
    api_getServerUrl() {
	return this.apiUrl;
    }

    /**
     * Returns the RoseStudio page url that corresponds to the given object
     * @param {entityName} entityName - the entity name of the object
     * @param {string} uuid - the uuid of the object
     * @returns {string} the RoseStudio url for this object
     * @global
     * @alias getRoseStudioEntityPageUrl
     */
    api_getRoseStudioEntityPageUrl(entityName, uuid) {
	const ENTITY = entityName.toUpperCase();
	const urlElements = [this.apiUrl, '#'];
	if (ENTITY.startsWith("CONNECTION")) {
	    urlElements.push('connectionobject', 'CONNECTIONS');
	} else {
	    urlElements.push('databaseobject', ENTITY);
	}
	urlElements.push(uuid);
	const url = urlElements.join('/');
	return url;
    }

    /**
     * Returns the RoseStudio page url that corresponds to the given object
     * @param {string} uuid - the uuid of the object
     * @returns {string} the RoseStudio url for this object
     * @see getRoseStudioEntityPageUrl
     * @global
     * @alias getRoseStudioBackendSystemPageUrl
     */
    api_getRoseStudioBackendSystemtPageUrl(uuid) {
	return this.api_getRoseStudioEntityPageUrl('backend_systems', uuid);
    }
    
    /**
     * Returns the RoseStudio page url that corresponds to the given object
     * @param {string} uuid - the uuid of the object
     * @returns {string} the RoseStudio url for this object
     * @see getRoseStudioEntityPageUrl
     * @global
     * @alias getRoseStudioRobotPageUrl
     */
    api_getRoseStudioRobotPageUrl(uuid) {
	return this.api_getRoseStudioEntityPageUrl('robots', uuid);
    }
    
    /**
     * Returns the RoseStudio page url that corresponds to the given object
     * @param {string} uuid - the uuid of the object
     * @returns {string} the RoseStudio url for this object
     * @see getRoseStudioEntityPageUrl
     * @global
     * @alias getRoseStudioConnectionPageUrl
     */
    api_getRoseStudioConnectionPageUrl(uuid) {
	return this.api_getRoseStudioEntityPageUrl('connections', uuid);
    }
    
    // -----------------------------------------------------------------------------

    /**
     * retrieves the object representing the currently authenticated user
     * @param {callback} callback
     * @global
     * @alias getUser
     */
    api_getUser(callback) {
	this._apiCall('user', {}, callback);
    }

    // -----------------------------------------------------------------------------
    
    /**
     * @global
     * @alias getEntities
     * @param {entityName} entityName
     *
     */
    api_getEntities(entityName, callback) {
	this._apiCall(`rest/${entityName}`, {}, callback);
    }

    /**
     * @see getEntities
     * @global
     * @alias getBackendSystems
     */
    api_getBackendSystems(callback) {
	this.api_getEntities('backend_systems', callback);
    }

    /**
     * @see getEntities
     * @global
     * @alias getRobots
     */
    api_getRobots(callback) {
	this.api_getEntities('robots', callback);
    }

    /**
     * @see getEntities
     * @global
     * @alias getConnections
     */
    api_getConnections(callback) {
	this.api_getEntities('connections', callback);
    }

    /**
     * @see getEntities
     * @global
     * @alias getConnectionClasses
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
     * Retrieves the record stored in the Rose database for the object
     * with the given uuid and entity. Entity can be one of
     * 'backend_systems', 'robots', or 'connections'.
     * @global
     * @param {entityName} entityName - the entity of the object to be retrieved
     * @param {string} uuid - the uuid of the object to be retrieved
     * @param {callback} callback - callback function for processing the result
     * @alias getEntity
     */
    api_getEntity(entityName, uuid, callback) {
	this._apiCall(`rest/${entityName}/${uuid}`, {}, callback);
    }

    /**
     * @see getEntity
     * @global
     * @alias getBackendSystem
     */
    api_getBackendSystem(uuid, callback) {
	this.api_getEntity('backend_systems', uuid, callback);
    }

    /**
     * @see getEntity
     * @global
     * @alias getRobot
     */
    api_getRobot(uuid, callback) {
	this.api_getEntity('robots', uuid, callback);
    }

    /**
     * @see getEntity
     * @global
     * @alias getConnection
     */
    api_getConnection(uuid, callback) {
	this.api_getEntity('connections', uuid, callback);
    }

    // -----------------------------------------------------------------------------

    // -----------------------------------------------------------------------------

    _interpretStringAsName(queryTerm) {
	if (typeof queryTerm !== 'string') {
	    return queryTerm;
	}
	return { NAME: queryTerm };
    }
    
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
     * used for comparision ignoring the case.
     * @param {callback} callback
     * @global
     * @alias findEntities
     */
    api_findEntities(entityName, queryTerm, callback) {
	let url = `rest/${entityName}`;
	queryTerm = this._interpretStringAsName(queryTerm);
	/*
	if (typeof queryTerm === 'string') {
	    const filterCondition = escape(queryTerm);
	    url += `?filterCondition=${filterCondition}`;
	}
	else
	*/
	if (typeof queryTerm === 'object') {
	    url += `?filterCondition=${escape(JSON.stringify(queryTerm))}`
	}
	this._apiCall(url, {}, callback);
    }

    /**
     * @see findEntities
     * @global
     * @alias findBackendSystems
     */
    api_findBackendSystems(queryTerm, callback) {
	this.api_findEntities('backend_systems', queryTerm, callback);
    }

    /**
     * @see findEntities
     * @global
     * @alias findRobots
     */
    api_findRobots(queryTerm, callback) {
	this.api_findEntities('robots', queryTerm, callback);
    }

    /**
     * @see findEntities
     * @global
     * @alias findConnections
     */
    api_findConnections(queryTerm, callback) {
	this.api_findEntities('connections', queryTerm, callback);
    }

    // -----------------------------------------------------------------------------

    /**
     * @global
     * @alias findOneEntity
     */
    api_findOneEntity(entityName, queryTerm, callback) {
	const cb = ensureFunction(callback);
	this.api_findEntities(entityName, queryTerm, (err, res) => {
	    if (err) {
		return cb(err);
	    }
	    if (!Array.isArray(res)) {
		return cb(`unexpected type of result: ${typeof res}`);
	    }
	    if (res.length === 0) {
		let errmsg = `found no record that matches `
		    + `the given query ${JSON.stringify(queryTerm)}`;
		return cb(errmsg);
	    }
	    if (res.length > 1) {
		let errmsg = `found more than one record that `
		    + `matches the given query ${JSON.stringify(queryTerm)}`;
		return cb(errmsg);
	    }
	    cb(null, res[0]);
	});
    }

    /**
     * @see findOneEntity
     * @global
     * @alias findOneBackendSystem
     */
    api_findOneBackendSystem(queryTerm, callback) {
	this.api_findOneEntity('backend_systems', queryTerm, callback);
    }

    /**
     * @see findOneEntity
     * @global
     * @alias findOneRobot
     */
    api_findOneRobot(queryTerm, callback) {
	this.api_findOneEntity('robots', queryTerm, callback);
    }

    /**
     * @see findOneEntity
     * @global
     * @alias findOneConnection
     */
    api_findOneConnection(queryTerm, callback) {
	this.api_findOneEntity('connections', queryTerm, callback);
    }

    /**
     * Returns all the connection instances of the connection/scenario
     * class referred to by the given uuid.
     * @param {string} uuid - uuid of a connection class
     * @param {callback} callback - the callback function for
     * receiving the instance objects
     * @global
     * @alias getAllConnectionInstances
     */
    api_getAllConnectionInstances(uuid, callback) {
	const qobj = { CLASS_UUID: uuid };
	this.api_findConnections(qobj, callback);
    }

    /**
     * Returns all matching connection instances of the connection/scenario
     * class referred to by the given uuid.
     * @param {string} uuid - uuid of a connection class
     * @param {object} queryTerm - queryTerm for restricting which
     * instance objects are retrieved
     * @param {callback} callback - the callback function for
     * receiving the instance objects
     * @global
     * @alias findConnectionInstances
     */
    api_findConnectionInstances(uuid, queryObject, callback) {
	const qobj = queryObject || {};
	qobj.CLASS_UUID = uuid;
	this.api_findConnections(qobj, callback);
    }

    /**
     * @global
     * @alias findOneConnectionInstance
     */
    api_findOneConnectionInstance(classUuidOrQueryObject, instanceQueryObject, callback) {
	const cb = ensureFunction(callback);
	const _findUsingClassUuid = classUuid => {
	    let qobj = shallowCopy(instanceQueryObject);
	    qobj.CLASS_UUID = classUuid;
	    this.api_findOneConnection(qobj, callback);
	}
	if (typeof classUuidOrQueryObject === 'string') {
	    return _findUsingClassUuid(classUuidOrQueryObject);
	}
	this.api_findOneConnectionClass(classUuidOrQueryObject, (err, classObj) => {
	    if (err) {
		return cb(err);
	    }
	    const { UUID } = classObj;
	    _findUsingClassUuid(UUID);
	});
    }

    // -----------------------------------------------------------------------------

    /**
     *
     * This method takes either a uuid string or a queryObject to return an entity of the given category.
     * If a queryTerm is used, it must result in exactly one result, otherwise the method will fail.
     *
     */
    _getOrFindOneEntity(entityName, uuidOrQueryObject, callback) {
	if (typeof uuidOrQueryObject === 'string') {
	    let uuid = uuidOrQueryObject;
	    this.api_getEntity(entityName, uuid, callback);
	    return;
	}
	if (typeof uuidOrQueryObject === 'object') {
	    let queryObject = uuidOrQueryObject;
	    this.api_findOneEntity(entityName, queryObject, callback);
	}
    }

    // -----------------------------------------------------------------------------

    /**
     * @global
     * @alias findOneConnectionClass
     */
    api_findOneConnectionClass(queryTerm, callback) {
	if ((typeof queryTerm === 'string')) {
	    callback(`queryTerm must be an object`);
	    return;
	}
	const newQueryTerm = {}
	Object.keys(queryTerm).forEach(key => newQueryTerm[key] = queryTerm[key]);
	newQueryTerm.CLASS_UUID = "$isnull";
	this.api_findOneConnection(newQueryTerm, callback);
    }
    
    // -----------------------------------------------------------------------------

    /**
     * @global
     * @alias createEntity
     */
    api_createEntity(entityName, obj, callback) {
	const url = `rest/${entityName}`
	const requestObj = {
	    method: 'POST',
	    json: obj
	};
	this._apiCall(url, requestObj, callback);
    }

    /**
     * @see createEntity
     * @global
     * @alias createBackendSystem
     */
    api_createBackendSystem(obj, callback) {
	const entityName = 'backend_systems';
	this.api_createEntity(entityName, obj, callback);
    }

    /**
     * @see createEntity
     * @global
     * @alias createRobot
     */
    api_createRobot(obj, callback) {
	const entityName = 'robots';
	this.api_createEntity(entityName, obj, callback);
    }

    /**
     * @see createEntity
     * @global
     * @alias createConnection
     */
    api_createConnection(obj, callback) {
	const entityName = 'connections';
	this.api_createEntity(entityName, obj, callback);
    }
    

    // -----------------------------------------------------------------------------

    /**
     * Updates the object with the given id in the system with new values for the given fields.
     * @param {entityName} entity - the entity name of the object to be updated
     * @param {string} uuid - the uuid of the object to be updated
     * @param {object} obj - the value object containing the fields and values to be updates, e.g.
     * ```
     * { NAME: 'NewName', Manufacturer: 'MyCompany' }
     * ```
     * @param {callback} callback - called as callback(err, updatedObjectJson)
     * @global
     * @alias updateEntity
     */
    api_updateEntity(entityName, uuid, obj, callback) {
	const url = `rest/${entityName}/${uuid}`;
	const requestObj = {
	    method: 'PUT',
	    json: obj
	};
	this._apiCall(url, requestObj, callback);
    }

    /**
     * shortcut for updating backend system objects 
     * @see updateEntity
     * @param {string} uuid - the uuid of the object to be updated
     * @param {object} obj - the value object containing the fields and values to be updates.
     * @param {callback} callback - called as callback(err, updatedObjectJson)
     * @global
     * @alias updateBackendSystem
     */
    api_updateBackendSystem(uuid, obj, callback) {
	const entityName = 'backend_systems';
	this.api_updateEntity(entityName, uuid, obj, callback);
    }

    /**
     * shortcut for updating robot objects 
     * @see updateEntity
     * @param {string} uuid - the uuid of the object to be updated
     * @param {object} obj - the value object containing the fields and values to be updates.
     * @param {callback} callback - called as callback(err, updatedObjectJson)
     * @global
     * @alias updateRobot
     */
    api_updateRobot(uuid, obj, callback) {
	const entityName = 'robots';
	this.api_updateEntity(entityName, uuid, obj, callback);
    }

    /**
     * shortcut for updating connection/scenario objects 
     * @see updateEntity
     * @param {string} uuid - the uuid of the object to be updated
     * @param {object} obj - the value object containing the fields and values to be updates.
     * @param {callback} callback - called as callback(err, updatedObjectJson)
     * @global
     * @alias updateConnection
     */
    api_updateConnection(uuid, obj, callback) {
	const entityName = 'connections';
	this.api_updateEntity(entityName, uuid, obj, callback);
    }

    /**
     * update the internal __JSON field of the connection object
     * @param {string} uuid - the uuid of the connection object (class
     * or instance)
     * @param {jsonObject} jsonObject - the object representation of
     * the __JSON field to be updated.
     * @param {callback} callback - callback function passed through
     * to @see updateConnection
     */
    _updateConnection__JSON(uuid, jsonObject, callback) {
	try {
	    const __JSON = JSON.stringify(jsonObject);
	    this.api_updateConnection(uuid, { __JSON }, callback);
	} catch (err) {
	    let errmsg = `could not stringify JSON object: ${err}`;
	    callback(errmsg);
	}
    }

    // -----------------------------------------------------------------------------

    /**
     * creates an instance of a connection class.
     * @param {string} uuid - the uuid of a connection class object
     * @param {object|string} obj - the properties of the newly
     * created instance; must include a NAME property. If given as
     * string, it's interpreted as the NAME of the new instance.
     * @param {callback} callback - callback function, called with the
     * resulting new instance object as second argument.
     * @global
     * @alias createInstance
     */
    api_createInstance(uuid, obj, callback) {
	const cb = ensureFunction(callback);
	if (typeof obj === 'string') {
	    obj = { NAME: obj };
	}
	if (typeof obj !== 'object') {
	    const errmsg = `properties object missing for creating instance`;
	    return cb(errmsg);
	}
	const { NAME } = obj;
	if (typeof NAME !== 'string' || NAME.trim().length === 0) {
	    const errmsg = `"NAME" field not specified for new instance`;
	    return cb(errmsg);
	}
	this.api_getConnection(uuid, (err, classObj) => {
	    if (err) {
		return cb(err);
	    }
	    const { CLASS_UUID } = classObj;
	    if (CLASS_UUID) {
		const errmsg = `Can't create instance of an instance (uuid: "${uuid}", name: "${classObj.NAME}")`;
		return cb(errmsg);
	    }
	    Object.keys(classObj).forEach(key => {
		if (Settings.SystemFields.includes(key)) return;
		if (key === 'NAME') return;
		obj[key] = classObj[key];
	    });
	    obj.CLASS_UUID = uuid;
	    obj['Git Clone URL'] = '';
	    obj['Git Subfolder'] = '';
	    this.api_createConnection(obj, cb);
	})
    }

    /**
     * Instantiate a placeholder object for the connection instance with the given uuid.
     * @param {string} uuid - the uuid of the connection instance object
     * @param {string} placeholderId - the placeholderId to be instanstiated
     * @param {string} withUuid - the uuid of the object the
     * placeholder is intantiated with; if set to null, the
     * placeholder instantiation is removed.
     * @param {object} [options] - optional options object
     * @param {boolean} options.debug - debug flag
     * @param {callback} callback - the callback function call on
     * completion of the instantiation (or when an error occurred).
     * @global
     * @alias instantiatePlaceholder
     */
    api_instantiatePlaceholder(uuid, placeholderId, withUuid, optionsOrCallback, callback) {
	const cb = (typeof optionsOrCallback === 'function')
	      ? optionsOrCallback : ensureFunction(callback);
	const options = (typeof optionsOrCallback === 'object') ? optionsOrCallback : {};
	let url = `instantiate/${uuid}?placeholderId=${placeholderId}`;
	if (withUuid) {
	    url += `&withUuid=${withUuid}`;
	}
	this._apiCall(url, {}, cb);
    }
    
    // -----------------------------------------------------------------------------

    _getConnectionJSONFromObject(obj) {
	const { __JSON } = obj;
	if (!__JSON) return {}
	try {
	    const jsonObj = JSON.parse(__JSON);
	    //this.debug && console.log(`__JSON: ${JSON.stringify(jsonObj, null, 2)}`);
	    return jsonObj;
	} catch (err) {
	    return {};
	}
    }
    
    _getConnectionJSON(uuid, callback) {
	const cb = ensureFunction(callback)
	this.api_getConnection(uuid, (err, obj) => {
	    if (err) {
		return cb(err);
	    }
	    try {
		const jsonObj = this._getConnectionJSONFromObject(obj);
		cb(null, jsonObj);
	    } catch (err) {
		return cb(err);
	    }
	})
    }

    /**
     * synchronous function to retrieve the configJson from a
     * connection object returned by one the findConnection or
     * getConnection methods.
     * @param {object} obj - the object representing the connection object
     * @global
     * @alias getConfigJsonFromObject
     */
    api_getConfigJsonFromObject(obj) {
	const jsonObj = this._getConnectionJSONFromObject(obj);
	return jsonObj.configJsonObj || {};
    }

    /**
     * retrieve the config json object of the connection class or
     * instance
     * @param {string} uuid - the uuid of the connection class or instance object
     * @param {callback} callback - the callback function; config-json
     * object is passed as second parameter.
     * @global
     * @alias getConnectionConfigJson
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

    // -----------------------------------------------------------------------------

    /**
     * Updates the config-json of a connection class or instance.
     * @param {string} uuid - the uuid of a connection class or instance object
     * @param {object|string} configJson - the configJson to be updated.
     * @param {callback} callback - callback function, called with the
     * resulting new instance object as second argument.
     * @global
     * @alias updateConnectionConfigJson
     */
    api_updateConnectionConfigJson(uuid, configJson, callback) {
	this.api_getConnection(uuid, (err, obj) => {
	    if (err) {
		return callback(err);
	    }
	    const json = this.api_getConfigJsonFromObject(obj);
	    json.configJsonObj = configJson;
	    this._updateConnection__JSON(uuid, json, callback);
	})
    }
    
    /**
     * retrieve the placeholder information for the given connection
     * object. If the object refers to an connection instance,the
     * placeholders might have an "instantiatedObject" field
     * indicating the a given placeholder is instantiated.
     * @param {string} uuid - the uuid of the connection class or instance object
     * @param {callback} callback - the callback function, placeholder
     * object is passed as second parameter.
     * @global
     * @alias getConnectionPlaceholderInfo
     */
    api_getConnectionPlaceholderInfo(uuid, callback) {
	const cb = ensureFunction(callback);
	this._getConnectionJSON(uuid, (err, jsonObj) => {
	    if (err) {
		return cb(err);
	    }
	    const { placeholderObjects } = jsonObj;
	    if (!placeholderObjects) {
		return cb(null, {});
	    }
	    cb(null, placeholderObjects);
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
     * This method returns a zip-file binary containing the either the
     * code (template) of a connection class or the generated code of
     * an connection instance depending on which type of connection
     * the given uuid refers to.  The uuid given must be one of an
     * connection instance object. The method triggers the run of the
     * code generation on the given instance and returns the entire
     * folder structure in the zip-binary.
     * @param {string} classOrInstanceUuid - the uuid of the
     * connection class or instance object
     * @param {function} callback - the callback function; in this
     * case the response is a binary representing the content of a
     * zip-file.
     *
     * @global
     * @alias getCodeZip
     */
    api_getCodeZip(classOrInstanceUuid, callback) {
	const cb = ensureFunction(callback);

	const _doGetCodeZip = (classObject, instanceUuid) => {
	    const { UUID, NAME, ISLOCAL } = classObject;
	    //console.log(JSON.stringify(classObject, null, 2));
	    const isLocal = !!ISLOCAL;
	    const gitUrl = classObject['Git Clone URL'];
	    const gitSubfolder = classObject['Git Subfolder'];
	    if (!isLocal && !gitUrl) {
		return cb(`no gitUrl found in class object with uuid ${UUID}`);
	    }
	    const url = 'git/createzip';
	    const json = { instanceUuid, gitUrl, gitSubfolder, uuid: UUID, name: NAME, isLocal };
	    const method = 'POST';
	    const requestObj = { method, json };
	    const returnResultAsIs = true;
	    const dontProcessRequestObject = true;
	    const options = { returnResultAsIs, dontProcessRequestObject };
	    this._apiCall(url, requestObj, cb, options);
	};
	
	this.api_getConnection(classOrInstanceUuid, (err, obj) => {
	    if (err) {
		return cb(err);
	    }
	    if (obj.CLASS_UUID) {
		let instanceUuid = obj.UUID
		this._getConnectionClassForInstanceUuid(instanceUuid, (err, classObject) => {
		    if (err) {
			return cb(err);
		    }
		    _doGetCodeZip(classObject, instanceUuid);
		});
	    } else {
		let classObject = obj;
		let instanceUuid = null;
		_doGetCodeZip(classObject, instanceUuid);
	    }
	});

    }

    api_hasCodeOnServer(connectionObj) {
	return !connectionObj.ISLOCAL;
    }

    _isLocalScenario(connectionObj) {
	return !!connectionObj.ISLOCAL;
    }

    _isScenarioInstance(connectionObj) {
	return !!connectionObj.CLASS_UUID;
    }

    _isScenarioClass(connectionObj) {
	return !connectionObj.CLASS_UUID;
    }

    _isLocalScenarioClass(connectionObj) {
	return this._isLocalScenario(connectionObj) && this._isScenarioClass(connectionObj);
    }

    _isLocalScenarioInstance(connectionObj) {
	return this._isLocalScenario(connectionObj) && this._isScenarioInstance(connectionObj);
    }

    /**
     * This method is used to download the code part of a connection
     * object into a local folder.  In case of a connection class it
     * downloads the code template file tree, in case of a connection
     * instance, it runs the code generation and downloads the
     * resulting generated code.
     * @param {string} uuid - the uuid of the connection object, which
     * can be either a class or an instance.
     * @param {string} targetFolder - the local folder into which the
     * code is downloaded.
     * @param {object} [options]
     * @param {object} options.sourceFolderInfo - information about
     * the local source folder, from where code is copied over in case
     * the connection object is a scenario instance and is marked as
     * "ISLOCAL" on the server (Note that all scenarios created
     * through the API/CLI are by default marked as "ISLOCAL".) In
     * this case, this field is actually required, otherwise the
     * operation will fail.
     * @param {string} options.sourceFolderInfo.folder - the name of
     * an existing folder on the local machine that contains the
     * scenario class code
     * @param {string} options.sourceFolderInfo.uuid - the UUID of the
     * scenario class the code of which is stored in the scenario
     * class folder; it must match the instance's class's uuid.
     * @param {callback} callback - callback called on completion of
     * the operation.
     * @global
     * @alias downloadCode
     */
    api_downloadCode(uuid, targetFolder, optionsOrCallback, callback) {
	const cb = (typeof optionsOrCallback === 'function')
	      ? optionsOrCallback : ensureFunction(callback);
	const options = (typeof optionsOrCallback === 'object') ? optionsOrCallback : {};
	const { dryRun, debug, deleteFilter, clearFolder, sourceFolderInfo } = options;

	const getSourceCodeFolder = (cb1) => {
	    this.api_getConnection(uuid, (err, cobj) => {
		if (err) {
		    return cb1(err);
		}
		let { NAME, CLASS_UUID } = cobj;
		if (this._isLocalScenarioClass(cobj)) {
		    let msg = `scenario classes "${cobj.NAME}" is marked as "local";`
			+` code download is not supported for this kind of scenario classes`;
		    return cb1(msg);
		}
		if (this._isLocalScenarioInstance(cobj)) {
		    if (typeof sourceFolderInfo !== 'object') {
			let msg = `scenario instance "${NAME} is marked as "local" and `
			    + `therefore requires "sourceFolderInfo" to be specified, which `
			    + `is missing from the options argument`;
			return cb1(msg);
		    }
		    let { folder, uuid } = sourceFolderInfo;
		    if (typeof folder !== 'string') {
			let msg = "sourceFolderInfo is missing the \"folder\" field that is "
			    + "supposed to contain the name of the source code folder.";
			return cb1(msg);
		    }
		    if (typeof uuid !== 'string') {
			let msg = "sourceFolderInfo is missing the \"uuid\" field that is "
			    + "supposed to contain the uuid of the instance's scenario class";
			return cb1(msg);
		    }
		    if (CLASS_UUID !== uuid) {
			let msg = `the uuid given as part of sourceFolderInfo doesn't match `
			    + `that of scenario instance ${NAME}'s scenario class`;
			return cb1(err);
		    }
		    return cb1(null, folder);
		}
		return cb1(null, null);
	    });
	}
	
	const getCodeFromServer = (clearFolder) => {
	    this.api_getCodeZip(uuid, (err, buf) => {
		if (err) {
		    return cb(err);
		}
		ZipFile.loadFromBuffer(buf, (err, zipFile) => {
		    if (err) {
			return cb(err);
		    }
		    const options = { dryRun, debug, clearFolder, deleteFilter };
		    zipFile.extractToFolder(targetFolder, options, err => {
			if (err) {
			    return cb(err);
			}
			cb(null, `code extracted to folder ${targetFolder}`
			   + (dryRun ? " [nothing done, dryRun flag is set]" : ""));
		    });
		});
	    });
	}

	getSourceCodeFolder((err, sourceFolder) => {	
	    // if sourceFolder is specified, copy the content of it first into target folder
	    // and then the downloaded files
	    if (err) {
		return cb(err);
	    }
	    if (typeof sourceFolder === 'string') {
		const srcZip = new ZipFile();
		try {
		    //console.log('copying local files...');
		    let addFolderOptions = {};
		    srcZip.addFolderRecursively(sourceFolder, sourceFolder, addFolderOptions);
		    let options = { dryRun, debug, clearFolder, deleteFilter };
		    srcZip.extractToFolder(targetFolder, options, err => {
			//console.log('copying local files done.');
			if (err) {
			    return cb(err);
			}
			getCodeFromServer(false);
		    });
		} catch (err) {
		    console.error(err);
		    return cb(err);
		}
	    } else {
		getCodeFromServer(true);
	    }
	});
    };

    /**
     * Uploads the zip-file for the given connection class
     */
    api_postCodeZip(uuid, callback) {
	const cb = ensureFunction(callback);
	const url = `binary/zip/${uuid}`;
	const testFile = '/tmp/foo.zip';
	const { createReadStream } = require('fs');
	const getReadStream = () => {
	    this.debug && console.log('(re)creating read stream for request...');
	    return createReadStream(testFile);
	};
	this._apiCallUploadBinary(url, getReadStream, (err, res) => {
	    if (err) {
		console.error(`ERROR: ${err}`)
		return cb(err);
	    }
	    this.debug && console.log(`upload successful.`);
	    cb(null, res);
	});
    }

    /**
     * Uploads the contens of the sourceFolder into the code folder of
     * the connection class object with the given uuid.
     * @param {string} uuid - the uuid of the connection class object
     * @param {string} sourceFolder - the local source folder the
     * content of which is uploaded to the server
     * @param {object} [options] - optional options, see below
     * @param {boolean} options.dryRun - dry-run flag, if set to true, nothing is uploaded
     * @param {debug} options.debug - if true, shows debug messages on the console
     * @param {function} options.filterFunction - filter function for
     * file names to include in the upload; it's run on the basename
     * of the file (not the full path). By default, files and folders
     * named ".git" and "node_modules" are ommited from the upload.
     * @param {callback} callback - callback called on termination/failure of the operation
     * 
     * @global
     * @alias uploadCodeTemplate
     */
    api_uploadCodeTemplate(uuid, sourceFolder, optionsOrCallback, callback) {
	const cb = (typeof optionsOrCallback === 'function')
	      ? optionsOrCallback : ensureFunction(callback);
	const options = (typeof optionsOrCallback === 'object') ? optionsOrCallback : {};
	const { dryRun, debug } = options;
	debug && console.log(`uploading code from folder "${sourceFolder}"...`);

	const _checkIsLocal = cb1 => {
	    this.api_getConnection(uuid, (err, cobj) => {
		if (err) {
		    return cb1(err);
		}
		let { NAME, UUID } = cobj;
		if (!this._isScenarioClass(cobj)) {
		    let msg = `"${NAME}" is not a scenario class; code upload not supported.`;
		    return cb1(msg);
		}
		cb1(null, this._isLocalScenario(cobj))
	    });
	};
	
	const _doUpload = isLocal => {
	    const zip = new ZipFile();
	    if (isLocal) {
		options.whitelistFileFilterFunction = fileContainsPreprocessorSyntax;
		options.debug = false;
	    }
	    let filesAdded = [];
	    try {
		options.filesAdded = filesAdded;
		zip.addFolderRecursively(sourceFolder, sourceFolder, options);
	    } catch (err) {
		return cb(err);
	    }
	    const url = `binary/zip/${uuid}`;
	    const getReadStream = () => {
		this.debug && console.log('(re)creating zip read stream for request...');
		return zip.getReadStream();
	    };
	    if (dryRun) {
		cb(null, 'dryRun, nothing uploaded.');
		return;
	    }
	    this._apiCallUploadBinary(url, getReadStream, (err, res) => {
		if (err) {
		    console.error(`ERROR: ${err}`)
		    return cb(err);
		}
		debug && console.log(`upload successful.`);
		cb(null, filesAdded);
	    });
	};

	_checkIsLocal((err, isLocal) => {
	    if (err) {
		return cb(err);
	    }
	    _doUpload(isLocal);
	});
    }
}

// ---------------------------------------------------------------------------------

/** @ignore */
const ensureFunction = callback => (
    (typeof callback === 'function') ? callback : (() => {})
)

/** @ignore */
const shallowCopy = obj => {
    const cobj = {};
    Object.keys(obj).forEach(key => cobj[key] = obj[key]);
    return cobj;
}

// ---------------------------------------------------------------------------------
    


/**
 * @name rose-api
 * @module
 * @description
 *
 * ## Rose API module
 *
 * The rose-api module exports nodejs functions to access the
 * different functionality offered by the RoseStudio environment.
 * 
 * ### Callback functions used in the API
 * 
 * All callback functions used in this API are expected to follow the
 * commonly used nodejs callback function signature
 *
 * ```
 * (err, result) => {
 *     if (err) {
 *       // do error handling
 *      return;
 *     }
 *     // happy path: process the result parameter
 * }
 * ```
 * 
 * with the first parameter being the error parameter, which is
 * passed as a non-null value in case an * error is reported.
 *
 * Note that, in some case, the description of the API method includes
 * the phrase "returns _xyz_", which actually means that the callback
 * function is invoked with _xyz_ as `result` parameter on successful
 * completion of the operation.
 * 
 * @author Asuman Suenbuel
 */

module.exports = { RoseAPI };

/**
 * The format of callback function used in the API methods
 * @alias module:rose-api#callback
 * @callback callback
 * @param {(string|object)} err The err as returned by the API method, or null if no error occurred.
 * @param {object} response the response object generated by the API method.
 */

/**
 * The possible values for an entity name in RoseAPI calls.
 * @typedef {string} entityName
 * @property {string} 'backend_systems' entity name for backend systems
 * @property {string} 'robots' entity name for robots
 * @property {string} 'connections' entity name for connections (classes and instances)
 * @alias module:rose-api#entityName
 */

