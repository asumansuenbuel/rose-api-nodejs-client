/**
 * Rose Command line interface: command implementations
 *
 * @author Asuman Suenbuel
 */

const { cliInfo, cliError, cliWarn } = require('./cli-utils');
const { authenticatedRose } = require('./cli-auth');

const Table = require('cli-table');

class Commands {

    constructor(roseOptions = {}) {
	this.rose = authenticatedRose(roseOptions);
	this.defaultColumns = ['NAME', 'MODIFIED_TIMESTAMP'];
    }

    cli_user(options = {}) {
	const { getUser } = this.rose;
	const { short, json } = options;
	getUser((err, userInfo) => {
	    if (err) return cliError(err);
	    if (json) {
		cliInfo(userInfo)
	    } else {
		cliInfo(userInfo.email);
	    }
	})
    }
    
    cli_list(entity, namePattern = null, options = {}) {
	const { getEntities, findEntities } = this.rose;
	const entityName = _getEntityName(entity);
	const _sortByName = (obj1, obj2) => {
	    let n1 = obj1.NAME;
	    let n2 = obj2.NAME;
	    return n1 > n2 ? 1 : n2 > n1 ? -1 : 0;
	}
	const showRecords = (err, records) => {
	    if (err) return cliError(err);
	    if (options.json) {
		return cliInfo(records);
	    }
	    let columns = this.defaultColumns;
	    if (typeof options.fields === 'string') {
		columns = options.fields.split(/\s*,\s*/);
		console.log(`columns: ${columns}`)
	    }
	    const table = new Table({
		head: columns,
		chars: _plainChars
	    });
	    records.sort(_sortByName).forEach(obj => {
		let row = columns.map(key => String(obj[key]));
		table.push(row);
	    });
	    cliInfo(table.toString());
	    //cliInfo(records.map(({NAME}) => NAME).sort().join('\n'));
	};
	if (typeof namePattern === 'string') {
	    let qterm = _getQueryTermFromPattern('NAME', namePattern);
	    findEntities(entityName, qterm, showRecords);
	} else {
	    getEntities(entityName, showRecords);
	}
    }

    cli_scenarios(namePattern = null, options = {}) {
    }

}

const _getEntityName = entity => {
    const entityName = entity.toLowerCase();
    if (entityName.startsWith('robot')) return 'robots';
    if (entityName.indexOf('system') >= 0) return 'backend_systems';
    if (entityName.startsWith('connection') || entityName.startsWith('scenario')) {
	return 'connections';
    }
    return entity;
};

const _getQueryTermFromPattern = (fieldName, pattern) => {
    const qpattern = pattern.replace(/\*/g,'%').replace(/\?/g,'_');
    return { [fieldName]: { "$like": qpattern } };
};

const _plainChars = { 'top': '' , 'top-mid': '' , 'top-left': '' , 'top-right': ''
         , 'bottom': '' , 'bottom-mid': '' , 'bottom-left': '' , 'bottom-right': ''
         , 'left': '' , 'left-mid': '' , 'mid': '' , 'mid-mid': ''
         , 'right': '' , 'right-mid': '' , 'middle': '' }

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
