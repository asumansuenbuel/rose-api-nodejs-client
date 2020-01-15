/**
 * utility functions used in server implementation
 *
 */

const { join, isAbsolute, resolve, sep, basename, dirname } = require('path');
const { mkdirSync, rmdir, existsSync, readdirSync, lstatSync, unlink } = require('fs')
const { inred, ingreen, inblue, inyellow, inblack, inmagenta, incyan } = require('./colorize');

const config = require('./config')
const isBinaryFile = require('isbinaryfile');

/**
 * determines whether the value needs to be quoted or not for
 * constructing the db query depending on the dbType.
 * @param {Any} value the value in question to be quoted or not
 * @param {string} the db type as returned from metadata query on the table (all caps)
 */
const quoteColumnValue = (value, dbType, quoteSymbol = "'") => {
    const _quoteValue = () => `${quoteSymbol}${value}${quoteSymbol}`
    let index = dbType.indexOf('(')
    let dbTypePrefix = index < 0 ? dbType : dbType.substr(0, index)
    switch (dbTypePrefix) {
    case 'VARCHAR':
    case 'NVARCHAR':
    case 'ALPHANUM':
    case 'SHORTTEXT':
	return _quoteValue()
    default:
	return value
    }
}

/**
 * allows for specifying a typeName using the simplified format as specified in the DbTables config.
 * If no match is found then the typeName itself is returned
 * @param {string} typeName
 * @returns {string} Hana type name
 */
const getDbType = typeName => {
    for(let i = 0; i < config.DbTypes.length; i++) {
	let typeInfo = config.DbTypes[i]
	if (typeInfo.name === typeName) {
	    return typeInfo.dbType
	}
    }
    return typeName
}


/**
 * @returns a random uuid
 */
