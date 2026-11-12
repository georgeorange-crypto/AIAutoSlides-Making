# CSV import example

This dataset is **synthetic teaching data**. It is not an experiment and must not be presented as a scientific result.

From the project root:

```powershell
npm run from:csv
node src/cli.mjs validate --input outputs/synthetic-csv/storyboard.json --evidence outputs/synthetic-csv/storyboard-evidence.json
node src/cli.mjs build --input outputs/synthetic-csv/storyboard.json --evidence outputs/synthetic-csv/storyboard-evidence.json --out outputs/synthetic-csv-demo.pptx
```

The importer reads category, value, unit, and sample count from the CSV; preserves a SHA-256 locator; and writes an eight-slide storyboard plus its evidence ledger. All values remain explicitly synthetic.

For additional chart forms, `synthetic-multiseries.csv` demonstrates repeated category/series rows, `synthetic-scatter.csv` carries explicit x/y units, and `synthetic-cdf.csv` contains raw observations. The CDF importer groups ties and emits the right-continuous step curve where each level is the cumulative observation count divided by raw `n`. These fixtures are synthetic and must not be treated as research findings.
