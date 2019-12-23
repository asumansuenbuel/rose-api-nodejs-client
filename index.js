/**
 * RoseAPI module main file
 *
 * @author Asuman Suenbuel
 */

const { OAuth2Client } = require('google-auth-library');
const request = require('request');

const { Server, Auth } = require('./config');

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
			    cb(null, res.body);
			})
		    })
		    .catch(err => {
			cb(err);
		    })
	    } else {
		cb(null, res.body);
	    }
	});
    }

    api_getUser(callback) {
	this._apiCall('user', {}, callback);
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


