/**
 * RoseAPI module main file
 *
 * @author Asuman Suenbuel
 */

const { OAuth2Client } = require('google-auth-library');
const request = require('request');

const { Server, Auth } = require('./config');

const RoseJsonDecorator = '%JSN';

class RoseAPI {
    
    constructor(tokens, apiUrl = Server.ApiUrl) {
	this.tokens = tokens
	this.apiUrl = apiUrl
    }

    _getOauth2Client() {
	const { access_token, refresh_token } = this.tokens;
	const oAuth2Client = new OAuth2Client(Auth.GoogleClientId, Auth.GoogleClientSecret);
	oAuth2Client.setCredentials({ access_token, refresh_token });
	return oAuth2Client;
    }

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
     */
    _getUrl(...pathElements) {
	return `${this.apiUrl}${Server.ApiPath}/${pathElements.join('/')}`;
    }

    /**
     * makes an authorized api call to the given path; retries the call if
     * access token is expired by getting a freshed token from the oauth2
     * endpoint.
     */
    _apiCall(path, requestObject, callback) {
	const url = this._getUrl(path);
	const bearer = this.tokens.access_token;
	const auth = { bearer };
	const cb = (typeof callback === 'function') ? callback : (() => {})
	requestObject.url = url;
	requestObject.auth = auth;
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
		return jsonResult(res.body);
	    }
	    cb(res.body);
	}
	
	stringifyJsonFields();
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

    api_getUser(callback) {
	this._apiCall('user', {}, callback);
    }

    api_getEntities(entityName, callback) {
	this._apiCall(`rest/${entityName}`, {}, callback);
    }

    api_getEntity(entityName, uuid, callback) {
	this._apiCall(`rest/${entityName}/${uuid}`, {}, callback);
    }

    api_getBackendSystems(callback) {
	this.api_getEntities('backend_systems', callback);
    }

    api_getRobots(callback) {
	this.api_getEntities('robots', callback);
    }

    api_getConnections(callback) {
	this.api_getEntities('connections', callback);
    }

    api_getConnectionClasses(callback) {
	const cb = (typeof callback === 'function') ? callback : (() => {});
	this.api_getConnections((err, connections) => {
	    if (err) {
		return cb(err);
	    }
	    cb(null, connections.filter(conn => !conn.CLASS_UUID));
	});
    }

    api_updateEntity(entityName, uuid, obj, callback) {
	const url = `rest/${entityName}/${uuid}`;
	const requestObj = {
	    method: 'PUT',
	    json: obj
	};
	this._apiCall(url, requestObj, callback);
    }

}


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


