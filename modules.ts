import { promises as fs } from 'fs';
import { join } from 'path';

let interfaceObjText = '';

export async function getTemplates() {
	const text = await fs.readFile(join('', './protocol/module_template.txt'), 'utf8');
	const regInt = /\%interface\%\n([\s\S]*)\%interface\%/;
	const regExp = /\%export\%\n([\s\S]*)\%export\%/;
	const regFunc = /\%function\%\n([\s\S]*)\%function\%/;
	const regObj = /\%interfaceex\%\n([\s\S]*)\%interfaceex\%/;
	let textInt = regInt.exec(text);
	let textExp = regExp.exec(text);
	let textFunc = regFunc.exec(text);
	let textObj = regObj.exec(text);
	console.log(textInt, textExp, textFunc, textObj);
	return [textInt[1], textExp[1], textFunc[1], textObj[1]];
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

/**
 * 获取特殊对象
 * @param obj in|out详细内容
 * @param api api配置文件
 * @param templates 文档模板
 * @param actionName action名称
 * @param interfaceText 特殊对象interface
 * @param nameEx 额外取名
 * @param inArray 是否在数组中
 */
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

/**
 * 自动生成协议module的ts文件中的function内容
 * @param actionId 协议的actionId
 * @param obj Object of func
 * @param template 模板
 * @param moduleName 协议的module名称
 * @param actionName 协议的action名称
 */
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

export default async function createModules(
	api: { [key: string]: any },
	moduleId: string,
	moduleName: string,
	templates: string[]) {
	let interfaceFuncText = '';
	let funcText = '';
	interfaceObjText = '';
	// const apiInfo = JSON.parse(Apis);
	Object.keys(api).map(value => {
		if (Object.is(parseInt(value), NaN)) {
			console.log(pascalName(value));
		}
		else {
			const actionInfo = api[value];
			const down = actionInfo.in;
			const up = actionInfo.out;
			let inttemp = getObjInterface(up, api, templates, actionInfo.name);
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

${interfaceObjText}

class Module${newModuleName} {
${interfaceFuncText}}

const ${newModuleName}: Module${newModuleName} = new Module${newModuleName}();

${funcText}

export default ${newModuleName};
`;
	console.log(moduleDetail);
	await fs.writeFile(join('.', `./modules/send/Module${newModuleName}.ts`), moduleDetail);
}
