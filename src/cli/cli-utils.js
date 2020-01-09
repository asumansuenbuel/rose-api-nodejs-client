/**
 * Utilities used in Rose CLI
 *
 * @author Asuman Suenbuel
 */

const { inred, ingreen, inyellow, inmagenta, incyan } = require('../colorize');

const _output = msg => {
    try {
	let json = JSON.parse(msg);
	if (json.error) return json.error;
	return JSON.stringify(json, null, 2);
    } catch (err) {}
    return msg;
}

const cliError = errmsg => {
    let msg = _output(errmsg);
    console.error(inred(`*** ${msg}`));
}

const cliInfo = msg => console.log(_output(msg));

const cliWarn = msg => console.log(_output(inyellow(msg)));

module.exports = {
    cliError,
    cliInfo,
    cliWarn
}
