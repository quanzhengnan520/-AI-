// Temporary SDK 57 compatibility patch. Remove when Expo Router adopts a fixed decoder.
const fs = require('node:fs');
const path = require('node:path');

const queryRoot = path.dirname(require.resolve('query-string/package.json'));
const queryPackage = JSON.parse(fs.readFileSync(path.join(queryRoot, 'package.json'), 'utf8'));
const decoderRoot = path.dirname(require.resolve('decode-uri-component'));
const decoderPackage = JSON.parse(fs.readFileSync(path.join(decoderRoot, 'package.json'), 'utf8'));
if (queryPackage.version !== '7.1.3' || decoderPackage.version !== '0.5.1') {
  throw new Error(
    'Unexpected query-string/decoder versions; review the SDK 57 compatibility patch.',
  );
}

const target = path.join(queryRoot, 'index.js');
const original = "const decodeComponent = require('decode-uri-component');";
const patched = "const decodeComponent = require('decode-uri-component').default;";
const source = fs.readFileSync(target, 'utf8');
if (source.split(patched).length === 2 && !source.includes(original)) {
  console.log('SDK 57 decoder compatibility patch already applied.');
} else if (source.split(original).length === 2 && !source.includes(patched)) {
  fs.writeFileSync(target, source.replace(original, patched), 'utf8');
  console.log('Applied SDK 57 decoder ESM/default compatibility patch.');
} else {
  throw new Error('Unexpected query-string source; refusing to patch an unknown dependency.');
}
