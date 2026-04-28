/**
 * Maintain `source.<ext>` symlinks alongside descriptive cached filenames.
 *
 * New corpora (aim, ac, acs) write a descriptive filename echoing the doc
 * slug, e.g. `AC_61-65J.pdf`. A `source.pdf` alias in the same directory
 * points at the descriptive file so existing readers (which look for
 * `source.<ext>`) continue to work without a migration. Regs and handbooks
 * keep `source.<ext>` as the primary filename and skip the symlink step.
 *
 * On filesystems that do not support symlinks we log and continue -- the
 * descriptive file is still present; only the alias is missing.
 */

import { existsSync, lstatSync, symlinkSync, unlinkSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { describeError } from '../../lib/error';
import type { DownloadPlan } from './plans';

export function ensureSourceSymlink(plan: DownloadPlan): void {
	if (!plan.writeSourceSymlink) return;
	const linkPath = join(dirname(plan.destPath), `source.${plan.extension}`);
	const target = basename(plan.destPath);
	if (target === `source.${plan.extension}`) return;
	if (existsSync(linkPath) || isBrokenSymlink(linkPath)) {
		try {
			unlinkSync(linkPath);
		} catch {
			// fall through; symlinkSync will throw if it cannot place the link
		}
	}
	try {
		symlinkSync(target, linkPath);
	} catch (error) {
		console.warn(`  could not create source symlink at ${linkPath}: ${describeError(error)}`);
	}
}

function isBrokenSymlink(path: string): boolean {
	try {
		const lst = lstatSync(path);
		return lst.isSymbolicLink() && !existsSync(path);
	} catch {
		return false;
	}
}
