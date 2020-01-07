/**
 * RoseAPI package index file; the api methods are implemented in src/api.js
 * 
 * 
 * @author Asuman Suenbuel
 */

const { RoseAPI } = require('./src/api');

module.exports = (tokens, options) => {
    const rose = new RoseAPI(tokens, options);
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