const generateUuid = () => {
    const s4 = () => {
	return Math.floor((1 + Math.random()) * 0x10000)
	    .toString(16)
	    .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
	s4() + '-' + s4() + s4() + s4();
}

/**
 * inserts the element into the list, if it isn't in there yet
 * @param {Array} list
 * @param {Any} elem
 */
const insertNew = (list, elem) => {
    if (!list) return
    if (!(list instanceof Array)) return
    if (list.indexOf(elem) < 0) {
	list.push(elem)
    }
}

const removeElement = (list, elem) => {
    var index = list.indexOf(elem)
    if (index >= 0) list.splice(index,1)
    return list
}

const mkdirRecursiveSync = function(targetDir, { isRelativeToScript = false } = {}) {
    const initDir = isAbsolute(targetDir) ? sep : '';
    const baseDir = isRelativeToScript ? __dirname : '.';

    return targetDir.split(sep).reduce((parentDir, childDir) => {
	const curDir = resolve(baseDir, parentDir, childDir);
	try {
	    mkdirSync(curDir);
	} catch (err) {
	    if (err.code === 'EEXIST') { // curDir already exists!
		return curDir;
	    }

	    // To avoid `EISDIR` error on Mac and `EACCES`-->`ENOENT` and `EPERM` on Windows.
	    if (err.code === 'ENOENT') { // Throw the original parentDir error on curDir `ENOENT` failure.
		throw new Error(`EACCES: permission denied, mkdir '${parentDir}'`);
	    }

	    const caughtErr = ['EACCES', 'EPERM', 'EISDIR'].indexOf(err.code) > -1;
	    if (!caughtErr || caughtErr && targetDir === curDir) {
		throw err; // Throw if it's just the last created dir.
	    }
	}

	return curDir;
    }, initDir);
}

/**
 * returns the JSON for the given file system tree
 * @param {string} path
 * @param {function} options.fileFilter [optional]
 * @param {function} options.getFileRef [optional]
 */
const _getFolderTreeJson = (path, options) => {
    console.log(`in getFolderTreeJson, path: ${path}`)
    const fileFilter = fname => {
	if (fname === '.git') return false
	if (options && (options.fileFilter === 'function')) {
	    return fileFilter(fname)
	}
	return true
    }
    const getFileRef = path => {
	if (lstatSync(path).isDirectory()) {
	    return "sap-icon://folder"
	}
	return "sap-icon://document"
    }
    const jsonObj = []
    if (existsSync(path) && lstatSync(path).isDirectory()) {
	const filesInFolder = readdirSync(path).filter(fileFilter)
	//console.log(filesInFolder)
	filesInFolder.forEach(fname => {
	    let fpath = join(path, fname)
	    let lstat = lstatSync(fpath)
	    let kind = lstat.isDirectory()
		? 'directory'
		: lstat.isSymbolicLink()
		? 'link'
		: 'plain'
	    let entry = {
		name: fname,
		kind: kind,
		folderPath: path,
		dirtyIndicator: ''
	    }
	    if (kind === 'directory') {
		entry.nodes = _getFolderTreeJson(fpath)
	    }
	    jsonObj.push(entry)
	})
    } else {
    }
    //console.log(`returning ${jsonObj}`)
    return jsonObj
}

const getFolderTreeJson = (path, options) => {
    const opts = options ? options : {}
    const folderPath = dirname(path)
    const name = basename(path)
    const nodes = _getFolderTreeJson(path, options)
    const rootLabel = opts.rootLabel ? opts.rootLabel : 'FILES'
    const toplevelNode = {
	name: name,
	label: rootLabel,
	kind: 'directory',
	folderPath: folderPath,
	isRoot: true,
	dirtyIndicator: '',
	nodes: nodes
    }
    return [toplevelNode]
}

/**
 * removes the contents of the folder recursively
 * @returns {function} a function that returns a Promise, that can be
 * used directly as argument to then() or PromiseChain (see below).
 */
const removeFolderRecursively = (path, options) => {
    const { removeFolderItself, dryRun, debug, deleteFilter } = options || {};
    debug && console.log(ingreen(`removeFolderRecursively("${path}")...`))
    if (!lstatSync(path).isDirectory()) {
	return new Promise((resolve, reject) => reject(`${path} is not a directory`));
    }
    const dfun = (typeof deleteFilter === 'function') ? deleteFilter : (() => true);
    const files = readdirSync(path).filter(dfun);
    debug && console.log(`files: ${files}`);
    const promises = files.map(filename => {
	let filePath = join(path, filename);
	if (lstatSync(filePath).isDirectory()) {
	    const removeFolderItself = true;
	    return removeFolderRecursively(filePath, { removeFolderItself, dryRun });
	} else {
	    let p = () => new Promise((resolve, reject) => {
		if (dryRun) {
		    debug && console.log(`dryRun: would delete file "${filePath}"`);
		    return resolve(filePath);
		}
		unlink(filePath, err => {
		    if (err) {
			debug && console.log(inred(`unlink error: ${err}`));
			return reject(err);
		    }
		    debug && console.log(inyellow(`removeFolderRecursively: deleted ${filePath}`))
		    resolve(filePath);
		});
	    });
	    return p;
	}
    });
    if (removeFolderItself) {
	let rmdirp = () => new Promise((resolve, reject) => {
	    if (dryRun) {
		debug && console.log(`dryRun: would delete folder "${path}"`);
		return resolve(path);
	    }
	    debug && console.log(inblue(`trying to delete folder ${basename(path)}...`));
	    rmdir(path, err => {
		if (err) {
		    debug && console.log(inred(`folder deletion error: ${err}`));
		    //let files0 = readdirSync(path);
		    //console.log(`   files in folder: ${files0}`);
		    return reject(err);
		}
		debug && console.log(inyellow(`removeFolderRecursively: deleted folder ${path}`));
		resolve(path);
	    })
	})
	promises.push(rmdirp);
    }
    return () => PromiseChain(promises);
}

const stringContainsPreprocessorSyntax = string => {
    const jsLineRe = new RegExp('^\\s*//!\\s*(.*)\\s*$');
    const substRe = new RegExp(/\$(\$\{[^\}]*\})/);
    if (typeof string !== 'string') return false;
    const lines = string.split("\n");
    for(let i = 0; i < lines.length; i++) {
	let line = lines[i];
	if (line.match(jsLineRe)) return true;
	if (line.match(substRe)) return true;
    }
    return false;
}

const fileContainsPreprocessorSyntax = filename => {
    try {
	if (isBinaryFile.sync(filename)) {
	    return false;
	}
	let contents = fs.readFileSync(filename, 'utf-8');
	return stringContainsPreprocessorSyntax(contents);
    } catch (err) {
	return false;
    }
    
}

/**
 * utility to chain promises. The function takes an array of functions
 * that return a Promise object as argument and returns the chained
 * Promise object.
 * @param {[function]} array of functions, each returning a Promise object
 */
const PromiseChain = promiseFunctions => {
    return promiseFunctions.reduce((promise, promiseFunction) => {
	return promise.then(promiseFunction);
    }, Promise.resolve());
};

module.exports = {
    quoteColumnValue,
    getDbType,
    generateUuid,
    insertNew,
    removeElement,
    mkdirRecursiveSync,
    getFolderTreeJson,
    removeFolderRecursively,
    stringContainsPreprocessorSyntax,
    fileContainsPreprocessorSyntax,
    PromiseChain
}
