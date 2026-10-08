const fs=require('fs'),ts=require('typescript'),vm=require('node:vm'),assert=require('node:assert/strict');const ctx={exports:{},require:()=>({}),console};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/utils.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,ctx);
const open=ctx.exports.isStoreOpen;let count=0;
function check(schedule,date,expected){assert.equal(open(JSON.stringify(schedule),new Date(date)).isOpen,expected,date);count++;}
const night={thursday:{isOpen:true,slots:[{openTime:'00:00',closeTime:'01:50'}]}};
check(night,'2026-10-08T03:46:00Z',true);check(night,'2026-10-08T02:59:00Z',false);check(night,'2026-10-08T03:00:00Z',true);check(night,'2026-10-08T04:50:00Z',false);
const crossing={wednesday:{isOpen:true,openTime:'18:00',closeTime:'02:00'},thursday:{isOpen:false}};
check(crossing,'2026-10-08T04:00:00Z',true);check(crossing,'2026-10-08T05:00:00Z',false);check(crossing,'2026-10-07T04:00:00Z',false);
const sunday={saturday:{isOpen:true,slots:[{openTime:'20:00',closeTime:'02:00'}]}};check(sunday,'2026-10-11T04:00:00Z',true);
check({thursday:{isOpen:true,slots:[{openTime:'09:00',closeTime:'12:00'},{openTime:'14:00',closeTime:'18:00'}]}},'2026-10-08T16:00:00Z',false);
console.log('PASS: '+count+' casos de fuso, limites, madrugada, virada de semana e intervalo entre turnos');
