import { promises as fs } from 'fs';
import { join } from 'path';

let interfaceObjText = '';
let interfaceFuncText = '';
let funcText = '';

async function getTemplates() {
	const text = await fs.readFile(join(__dirname, '../protocol/module_template.txt'), 'utf8');
	const regInt = /\%interface\%\n([\s\S]*)\%interface\%/;
	const regExp = /\%export\%\n([\s\S]*)\%export\%/;
	const regFunc = /\%function\%\n([\s\S]*)\%function\%/;
	const regObj = /\%interfaceex\%\n([\s\S]*)\%interfaceex\%/;
	return [regInt.exec(text)[1], regExp.exec(text)[1], regFunc.exec(text)[1], regObj.exec(text)[1]];
}

function ucFirst(word: string) {
	const chars = [...word];
	return chars.length > 0 ? [chars.shift().toUpperCase(), ...chars].join('') : '';
}

function pascalName(name: string) {
	return name.split('_').map((value, index) => index === 0 ? value : ucFirst(value)).join('');
}

function pascalNameAll(name: string) {
	return name.split('_').map(value => ucFirst(value)).join('');
}

function getJsType(type: string) {
	switch (type) {
		case 'int':
		case 'short':
		case 'enum':
		case 'long':
		case 'byte':
			return 'number';

		default:
			return type;
	}
}

function getObjInterface(
	obj: { [key: string]: any },
	api: { [key: string]: any },
	templates: string[],
	actionName: string,
	nameEx?: string,
	inArray?: boolean) {
	let inttemp = inArray ? templates[3] : templates[0];
	let interfaceType = '';
	let splitTag = inArray ? ';\n\t' : ', ';
	if (obj === undefined) {
		inttemp = inttemp.replace('%interfacename%', `IClass${pascalNameAll(actionName + '_' + nameEx)}`);
		inttemp = inttemp.replace('%interfacedetail%', '[key: string]: any');
		interfaceObjText += inttemp;
		return inttemp;
	}
	Object.keys(obj).map(name => {
		if (typeof obj[name] === 'string') {
			if (obj[name].startsWith('list')) {
				const regClass = /list<([^\s]*)>/;
				const className = regClass.exec(obj[name])[1];
				const listInttemp = getObjInterface(api[className], api, templates, className, '', true);
				interfaceType += `${pascalName(name)}: IClass${pascalNameAll(className)}[]${splitTag}`;
			}
			else {
				interfaceType += `${pascalName(name)}: ${getJsType(obj[name])}${splitTag}`;
			}
		}
		else {
			if (Object.keys(obj[name])[0] === 'enum') {
				interfaceType += `${pascalName(name)}: number, `;
			}
			else if (Object.keys(obj[name])[0] === 'list') {
				const listItemInt = obj[name].list;
				const listInttemp = getObjInterface(listItemInt, api, templates, actionName, name, true);
				let newName = pascalName(name);
				interfaceType += `${newName}: IArray${pascalNameAll(actionName + '_' + name)}[]${splitTag}`;
				// add new obj interface name style : IArray${pascalName(name)}
			}
		}

	});
	if (inArray) {
		inttemp = inttemp.replace('%interfacedetail%', interfaceType.substr(0, interfaceType.length - 2));
		inttemp = inttemp.replace('%interfacename%',
			`I${nameEx === '' ? 'Class' : 'Array'}${pascalNameAll(actionName + '_' + nameEx)}`);
		interfaceObjText += inttemp;
	}
	else {
		inttemp = inttemp.replace('%variablewithtype%', interfaceType.substr(0, interfaceType.length - 2));
	}
	console.log(inttemp);
	return inttemp;
}

function getFuncs(
	actionId: string,
	obj: { [key: string]: any },
	template: string,
	moduleName: string,
	actionName: string) {
	let variable = 'ids, ';
	let variableLength = 0;
	Object.keys(obj).map(name => {
		variable += pascalName(name) + ', ';
		variableLength++;
	});
	template = template.replace(/%module%/g, ucFirst(moduleName));
	template = template.replace(/%action%/g, pascalNameAll(actionName));
	variable = variable.substr(0, variable.length - 2);
	template = template.replace(/%variable%/g, variable);
	let variableEx = variableLength > 0 ? variable.replace('ids, ', '') : variable.replace('ids', '');
	template = template.replace(/%variable1%/g, variableLength > 0 ? 'socketid, ' + variableEx : 'socketid');
	template = template.replace(/%variable2%/g, `{ ${variableEx} }`);
	template = template.replace(/%action_id%/g, actionId);
	return template;
}

export default async function createModules(api: { [key: string]: any }, moduleId: string, moduleName: string) {
	const templates = await getTemplates();
	const Apis = await fs.readFile('./scripts/api.json', 'utf8');
	const apiInfo = JSON.parse(Apis);
	Object.keys(apiInfo).map(value => {
		if (Object.is(parseInt(value), NaN)) {
			console.log(pascalName(value));
		}
		else {
			const actionInfo = apiInfo[value];
			const down = actionInfo.in;
			const up = actionInfo.out;
			let inttemp = getObjInterface(up, apiInfo, templates, actionInfo.name);
			let fuctemp = getFuncs(value, up, templates[2], moduleName, actionInfo.name);
			inttemp = inttemp.replace('%action%', pascalNameAll(actionInfo.name));
			interfaceFuncText += inttemp;
			funcText += fuctemp;
		}
	});
	funcText = funcText.replace(/%module_id%/g, moduleId);
	const newModuleName = ucFirst(moduleName);
	// console.log(interfaceFuncText, '\n', interfaceObjText, '\n', funcText);
	let moduleDetail =
		`/* tslint:disable */
import { WServer } from '../..';

${interfaceObjText};

interface IModule${newModuleName} {
${interfaceFuncText}
}

const ${newModuleName}: IModule${newModuleName} = {};

${funcText}

export default ${newModuleName};
`;
	console.log(moduleDetail);
	await fs.writeFile(join(__dirname, `../modules/send/Module${newModuleName}.ts`), moduleDetail);
}
