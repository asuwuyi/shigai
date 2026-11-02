(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.VaultMemory=factory();})(globalThis,function(){
'use strict';
const symbols=['←','→','◆','●','▲','★','✚','■'];
let config={gapMs:350,levels:Array.from({length:8},(_,i)=>({count:i+3,showMs:2800-i*150,seconds:24+i*4,symbols:i<3?'arrows':i<5?'basic':'all'}))};
function validate(value){if(!value||!Number.isInteger(value.gapMs)||value.gapMs<100||value.gapMs>2000||!Array.isArray(value.levels)||!value.levels.length||value.levels.length>200)throw Error('金庫關卡或提示間隔不正確');for(const l of value.levels){for(const[k,min,max]of [['count',2,20],['showMs',600,10000],['seconds',5,600]])if(!Number.isInteger(l[k])||l[k]<min||l[k]>max)throw Error('金庫關卡數值不正確：'+k);if(!['arrows','basic','all'].includes(l.symbols))throw Error('金庫符號種類不正確');}return value;}
function configure(value){config=JSON.parse(JSON.stringify(validate(value)));}
function total(){return config.levels.length;}
function rules(level){if(!Number.isInteger(level)||level<1||level>total())throw Error('Invalid level');return {...config.levels[level-1],gapMs:config.gapMs};}
function symbolsFor(level){const kind=rules(level).symbols;return kind==='arrows'?symbols.slice(0,2):kind==='basic'?symbols.slice(0,4):symbols;}
function sequence(level,random=Math.random){return Array.from({length:rules(level).count},()=>({symbol:symbolsFor(level)[Math.floor(random()*symbolsFor(level).length)],digits:String(Math.floor(random()*100)).padStart(2,'0')}));}
return Object.freeze({symbols,symbolsFor,rules,sequence,configure,validate,total});});