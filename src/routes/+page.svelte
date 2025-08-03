<script lang="ts">
	import { parseCSV, parseJSON, type DataRow } from '$lib/parser';
	import {
		calculateWER,
		preprocessText,
		type WERResult,
		type PreprocessOptions,
		type AlignmentResult,
		type ErrorDetail
	} from '$lib/wer';

	let files: FileList | undefined = $state();
	let data: DataRow[] = $state([]);
	let results: (WERResult & { index: number })[] = $state([]);
	let overallStats = $state({
		wer: 0,
		substitutionRate: 0,
		insertionRate: 0,
		deletionRate: 0,
		totalSamples: 0
	});

	let preprocessOptions: PreprocessOptions = $state({
		lowercase: false,
		removePunctuation: false,
		removeExtraSpaces: true
	});

	let showResults = $state(false);
	let error = $state('');
	let showCompactView = $state(false);

	async function handleFileUpload() {
		if (!files || files.length === 0) return;

		error = '';
		const file = files[0];
		const content = await file.text();

		try {
			if (file.name.endsWith('.csv')) {
				data = parseCSV(content);
			} else if (file.name.endsWith('.json')) {
				data = parseJSON(content);
			} else {
				throw new Error('Unsupported file format. Please use CSV or JSON.');
			}

			if (data.length === 0) {
				throw new Error('No valid data found in file.');
			}

			calculateResults();
		} catch (e) {
			error = e instanceof Error ? e.message : 'An error occurred while parsing the file.';
			data = [];
			results = [];
			showResults = false;
		}
	}

	function calculateResults() {
		results = data.map((row, index) => {
			const wer = calculateWER(row.reference, row.prediction, preprocessOptions);
			return { ...wer, index };
		});

		// Calculate overall statistics
		const totalWords = results.reduce((sum, r) => sum + r.totalWords, 0);
		const totalSubs = results.reduce((sum, r) => sum + r.substitutions, 0);
		const totalIns = results.reduce((sum, r) => sum + r.insertions, 0);
		const totalDel = results.reduce((sum, r) => sum + r.deletions, 0);

		overallStats = {
			wer: totalWords > 0 ? (totalSubs + totalIns + totalDel) / totalWords : 0,
			substitutionRate: totalWords > 0 ? totalSubs / totalWords : 0,
			insertionRate: totalWords > 0 ? totalIns / totalWords : 0,
			deletionRate: totalWords > 0 ? totalDel / totalWords : 0,
			totalSamples: results.length
		};

		showResults = true;
	}

	function onPreprocessChange() {
		if (data.length > 0) {
			calculateResults();
		}
	}

	function formatPercentage(value: number): string {
		return (value * 100).toFixed(2) + '%';
	}

	function getSubstitutions(): { reference: string; prediction: string; count: number }[] {
		const substitutions = results.flatMap((r) =>
			r.alignment.filter((a) => a.type === 'substitution')
		);
		const counts = new Map<string, { reference: string; prediction: string; count: number }>();

		substitutions.forEach((sub) => {
			const key = `${sub.reference} -> ${sub.prediction}`;
			if (counts.has(key)) {
				counts.get(key)!.count++;
			} else {
				counts.set(key, { reference: sub.reference, prediction: sub.prediction, count: 1 });
			}
		});

		return Array.from(counts.values()).sort((a, b) => b.count - a.count);
	}

	function getInsertions(): { word: string; count: number }[] {
		const insertions = results.flatMap((r) => r.alignment.filter((a) => a.type === 'insertion'));
		const counts = new Map<string, number>();

		insertions.forEach((ins) => {
			const word = ins.prediction;
			counts.set(word, (counts.get(word) || 0) + 1);
		});

		return Array.from(counts.entries())
			.map(([word, count]) => ({ word, count }))
			.sort((a, b) => b.count - a.count);
	}

	function getDeletions(): { word: string; count: number }[] {
		const deletions = results.flatMap((r) => r.alignment.filter((a) => a.type === 'deletion'));
		const counts = new Map<string, number>();

		deletions.forEach((del) => {
			const word = del.reference;
			counts.set(word, (counts.get(word) || 0) + 1);
		});

		return Array.from(counts.entries())
			.map(([word, count]) => ({ word, count }))
			.sort((a, b) => b.count - a.count);
	}

	function renderAlignmentWord(
		word: string,
		type: string,
		isReference: boolean,
		position?: number
	): string {
		if (!word) return '';

		const positionText = position !== undefined ? ` (pos: ${position})` : '';

		if (type === 'deletion' && isReference) {
			return `<span class="bg-red-200 text-red-800 px-1 rounded tooltip" data-tip="Deletion${positionText}">${word}</span>`;
		} else if (type === 'insertion' && !isReference) {
			return `<span class="bg-green-200 text-green-800 px-1 rounded tooltip" data-tip="Insertion${positionText}">${word}</span>`;
		} else if (type === 'substitution') {
			return `<span class="bg-yellow-200 text-yellow-800 px-1 rounded tooltip" data-tip="Substitution${positionText}">${word}</span>`;
		}
		return word;
	}

	function renderAlignment(alignment: AlignmentResult[], isReference: boolean): string {
		return alignment
			.map((item) => {
				const word = isReference ? item.reference : item.prediction;
				const position = isReference ? item.referencePosition : item.predictionPosition;
				return renderAlignmentWord(word, item.type, isReference, position);
			})
			.filter((w) => w)
			.join(' ');
	}

	function renderCompactAlignment(alignment: AlignmentResult[]): string {
		return alignment
			.map((item) => {
				if (item.type === 'correct') {
					return item.reference;
				} else if (item.type === 'substitution') {
					return `<span class="bg-yellow-200 text-yellow-800 px-1 rounded tooltip" data-tip="Substitution">${item.reference}->${item.prediction}</span>`;
				} else if (item.type === 'deletion') {
					return `<span class="bg-red-200 text-red-800 px-1 rounded tooltip" data-tip="Deletion">${item.reference}</span>`;
				} else if (item.type === 'insertion') {
					return `<span class="bg-green-200 text-green-800 px-1 rounded tooltip" data-tip="Insertion">${item.prediction}</span>`;
				}
				return '';
			})
			.filter((w) => w)
			.join(' ');
	}
