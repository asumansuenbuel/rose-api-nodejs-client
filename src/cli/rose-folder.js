/**
 * Command line interface - folder related actions
 *
 * @author Asuman Suenbuel
 */

const fs = require('fs');
const path = require('path');

const roseInitFile = 'rose.json';

class RoseFolder {

    constructor(folderName = '.') {
	this.folderName = folderName;
    }

    _init() {
	if (!fs.lstat(this.folderName).isDirectory()) {
	    throw `"${folderName} is not a directory"`;
	}
	this.settings = {}
	try {
	    this.settings = require(this.initFile);
	} catch (err) {
	}
    }

    get initFile() {
	return path.join(this.folderName, roseInitFile);
    }

}

module.exports = { RoseFolder };

