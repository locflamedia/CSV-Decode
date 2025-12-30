# CSV Decoder - UTF-8 Encoding Fixer

Script Node.js để tự động fix encoding cho tất cả các file CSV trong thư mục hiện tại.

## Cài đặt

Chạy lệnh sau để cài đặt dependencies:

```bash
npm install
```

## Sử dụng

Đặt file CSV của bạn vào thư mục này, sau đó chạy:

```bash
npm start
```

hoặc

```bash
node decode-csv.js
```

## Chức năng

- Tự động tìm tất cả file `.csv` trong thư mục hiện tại
- Phát hiện encoding của từng file (UTF-8, UTF-16, Windows-1252, ISO-8859-1, v.v.)
- Chuyển đổi tất cả sang UTF-8
- Lưu file đã decode vào thư mục `decoded-csv/`

## Kết quả

Sau khi chạy, các file CSV đã được decode sẽ được lưu trong thư mục `decoded-csv/` với cùng tên file gốc.

## Ví dụ output

```
=== CSV Decoder - UTF-8 Encoding Fixer ===

Searching for CSV files in: /Users/beru/Documents/Beru/csv decode

Found 3 CSV file(s):

  1. data1.csv
  2. data2.csv
  3. data3.csv

--- Starting decode process ---

Processing: data1.csv
  Detected encoding: windows-1252
  ✓ Successfully decoded to: decoded-csv/data1.csv

Processing: data2.csv
  Detected encoding: utf8
  ✓ Successfully decoded to: decoded-csv/data2.csv

Processing: data3.csv
  Detected encoding: iso-8859-1
  ✓ Successfully decoded to: decoded-csv/data3.csv

=== Summary ===
Total files: 3
Successfully decoded: 3
Failed: 0

Decoded files saved to: decoded-csv/
```
