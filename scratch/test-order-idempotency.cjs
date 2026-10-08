const fs = require('fs');
const ts = require('typescript');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const code = ts.transpileModule(fs.readFileSync('src/lib/create-cart-order.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const storage = new Map(), documents = new Map();
let nextId=0, writes=0, fail=false, queue=Promise.resolve();
const firebase = {
 doc: (orders,id) => ({id:id||`order-${++nextId}`, path:orders.path+'/'+(id||`order-${nextId}`)}),
 runTransaction: (_,fn) => {
  const result=queue.then(async()=> {
   if(fail) { fail=false; throw Error('network'); }
   return fn({get:async ref=>({exists:()=>documents.has(ref.path)}),set:(ref,data)=>{documents.set(ref.path,structuredClone(data));writes++;}});
  }); queue=result.catch(()=>{}); return result;
 }
};
function load(blockStorage=false) {
 const context={exports:{},require:()=>firebase,sessionStorage:{getItem:k=>{if(blockStorage)throw Error('disabled');return storage.get(k)||null;},setItem:(k,v)=>{if(blockStorage)throw Error('disabled');storage.set(k,v);}}};
 vm.runInNewContext(code,context); return context.exports.createCartOrder;
}
(async()=>{
 const create=load(), orders={path:'companies/A/orders',firestore:{}}, data={companyId:'A',customerId:'u',orderDate:{timestamp:1},orderItems:[{productId:'p',quantity:1}],totalAmount:10}, cart=[{id:'p-123'}];
 const results=await Promise.all([create(orders,data,cart),create(orders,{...data,orderDate:{timestamp:2}},cart)]);
 assert.equal(writes,1);assert.equal(results[0].reference.id,results[1].reference.id);assert.equal(results.filter(r=>r.created).length,1);
 documents.get(results[0].reference.path).status='Aceito';
 const retry=await load()(orders,{...data,orderDate:{timestamp:3}},cart);
 assert.equal(retry.created,false);assert.equal(writes,1);assert.equal(documents.get(retry.reference.path).status,'Aceito');
 await create(orders,data,[{id:'p-456'}]);assert.equal(writes,2);
 await create({...orders,path:'companies/B/orders'},{...data,companyId:'B'},cart);assert.equal(writes,3);
 fail=true;await assert.rejects(create(orders,data,[{id:'retry-cart'}]));
 const failedId=JSON.parse(storage.get('pendingOrder:companies/A/orders')).id;
 const recovered=await create(orders,data,[{id:'retry-cart'}]);assert.equal(recovered.reference.id,failedId);assert.equal(writes,4);
 const noStorage=load(true);const offlineOrders={...orders,path:'companies/C/orders'};
 await noStorage(offlineOrders,data,cart);await noStorage(offlineOrders,data,cart);assert.equal(writes,5);
 console.log('PASS: concurrent submit, retry after reload, preserved status, new cart, company isolation, failed write retry, storage unavailable');
})().catch(err=>{console.error(err);process.exitCode=1;});

