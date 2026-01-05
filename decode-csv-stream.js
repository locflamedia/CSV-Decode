const fs = require('fs');
const path = require('path');
const readline = require('readline');

const OUTPUT_DIR = 'decoded-csv';

function decodeUnicodeEscapes(text) {
  return text.replace(/\\u[\dA-Fa-f]{4}/g, (match) => {
    return String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16));
  });
}

async function decodeCSVFile(filePath) {
  try {
    console.log(`\nProcessing: ${filePath}`);

    const fileName = path.basename(filePath);
    const outputPath = path.join(OUTPUT_DIR, fileName);

    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const outputStream = fs.createWriteStream(outputPath, { encoding: 'utf8' });

    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let lineCount = 0;
    let unicodeEscapeCount = 0;

    for await (const line of rl) {
      lineCount++;

      // Count unicode escapes in this line
      const matches = line.match(/\\u[\dA-Fa-f]{4}/g);
      if (matches) {
        unicodeEscapeCount += matches.length;
      }

      // Decode unicode escapes
      const decoded = decodeUnicodeEscapes(line);

      // Write to output (with newline, except for first line if it's header)
      if (lineCount > 1) {
        outputStream.write('\n');
      }
      outputStream.write(decoded);
    }

    outputStream.end();

    console.log(`  Processed ${lineCount} lines`);
    if (unicodeEscapeCount > 0) {
      console.log(`  Found ${unicodeEscapeCount} Unicode escape sequences`);
      console.log(`  ✓ Decoded Unicode escapes`);
    }
    console.log(`  ✓ Successfully decoded to: ${outputPath}`);

    return true;
  } catch (error) {
    console.error(`  ✗ Error processing ${filePath}:`, error.message);
    return false;
  }
}

function findCSVFiles(directory) {
  const files = fs.readdirSync(directory);
  const csvFiles = [];

  for (const file of files) {
    const filePath = path.join(directory, file);
    const stat = fs.statSync(filePath);

    if (stat.isFile() && path.extname(file).toLowerCase() === '.csv') {
      csvFiles.push(filePath);
    }
  }

  return csvFiles;
}

async function main() {
  console.log('=== CSV Decoder - UTF-8 Encoding Fixer (Stream Version) ===\n');

  const currentDir = process.cwd();
  console.log(`Searching for CSV files in: ${currentDir}\n`);

  const csvFiles = findCSVFiles(currentDir);

  if (csvFiles.length === 0) {
    console.log('No CSV files found in current directory.');
    return;
  }

  console.log(`Found ${csvFiles.length} CSV file(s):\n`);
  csvFiles.forEach((file, index) => {
    console.log(`  ${index + 1}. ${path.basename(file)}`);
  });

  console.log('\n--- Starting decode process ---');

  let successCount = 0;
  let failCount = 0;

  for (const file of csvFiles) {
    if (await decodeCSVFile(file)) {
      successCount++;
    } else {
      failCount++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total files: ${csvFiles.length}`);
  console.log(`Successfully decoded: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log(`\nDecoded files saved to: ${OUTPUT_DIR}/`);
}

main();
