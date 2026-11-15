import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {nodes,sectors} from '../engine.mjs';
import {placeFacts} from '../places.mjs';

function jpegSize(bytes){
  assert.equal(bytes.readUInt16BE(0),0xffd8);
  for(let offset=2;offset+9<bytes.length;){
    assert.equal(bytes[offset],0xff);
    const marker=bytes[offset+1],length=bytes.readUInt16BE(offset+2);
    if([0xc0,0xc1,0xc2].includes(marker))return {width:bytes.readUInt16BE(offset+7),height:bytes.readUInt16BE(offset+5)};
    assert.ok(length>=2);
    offset+=length+2;
  }
  assert.fail('JPEG has no supported frame header');
}

test('all 16 map points have different photographs, source pages and image contents',async()=>{
  const paths=new Set(),sources=new Set(),hashes=new Set();
  for(const sector of Object.keys(sectors))for(const node of nodes){
    const label=sector+'/'+node.id,info=placeFacts(sector,node.id);
    assert.equal(info?.photos.length,1,label);
    const photo=info.photos[0];
    assert.ok(!paths.has(photo.src),'Repeated photo path: '+label);
    assert.ok(!sources.has(photo.source),'Repeated source photograph: '+label);
    const source=new URL(photo.source);
    assert.equal(source.protocol,'https:');
    assert.ok(source.hostname.endsWith('.nasa.gov'),label);
    assert.ok(photo.alt&&photo.caption&&photo.credit,label);
    const bytes=await readFile(new URL('../'+photo.src,import.meta.url));
    assert.deepEqual(jpegSize(bytes),{width:photo.width,height:photo.height},label);
    const crop=photo.crop;
    assert.ok(crop.x>=0&&crop.y>=0&&crop.width>=750&&crop.height>0,'Invalid preview frame: '+label);
    assert.ok(crop.x+crop.width<=photo.width&&crop.y+crop.height<=photo.height,'Frame outside photo: '+label);
    assert.ok(crop.width/crop.height>2&&crop.width/crop.height<2.4,'Unusable preview proportions: '+label);
    const hash=createHash('sha256').update(bytes).digest('hex');
    assert.ok(!hashes.has(hash),'Repeated image contents: '+label);
    paths.add(photo.src);sources.add(photo.source);hashes.add(hash);
  }
  assert.equal(paths.size,16);assert.equal(sources.size,16);assert.equal(hashes.size,16);
});

test('unknown map points do not silently reuse a regional photo',()=>{
  for(const sector of ['jezero','gale'])for(const id of ['missing','toString','__proto__'])assert.equal(placeFacts(sector,id),null);
  assert.equal(placeFacts('missing','base'),null);
});
