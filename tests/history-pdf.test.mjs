import test from 'node:test';
import assert from 'node:assert/strict';
import {createHistoryPdf} from '../history-pdf.mjs';

const base={sector:'jezero',sectorName:'Jezero Crater',mission:'Delta exploration',exportedAt:'2026-11-14T18:00:00Z',status:'Paused',elapsedMin:12.5,traveledM:412,budgetMin:120,minReserve:20,reserveMin:44,position:'Between Ares Base and Wildcat Ridge',stops:[{name:'Wildcat Ridge',duration:10,completed:false}],track:[[150,577.5],[310,442.5]],events:[]};
function inspect(report){
  const data=createHistoryPdf(report),pdf=Buffer.from(data).toString('latin1');
  assert.ok(pdf.startsWith('%PDF-1.4'));
  const start=Number(pdf.match(/startxref\n(\d+)/)[1]);assert.equal(pdf.slice(start,start+4),'xref');
  for(const match of pdf.matchAll(/(\d{10}) 00000 n/g))assert.match(pdf.slice(Number(match[1])),/^\d+ 0 obj\n/);
  for(const match of pdf.matchAll(/\/Length (\d+) >>\nstream\n([\s\S]*?)\nendstream/g))assert.equal(match[2].length,Number(match[1]));
  assert.ok(pdf.endsWith('%%EOF\n'));return pdf;
}
test('PDF contains English text, the actual walked distance, and a valid cross-reference table',()=>{
  const pdf=inspect(base);
  assert.ok(pdf.includes('(EVA-01  /  Jezero Crater)'));
  assert.ok(pdf.includes('(Distance traveled: 0.41 km)'));
  assert.ok(pdf.includes('No events recorded yet.'));
});
test('long histories paginate without losing or clipping events',()=>{
  const events=Array.from({length:90},(_,i)=>({time:base.exportedAt,scenarioTimeS:i*60,sector:'gale',title:`Evento ${i}`,details:'Observación de la cresta y decisión de regreso. '.repeat(4)}));
  const pdf=inspect({...base,events});
  const count=Number(pdf.match(/\/Type \/Pages \/Count (\d+)/)[1]);assert.ok(count>5);
  for(let i=0;i<90;i++)assert.ok(pdf.includes(`(Evento ${i})`));
  assert.ok(pdf.includes(`(${count} / ${count})`));
  for(const m of pdf.matchAll(/1 0 0 1 [\d.]+ ([\d.]+) Tm/g))assert.ok(Number(m[1])>=27&&Number(m[1])<=815);
});
test('PDF escapes literal text and can export before a walk begins',()=>{
  const pdf=inspect({...base,status:'Not started',position:'Base (Ares) \\ módulo',track:[],stops:[],traveledM:0,reserveMin:Infinity});
  assert.ok(pdf.includes('Base \\(Ares\\) \\\\ módulo'));
  assert.ok(pdf.includes('No stops selected.'));
  assert.ok(!pdf.includes('Infinity'));
});
