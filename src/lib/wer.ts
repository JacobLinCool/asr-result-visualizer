export interface WERResult {
	wer: number;
	substitutions: number;
	insertions: number;
	deletions: number;
	totalWords: number;
	substitutionRate: number;
	insertionRate: number;
	deletionRate: number;
	alignment: AlignmentResult[];
	detailedErrors: ErrorDetail[];
}

export interface AlignmentResult {
	reference: string;
	prediction: string;
	type: 'correct' | 'substitution' | 'insertion' | 'deletion';
	referencePosition?: number;
	predictionPosition?: number;
}

export interface ErrorDetail {
	type: 'substitution' | 'insertion' | 'deletion';
	referenceWord?: string;
	predictionWord?: string;
	referencePosition?: number;
	predictionPosition?: number;
}

export interface PreprocessOptions {
	lowercase: boolean;
	removePunctuation: boolean;
	removeExtraSpaces: boolean;
}

export const DEFAULT_PREPROCESS_OPTIONS: PreprocessOptions = {
	lowercase: true,
	removePunctuation: true,
	removeExtraSpaces: true
};

export function preprocessText(text: string, options: PreprocessOptions): string {
	let processed = text;

	// Convert to lowercase first
	if (options.lowercase) {
		processed = processed.toLowerCase();
	}

	// Remove punctuation but preserve word boundaries
	if (options.removePunctuation) {
		processed = processed.replace(/[^\w\s\u00C0-\u024F\u1E00-\u1EFF]/g, ' ');
	}

	// Normalize whitespace
	if (options.removeExtraSpaces) {
		processed = processed.replace(/\s+/g, ' ').trim();
	}

	return processed;
}

export function calculateWER(
	reference: string,
	prediction: string,
	preprocessOptions?: PreprocessOptions
): WERResult {
	// Apply preprocessing if options provided
	let processedRef = reference;
	let processedPred = prediction;

	if (preprocessOptions) {
		processedRef = preprocessText(reference, preprocessOptions);
		processedPred = preprocessText(prediction, preprocessOptions);
	}

	const refWords = processedRef.split(/\s+/).filter((word) => word.length > 0);
	const predWords = processedPred.split(/\s+/).filter((word) => word.length > 0);

	const { alignment, detailedErrors } = alignWordsWithPositions(refWords, predWords);

	let substitutions = 0;
	let insertions = 0;
	let deletions = 0;

	alignment.forEach((item) => {
		switch (item.type) {
			case 'substitution':
				substitutions++;
				break;
			case 'insertion':
				insertions++;
				break;
			case 'deletion':
				deletions++;
				break;
		}
	});

	const totalWords = refWords.length;
	const totalErrors = substitutions + insertions + deletions;
	const wer = totalWords > 0 ? totalErrors / totalWords : 0;

	return {
		wer,
		substitutions,
		insertions,
		deletions,
		totalWords,
		substitutionRate: totalWords > 0 ? substitutions / totalWords : 0,
		insertionRate: totalWords > 0 ? insertions / totalWords : 0,
		deletionRate: totalWords > 0 ? deletions / totalWords : 0,
		alignment,
		detailedErrors
	};
}

