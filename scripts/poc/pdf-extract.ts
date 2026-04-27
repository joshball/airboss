/**
 * POC: extract a real cached PDF using the new @ab/sources/pdf lib.
 *
 * Target: AC 61-65J (Endorsements). Why this one:
 * - Small enough to skim by eye (684 KB)
 * - Real FAA cover page with edition slug + effective date
 * - Tabular sections (endorsement examples) -- exercises -layout mode
 * - Represents the shape Lane C (AC corpus) will need
 *
 * What we're checking:
 * 1. Does extractPdf complete without errors?
 * 2. Page count matches what pdftotext reports natively?
 * 3. Does findAcSlug pick up "AC 61-65J" from the cover page?
 * 4. Does findEffectiveDate pick up the effective date?
 * 5. What does extracted text actually look like? (cover page sample)
 * 6. Performance: how long does a real-world AC take to extract?
 */

import {
	extractPdf,
	findAcSlug,
	findAnyEditionSlug,
	findEffectiveDate,
} from '@ab/sources/pdf';

const TARGET = '/Users/joshua/Documents/airboss-handbook-cache/ac/ac-61-65-j/J/AC_61-65J.pdf';

console.log('=== PDF Extraction POC ===');
console.log(`Target: ${TARGET}`);
console.log('');

const t0 = performance.now();
const doc = extractPdf(TARGET);
const elapsed = performance.now() - t0;

console.log(`Pages extracted: ${doc.pages.length}`);
console.log(`Page count (from pdfinfo): ${doc.pageCount}`);
console.log(`Elapsed: ${elapsed.toFixed(0)}ms`);
console.log('');

console.log('=== Metadata ===');
console.log(JSON.stringify(doc.metadata, null, 2));
console.log('');

console.log('=== Page 1 (cover) -- first 1500 chars ===');
console.log(doc.pages[0]?.text.slice(0, 1500) ?? '(empty)');
console.log('');

console.log('=== Identification helpers ===');

const acSlug = findAcSlug(doc.pages.slice(0, 3));
console.log(`findAcSlug (cover pages 1-3): ${acSlug ?? '(not found)'}`);

const anySlug = findAnyEditionSlug(doc.pages.slice(0, 3));
console.log(`findAnyEditionSlug: ${JSON.stringify(anySlug)}`);

const effDate = findEffectiveDate(doc.pages.slice(0, 5));
console.log(`findEffectiveDate (pages 1-5): ${effDate ?? '(not found)'}`);

console.log('');
console.log('=== Sample: page 5 (deeper in the doc) -- first 800 chars ===');
console.log(doc.pages[4]?.text.slice(0, 800) ?? '(no page 5)');

console.log('');
console.log('=== Raw mode comparison: page 1, first 600 chars ===');
const rawDoc = extractPdf(TARGET, { mode: 'raw', firstPage: 1, lastPage: 1 });
console.log(rawDoc.pages[0]?.text.slice(0, 600) ?? '(empty)');

console.log('');
console.log('=== Done ===');
