/**
 *
 * Helpers for rose command line interface - authenticate user
 *
 * @author Asuman Suenbuel
 */

const os = require('os');
const path = require('path');
const fs = require('fs');

const rose = require('../..');

const { cliError, cliInfo, cliWarn } = require('./cli-utils');
const { getAuthToken } = require('../../get-auth-token');

const _getTokenFilename = () => {
    return path.join(os.tmpdir(),`rose-cli-token-${process.ppid}.json`);
}

const login = (options = {}) => {
    const filename = _getTokenFilename();
    if (!options.force && fs.existsSync(filename)) {
	cliInfo('You are already logged in; use "rose login -f" to force re-login');
	return;
    }
    const callback = (err, fname) => {
	if (err) {
	    return cliError(`something went wrong trying to write tokens file: ${err}`);
	}
	cliInfo(`You are now logged into Rose in the current shell`);
    };
    getAuthToken({ filename, callback });
}

const logout = () => {
    const tokenFile = _getTokenFilename();
    try {
	fs.unlinkSync(tokenFile);
    } catch (err) {}
    cliInfo('You are now logged out of Rose.')
}

/**
 * @returns an authenticated rose module using the tokens stored during the login process
 */
const authenticatedRose = (roseOptions = {}) => {
    const tokenFile = _getTokenFilename();
    if (fs.existsSync(tokenFile)) {
	const tokens = require(tokenFile);
	return rose(tokens, roseOptions);
    } else {
	//cliWarn(`You are not logged in into Rose. Please run "rose login".`);
	return null;
    }
}

module.exports = {
    login,
    logout,
    authenticatedRose
}