function alignWordsWithPositions(
	ref: string[],
	pred: string[]
): {
	alignment: AlignmentResult[];
	detailedErrors: ErrorDetail[];
} {
	const m = ref.length;
	const n = pred.length;

	// Dynamic programming table for edit distance
	const dp: number[][] = Array(m + 1)
		.fill(null)
		.map(() => Array(n + 1).fill(0));

	// Initialize base cases
	for (let i = 0; i <= m; i++) dp[i][0] = i;
	for (let j = 0; j <= n; j++) dp[0][j] = j;

	// Fill the DP table using the Wagner-Fischer algorithm
	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			if (ref[i - 1] === pred[j - 1]) {
				// Match - no cost
				dp[i][j] = dp[i - 1][j - 1];
			} else {
				// Find minimum cost operation
				const substitutionCost = dp[i - 1][j - 1] + 1;
				const deletionCost = dp[i - 1][j] + 1;
				const insertionCost = dp[i][j - 1] + 1;

				dp[i][j] = Math.min(substitutionCost, deletionCost, insertionCost);
			}
		}
	}

	// Backtrack to find alignment and detailed errors
	const alignment: AlignmentResult[] = [];
	const detailedErrors: ErrorDetail[] = [];
	let i = m,
		j = n;
	let refPos = m - 1;
	let predPos = n - 1;

	while (i > 0 || j > 0) {
		if (i > 0 && j > 0 && ref[i - 1] === pred[j - 1]) {
			// Match - words are identical
			alignment.unshift({
				reference: ref[i - 1],
				prediction: pred[j - 1],
				type: 'correct',
				referencePosition: refPos,
				predictionPosition: predPos
			});
			i--;
			j--;
			refPos--;
			predPos--;
		} else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
			// Substitution - different words at same position
			alignment.unshift({
				reference: ref[i - 1],
				prediction: pred[j - 1],
				type: 'substitution',
				referencePosition: refPos,
				predictionPosition: predPos
			});
			detailedErrors.unshift({
				type: 'substitution',
				referenceWord: ref[i - 1],
				predictionWord: pred[j - 1],
				referencePosition: refPos,
				predictionPosition: predPos
			});
			i--;
			j--;
			refPos--;
			predPos--;
		} else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
			// Deletion - word exists in reference but not in prediction
			alignment.unshift({
				reference: ref[i - 1],
				prediction: '',
				type: 'deletion',
				referencePosition: refPos,
				predictionPosition: undefined
			});
			detailedErrors.unshift({
				type: 'deletion',
				referenceWord: ref[i - 1],
				referencePosition: refPos
			});
			i--;
			refPos--;
		} else if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
			// Insertion - word exists in prediction but not in reference
			alignment.unshift({
				reference: '',
				prediction: pred[j - 1],
				type: 'insertion',
				referencePosition: undefined,
				predictionPosition: predPos
			});
			detailedErrors.unshift({
				type: 'insertion',
				predictionWord: pred[j - 1],
				predictionPosition: predPos
			});
			j--;
			predPos--;
		} else {
			// Fallback - should not happen with correct implementation
			break;
		}
	}

	return { alignment, detailedErrors };
}

/**
 * Calculate WER with default preprocessing options
 */
export function calculateWERWithDefaults(reference: string, prediction: string): WERResult {
	return calculateWER(reference, prediction, DEFAULT_PREPROCESS_OPTIONS);
}

/**
 * Get error statistics grouped by type with position information
 */
export function getErrorStatistics(werResult: WERResult) {
	const substitutionErrors = werResult.detailedErrors.filter((e) => e.type === 'substitution');
	const insertionErrors = werResult.detailedErrors.filter((e) => e.type === 'insertion');
	const deletionErrors = werResult.detailedErrors.filter((e) => e.type === 'deletion');

	return {
		substitutions: {
			count: substitutionErrors.length,
			errors: substitutionErrors,
			rate: werResult.substitutionRate
		},
		insertions: {
			count: insertionErrors.length,
			errors: insertionErrors,
			rate: werResult.insertionRate
		},
		deletions: {
			count: deletionErrors.length,
			errors: deletionErrors,
			rate: werResult.deletionRate
		},
		totalErrors: werResult.substitutions + werResult.insertions + werResult.deletions,
		accuracy: 1 - werResult.wer
	};
}

/**
 * Get alignment visualization as a formatted string
 */
export function formatAlignment(alignment: AlignmentResult[]): string {
	const refLine: string[] = [];
	const predLine: string[] = [];
	const statusLine: string[] = [];

	alignment.forEach((item) => {
		const maxLength = Math.max(item.reference.length, item.prediction.length, item.type.length);

		refLine.push(item.reference.padEnd(maxLength));
		predLine.push(item.prediction.padEnd(maxLength));

		let status = '';
		switch (item.type) {
			case 'correct':
				status = '✓';
				break;
			case 'substitution':
				status = 'S';
				break;
			case 'insertion':
				status = 'I';
				break;
			case 'deletion':
				status = 'D';
				break;
		}
		statusLine.push(status.padEnd(maxLength));
	});

	return `REF: ${refLine.join(' ')}\nHYP: ${predLine.join(' ')}\nOPS: ${statusLine.join(' ')}`;
}
