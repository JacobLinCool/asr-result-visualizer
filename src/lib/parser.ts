export interface DataRow {
	reference: string;
	prediction: string;
}

export function parseCSV(content: string): DataRow[] {
	const lines = content.trim().split('\n');
	if (lines.length < 2) throw new Error('CSV must have at least a header row and one data row');

	const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
	const refIndex = header.findIndex(
		(h) => h.includes('ref') || h.includes('ground') || h.includes('truth')
	);
	const predIndex = header.findIndex(
		(h) => h.includes('pred') || h.includes('hyp') || h.includes('hypothesis')
	);

	if (refIndex === -1 || predIndex === -1) {
		throw new Error('CSV must contain columns for reference and prediction');
	}

	const data: DataRow[] = [];
	for (let i = 1; i < lines.length; i++) {
		const row = lines[i].split(',');
		if (row.length > Math.max(refIndex, predIndex)) {
			data.push({
				reference: row[refIndex]?.trim() || '',
				prediction: row[predIndex]?.trim() || ''
			});
		}
	}

	return data;
}

export function parseJSON(content: string): DataRow[] {
	const parsed = JSON.parse(content);

	if (Array.isArray(parsed)) {
		return parsed.map((item, index) => {
			if (typeof item === 'object' && item !== null) {
				const ref = item.reference || item.ref || item.ground_truth || item.truth || '';
				const pred = item.prediction || item.pred || item.hypothesis || item.hyp || '';
				return { reference: String(ref), prediction: String(pred) };
			}
			throw new Error(`Invalid data format at index ${index}`);
		});
	}

	throw new Error('JSON must be an array of objects');
}
