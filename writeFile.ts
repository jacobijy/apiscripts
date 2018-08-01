import { promises as fs, mkdir, access } from 'fs';
import { dirname } from 'path';

const exists = (path: string, mode?: number) => fs.access(path, mode).then(() => true).catch(() => false);
//   '//aa//bb'

const mkdirp = async (path: string, mode?: number) => {
	const status = await exists(path, mode);
	if (!status) {
		const newStatus = await mkdirp(dirname(path), mode);
		if (newStatus) {
			await fs.mkdir(path, mode);
			return true;
		}
	}
	return status;
};

export default async function writeFile(
	path: string,
	data: any, options?: string | {
		encoding?: string;
		mode?: string | number;
		flag?: string | number;
	}) {
	try {
		await mkdirp(dirname(path));
		return await fs.writeFile(path, data, options);
	} catch (err) {
		console.log(err);
	}
}