</script>

<div class="container mx-auto max-w-6xl p-6">
	<h1 class="mb-8 text-center text-4xl font-bold">ASR Result Visualizer</h1>

	<!-- File Upload Section -->
	<div class="card mb-6 bg-base-100 shadow-xl">
		<div class="card-body">
			<h2 class="card-title">Upload Data</h2>
			<p class="mb-4 text-base-content/70">
				Upload a CSV or JSON file containing ASR predictions and ground truth references.
			</p>

			<div class="form-control">
				<label class="label" for="file-input">
					<span class="label-text">Choose file (CSV or JSON)</span>
				</label>
				<input
					id="file-input"
					type="file"
					accept=".csv,.json"
					class="file-input-bordered file-input w-full"
					bind:files
					onchange={handleFileUpload}
				/>
			</div>

			{#if error}
				<div class="mt-4 alert alert-error">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6 shrink-0 stroke-current"
						fill="none"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<span>{error}</span>
				</div>
			{/if}
		</div>
	</div>

	{#if data.length === 0}
		<!-- show the prompt for user to transform there data into we need -->
		<div class="card mb-6 bg-base-100 shadow-xl">
			<div class="card-body">
				<h2 class="card-title">Transform Your Data</h2>
				<p class="mb-4 text-base-content/70">
					Please transform your data into the required format before uploading. You can use the
					following prompt to help you transform your data:
				</p>
				<code class="rounded p-4">
					<pre>Transform my data into CSV with the following columns:
- ref: The ground truth text.
- pred: The ASR system's predicted text.
Ensure that each row corresponds to a single sample.</pre>
				</code>
			</div>
		</div>
	{/if}

	<!-- Preprocessing Options -->
	{#if data.length > 0}
		<div class="card mb-6 bg-base-100 shadow-xl">
			<div class="card-body">
				<h2 class="card-title">Preprocessing Options</h2>
				<div class="flex flex-wrap gap-4">
					<label class="label cursor-pointer">
						<input
							type="checkbox"
							class="checkbox checkbox-primary"
							bind:checked={preprocessOptions.lowercase}
							onchange={onPreprocessChange}
						/>
						<span class="label-text ml-2">Convert to lowercase</span>
					</label>

					<label class="label cursor-pointer">
						<input
							type="checkbox"
							class="checkbox checkbox-primary"
							bind:checked={preprocessOptions.removePunctuation}
							onchange={onPreprocessChange}
						/>
						<span class="label-text ml-2">Remove punctuation</span>
					</label>

					<label class="label cursor-pointer">
						<input
							type="checkbox"
							class="checkbox checkbox-primary"
							bind:checked={preprocessOptions.removeExtraSpaces}
							onchange={onPreprocessChange}
						/>
						<span class="label-text ml-2">Remove extra spaces</span>
					</label>
				</div>
			</div>
		</div>
	{/if}

	<!-- Results Section -->
	{#if showResults}
		<!-- Overall Statistics -->
		<div class="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
			<div class="stat rounded-lg bg-base-100 shadow-xl">
				<div class="stat-title">Word Error Rate</div>
				<div class="stat-value text-error">{formatPercentage(overallStats.wer)}</div>
				<div class="stat-desc">{overallStats.totalSamples} samples</div>
			</div>

			<div class="stat rounded-lg bg-base-100 shadow-xl">
				<div class="stat-title">Substitution Rate</div>
				<div class="stat-value text-warning">{formatPercentage(overallStats.substitutionRate)}</div>
			</div>

			<div class="stat rounded-lg bg-base-100 shadow-xl">
				<div class="stat-title">Insertion Rate</div>
				<div class="stat-value text-success">{formatPercentage(overallStats.insertionRate)}</div>
			</div>

			<div class="stat rounded-lg bg-base-100 shadow-xl">
				<div class="stat-title">Deletion Rate</div>
				<div class="stat-value text-error">{formatPercentage(overallStats.deletionRate)}</div>
			</div>
		</div>

		<!-- Error Type Tables -->
		<div class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
			<!-- Substitutions -->
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body">
					<h3 class="card-title text-warning">Substitutions</h3>
					<div class="max-h-64 overflow-x-auto">
						<table class="table-pin-rows table table-zebra">
							<thead>
								<tr>
									<th>Reference</th>
									<th>Prediction</th>
									<th>Count</th>
								</tr>
							</thead>
							<tbody>
								{#each getSubstitutions().slice(0, 50) as sub}
									<tr>
										<td class="font-mono">{sub.reference}</td>
										<td class="font-mono">{sub.prediction}</td>
										<td class="text-sm font-semibold">{sub.count}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>

			<!-- Insertions -->
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body">
					<h3 class="card-title text-success">Insertions</h3>
					<div class="max-h-64 overflow-x-auto">
						<table class="table-pin-rows table table-zebra">
							<thead>
								<tr>
									<th>Inserted Word</th>
									<th>Count</th>
								</tr>
							</thead>
							<tbody>
								{#each getInsertions().slice(0, 50) as ins}
									<tr>
										<td class="font-mono">{ins.word}</td>
										<td class="text-sm font-semibold">{ins.count}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>

			<!-- Deletions -->
			<div class="card bg-base-100 shadow-xl">
				<div class="card-body">
					<h3 class="card-title text-error">Deletions</h3>
					<div class="max-h-64 overflow-x-auto">
						<table class="table-pin-rows table table-zebra">
							<thead>
								<tr>
									<th>Deleted Word</th>
									<th>Count</th>
								</tr>
							</thead>
							<tbody>
								{#each getDeletions().slice(0, 50) as del}
									<tr>
										<td class="font-mono">{del.word}</td>
										<td class="text-sm font-semibold">{del.count}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>

		<!-- Detailed Results Table -->
		<div class="card bg-base-100 shadow-xl">
			<div class="card-body">
				<div class="mb-4 flex items-center justify-between">
					<h3 class="card-title">Detailed Analysis</h3>
					<label class="label cursor-pointer">
						<span class="label-text mr-2">Compact view</span>
						<input type="checkbox" class="toggle toggle-primary" bind:checked={showCompactView} />
					</label>
				</div>
				<div class="overflow-x-auto">
					<table class="table table-zebra">
						<thead>
							<tr>
								<th class="w-12">#</th>
								{#if showCompactView}
									<th class="w-full">Alignment</th>
								{:else}
									<th class="w-96">Reference</th>
									<th class="w-96">Prediction</th>
								{/if}
								<th class="w-20">WER</th>
								<th class="w-20">Sub%</th>
								<th class="w-20">Ins%</th>
								<th class="w-20">Del%</th>
							</tr>
						</thead>
						<tbody>
							{#each results as result, i}
								<tr>
									<td>{i + 1}</td>
									{#if showCompactView}
										<td class="font-mono break-words">
											{@html renderCompactAlignment(result.alignment)}
										</td>
									{:else}
										<td class="font-mono break-words">
											{@html renderAlignment(result.alignment, true)}
										</td>
										<td class="font-mono break-words">
											{@html renderAlignment(result.alignment, false)}
										</td>
									{/if}
									<td>{formatPercentage(result.wer)}</td>
									<td>{formatPercentage(result.substitutionRate)}</td>
									<td>{formatPercentage(result.insertionRate)}</td>
									<td>{formatPercentage(result.deletionRate)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	{/if}
</div>
