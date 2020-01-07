/**
 * Utilities used in Rose CLI
 *
 * @author Asuman Suenbuel
 */

const { inred, ingreen, inyellow, inmagenta, incyan } = require('../colorize');

const cliError = errmsg => {
    if (typeof errmsg === 'object') {
	try {
	    errmsg = JSON.stringify(errmsg);
	} catch (_ignore) {}
    }
    console.error(inred(`*** ${errmsg}`));
}

const cliInfo = console.log;

const cliWarn = msg => console.log(inyellow(msg));

module.exports = {
    cliError,
    cliInfo,
    cliWarn
}
