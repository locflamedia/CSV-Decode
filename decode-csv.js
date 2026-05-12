const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

const OUTPUT_DIR = 'decoded-csv';
const MAX_UTF8_REPLACEMENTS = 10;

function countReplacementChars(text) {
  return (text.match(/\ufffd/g) || []).length;
}

function looksLikeUtf16Le(buffer) {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return true;
  }

  const sampleLength = Math.min(buffer.length, 4096);
  let pairs = 0;
  let evenNulls = 0;
  let oddNulls = 0;

  for (let i = 0; i + 1 < sampleLength; i += 2) {
    pairs++;
    if (buffer[i] === 0) {
      evenNulls++;
    }
    if (buffer[i + 1] === 0) {
      oddNulls++;
    }
  }

  return pairs > 0 && oddNulls / pairs > 0.3 && evenNulls / pairs < 0.05;
}

function detectEncoding(buffer) {
  // Try to detect if the file is already UTF-8
  try {
    const decoded = iconv.decode(buffer, 'utf8');
    const replacementCount = countReplacementChars(decoded);
    // Keep mostly-valid UTF-8 files as UTF-8. A few bad bytes should not make
    // the whole file fall through to single-byte or UTF-16 guesses.
    if (replacementCount <= MAX_UTF8_REPLACEMENTS) {
      return 'utf8';
    }
  } catch (e) {
    // Continue to other encodings
  }

  const encodings = [
    ...(looksLikeUtf16Le(buffer) ? ['utf16le'] : []),
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

function detectEncodingFromSample(filePath) {
  const SAMPLE_SIZE = 65536; // 64KB sample
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(SAMPLE_SIZE);
  const bytesRead = fs.readSync(fd, buffer, 0, SAMPLE_SIZE, 0);
  fs.closeSync(fd);

  const sample = buffer.slice(0, bytesRead);
  return detectEncoding(sample);
}

function decodeCSVFile(filePath) {
  return new Promise((resolve, reject) => {
    try {
      console.log(`\nProcessing: ${filePath}`);

      const detectedEncoding = detectEncodingFromSample(filePath);
      console.log(`  Detected encoding: ${detectedEncoding}`);

      if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      }

      const fileName = path.basename(filePath);
      const outputPath = path.join(OUTPUT_DIR, fileName);

      const readStream = fs.createReadStream(filePath);
      const decodeStream = iconv.decodeStream(detectedEncoding);
      const writeStream = fs.createWriteStream(outputPath, { encoding: 'utf8' });

      let hasUnicodeEscapes = false;
      let chunkBuffer = '';

      decodeStream.on('data', (chunk) => {
        chunkBuffer += chunk;

        // Process in lines to handle unicode escapes properly
        const lines = chunkBuffer.split('\n');
        chunkBuffer = lines.pop(); // Keep incomplete line in buffer

        for (let line of lines) {
          if (!hasUnicodeEscapes && line.includes('\\u')) {
            hasUnicodeEscapes = true;
          }
          if (hasUnicodeEscapes) {
            line = decodeUnicodeEscapes(line);
          }
          writeStream.write(line + '\n');
        }
      });

      decodeStream.on('end', () => {
        // Write remaining buffer
        if (chunkBuffer) {
          if (hasUnicodeEscapes) {
            chunkBuffer = decodeUnicodeEscapes(chunkBuffer);
          }
          writeStream.write(chunkBuffer);
        }
        writeStream.end();
      });

      writeStream.on('finish', () => {
        if (hasUnicodeEscapes) {
          console.log(`  ✓ Decoded Unicode escapes`);
        }
        console.log(`  ✓ Successfully decoded to: ${outputPath}`);
        resolve(true);
      });

      writeStream.on('error', (error) => {
        console.error(`  ✗ Error writing ${outputPath}:`, error.message);
        reject(error);
      });

      readStream.on('error', (error) => {
        console.error(`  ✗ Error reading ${filePath}:`, error.message);
        reject(error);
      });

      decodeStream.on('error', (error) => {
        console.error(`  ✗ Error decoding ${filePath}:`, error.message);
        reject(error);
      });

      readStream.pipe(decodeStream);

    } catch (error) {
      console.error(`  ✗ Error processing ${filePath}:`, error.message);
      reject(error);
    }
  });
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
    try {
      await decodeCSVFile(file);
      successCount++;
    } catch (error) {
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
