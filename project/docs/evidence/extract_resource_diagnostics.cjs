const fs = require('node:fs');

const resultsPath = `${__dirname}/PLAYWRIGHT_RESULTS.json`;
const evidencePath = `${__dirname}/RESOURCE_DIAGNOSTICS.json`;
const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));
const suite = results.suites.find((item) => item.title === 'resource-diagnostics.spec.ts');
if (!suite) throw new Error('Run the Playwright resource diagnostics spec first.');

const diagnostics = [];
for (const spec of suite.specs) {
  for (const test of spec.tests) {
    for (const result of test.results) {
      for (const attachment of result.attachments ?? []) {
        if (attachment.name === 'browser-resource-diagnostics' && attachment.body) {
          diagnostics.push(JSON.parse(Buffer.from(attachment.body, 'base64').toString('utf8')));
        }
      }
    }
  }
}

fs.writeFileSync(evidencePath, `${JSON.stringify(diagnostics, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(diagnostics, null, 2)}\n`);
