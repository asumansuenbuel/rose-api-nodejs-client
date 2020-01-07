/**
 * Rose Command line interface: command implementations
 *
 * @author Asuman Suenbuel
 */

const { cliInfo, cliError, cliWarn } = require('./cli-utils');
const { authenticatedRose } = require('./cli-auth');

class Commands {

    constructor(roseOptions = {}) {
	this.rose = authenticatedRose(roseOptions);
    }

    cli_user() {
	const { getUser } = this.rose;
	getUser((err, userInfo) => {
	    if (err) return cliError(err);
	    cliInfo(userInfo);
	})
    }

}

const _getRoseApiOptionsFromEnv = () => {
    const options = {};
    const { ROSE_SERVER_URL } = process.env
    if (typeof ROSE_SERVER_URL === 'string') {
	options.apiUrl = ROSE_SERVER_URL;
	options.debug = true;
    }
    return options;
}

// export all methods of the Commands class that start with "cli_"
// using the name with the "cli_" prefix removed:
const roseOptions = _getRoseApiOptionsFromEnv();
const commandsInstance = new Commands(roseOptions);
const exportsObject = {};
const proto = Object.getPrototypeOf(commandsInstance);
Object.getOwnPropertyNames(proto)
    .filter(p => (typeof proto[p] === 'function') && (p.startsWith('cli_')))
    .forEach(fn => {
	//console.log(`method found: ${fn}`);
	const cliName = fn.substring(4);
	module.exports[cliName] = (...args) => {
	    const f = commandsInstance[fn].bind(commandsInstance);
	    if (!commandsInstance.rose) return;
	    return f(...args);
	}
    });
