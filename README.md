# ASR Result Visualizer

A web tool for visualizing Automatic Speech Recognition (ASR) results with ground truth comparison. Built with SvelteKit and DaisyUI.

## Features

- **File Upload Support**: Upload CSV or JSON files containing ASR predictions and ground truth references
- **Preprocessing Options**: Configure text preprocessing with options for:
  - Convert to lowercase
  - Remove punctuation
  - Remove extra spaces
- **WER Calculation**:
  - Word Error Rate (WER)
  - Substitution Rate (Sub%)
  - Insertion Rate (Ins%)
  - Deletion Rate (Del%)
- **Detailed Visualization**:
  - Overall statistics dashboard
  - Error type breakdown tables (substitutions, insertions, deletions)
  - Word-by-word alignment visualization with color coding:
    - 🔴 Red: Deleted words
    - 🟡 Yellow: Substituted words
    - 🟢 Green: Inserted words

## Data Format

### CSV Format

```csv
reference,prediction
"The quick brown fox","The quick brown fox"
"Hello world","Hello word"
```

### JSON Format

```json
[
	{
		"reference": "The quick brown fox",
		"prediction": "The quick brown fox"
	},
	{
		"reference": "Hello world",
		"prediction": "Hello word"
	}
]
```

## Sample Data

The project includes sample data files in the `static/` folder:

- `sample-data.csv`
- `sample-data.json`
