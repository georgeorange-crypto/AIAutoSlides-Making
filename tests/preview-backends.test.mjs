import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePreviewArgs,rendererOrder} from '../src/preview-backends.mjs';

test('preview renderer selection is explicit and portable',()=>{
 assert.deepEqual(parsePreviewArgs(['deck.pptx','--renderer','libreoffice']),{input:'deck.pptx',renderer:'libreoffice'});
 assert.deepEqual(rendererOrder('win32','auto'),['powerpoint','libreoffice']);
 assert.deepEqual(rendererOrder('linux','auto'),['libreoffice']);
 assert.throws(()=>parsePreviewArgs(['--renderer','browser']),/must be auto/);
});
