const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

const OUTPUT_DIR = 'decoded-csv';

function detectEncoding(buffer) {
  const encodings = [
    'utf8',
    'utf16le',
    'windows-1252',
    'iso-8859-1',
    'windows-1251',
    'gb2312',
    'big5',
    'shift_jis'
  ];

  for (const encoding of encodings) {
    try {
      const decoded = iconv.decode(buffer, encoding);
      if (!decoded.includes('\ufffd') && decoded.length > 0) {
        return encoding;
      }
    } catch (e) {
      continue;
    }
  }

  return 'utf8';
}

function decodeUnicodeEscapes(text) {
  return text.replace(/\\u[\dA-Fa-f]{4}/g, (match) => {
    return String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16));
  });
}

function decodeCSVFile(filePath) {
  try {
    console.log(`\nProcessing: ${filePath}`);

    const buffer = fs.readFileSync(filePath);

    const detectedEncoding = detectEncoding(buffer);
    console.log(`  Detected encoding: ${detectedEncoding}`);

    let decoded = iconv.decode(buffer, detectedEncoding);

    const unicodeEscapeCount = (decoded.match(/\\u[\dA-Fa-f]{4}/g) || []).length;
    if (unicodeEscapeCount > 0) {
      console.log(`  Found ${unicodeEscapeCount} Unicode escape sequences`);
      decoded = decodeUnicodeEscapes(decoded);
      console.log(`  ✓ Decoded Unicode escapes`);
    }

    const utf8Buffer = iconv.encode(decoded, 'utf8');

    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const fileName = path.basename(filePath);
    const outputPath = path.join(OUTPUT_DIR, fileName);

    fs.writeFileSync(outputPath, utf8Buffer);

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

function main() {
  console.log('=== CSV Decoder - UTF-8 Encoding Fixer ===\n');

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
    if (decodeCSVFile(file)) {
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
