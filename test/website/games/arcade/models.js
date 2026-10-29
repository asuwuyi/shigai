(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory();else root.ShiGaiArcadeModels=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function number(value,min,max){if(!Number.isFinite(value)||value<min||value>max)throw Error('關卡數值超出支援範圍。');return value;}
function integer(value,min,max){number(value,min,max);if(!Number.isInteger(value))throw Error('關卡數值必須為整數。');return value;}
function shuffle(a,random){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
class Catch {
 constructor(level,random=Math.random){this.level={target:integer(level.target,1,100),speed:number(level.speed,60,400),interval:number(level.interval,.2,3),badRate:number(level.badRate,0,.6)};this.random=random;this.x=240;this.items=[];this.score=0;this.lives=3;this.spawn=0;this.elapsed=0;this.status='ready';}
 start(){if(this.status==='ready')this.status='playing';}
 step(dt,direction=0){if(this.status!=='playing')return;number(dt,0,.1);this.elapsed+=dt;this.x=clamp(this.x+direction*330*dt,44,436);this.spawn-=dt;
  while(this.spawn<=0){this.items.push({x:24+this.random()*432,y:-25,bad:this.random()<this.level.badRate});this.spawn+=this.level.interval;}
  const remaining=[];for(const item of this.items){const before=item.y;item.y+=this.level.speed*dt;
   if(before<=565&&item.y>=565&&Math.abs(item.x-this.x)<60){if(item.bad)this.lives--;else this.score++;}
   else if(item.y>665){if(!item.bad)this.lives--;}
   else remaining.push(item);
  }this.items=remaining;if(this.lives<=0){this.lives=0;this.status='lost';}else if(this.score>=this.level.target)this.status='won';
 }
}
class Puzzle {
 constructor(level,random=Math.random){this.size=integer(level.size,2,6);this.tiles=shuffle(Array.from({length:this.size**2},(_,i)=>i),random);if(this.tiles.every((v,i)=>v===i))this.tiles.push(this.tiles.shift());this.moves=0;this.status='ready';}
 start(){if(this.status==='ready')this.status='playing';}
 swap(a,b){if(this.status!=='playing'||!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>=this.tiles.length||b>=this.tiles.length||a===b)return false;[this.tiles[a],this.tiles[b]]=[this.tiles[b],this.tiles[a]];this.moves++;if(this.tiles.every((v,i)=>v===i))this.status='won';return true;}
}
class Sokoban {
 constructor(level){const map=level.map;if(!Array.isArray(map)||map.length<4||map.length>12||typeof map[0]!=='string')throw Error('推箱子地圖需為4～12列。');this.rows=map.length;this.cols=map[0].length;integer(this.cols,4,12);this.walls=new Set();this.goals=new Set();this.boxes=new Set();this.player=-1;this.moves=0;this.pushes=0;this.history=[];this.status='ready';
  map.forEach((row,y)=>{if(typeof row!=='string'||row.length!==this.cols)throw Error('推箱子地圖每列需同寬。');[...row].forEach((ch,x)=>{const i=y*this.cols+x;if(!'# .$@*+'.includes(ch))throw Error('推箱子地圖含未知符號。');if((!x||!y||x===this.cols-1||y===this.rows-1)&&ch!=='#')throw Error('地圖邊界需為牆壁。');if(ch==='#')this.walls.add(i);if('.+*'.includes(ch))this.goals.add(i);if('$*'.includes(ch))this.boxes.add(i);if('@+'.includes(ch)){if(this.player!==-1)throw Error('地圖只能有一個角色。');this.player=i;}});});
  if(this.player<0||!this.boxes.size||this.boxes.size!==this.goals.size||[...this.boxes].every(i=>this.goals.has(i)))throw Error('需有一個角色、相同數量的箱子與目標，且尚未完成。');
 }
 start(){if(this.status==='ready')this.status='playing';}
 move(direction){if(this.status!=='playing')return false;const d={up:-this.cols,down:this.cols,left:-1,right:1}[direction];if(!d)return false;const next=this.player+d;if(this.walls.has(next))return false;const push=this.boxes.has(next);if(push&&(this.walls.has(next+d)||this.boxes.has(next+d)))return false;
  this.history.push({player:this.player,boxes:[...this.boxes],moves:this.moves,pushes:this.pushes});if(push){this.boxes.delete(next);this.boxes.add(next+d);this.pushes++;}this.player=next;this.moves++;if([...this.boxes].every(i=>this.goals.has(i)))this.status='won';return true;
 }
 undo(){const last=this.history.pop();if(!last)return false;this.player=last.player;this.boxes=new Set(last.boxes);this.moves=last.moves;this.pushes=last.pushes;this.status='playing';return true;}
 get corner(){return [...this.boxes].some(i=>!this.goals.has(i)&&(this.walls.has(i-1)||this.walls.has(i+1))&&(this.walls.has(i-this.cols)||this.walls.has(i+this.cols)));}
}
class Breakout {
 constructor(level){this.level={rows:integer(level.rows,1,6),cols:integer(level.cols,1,8),speed:number(level.speed,180,500),hp:integer(level.hp,1,3)};this.x=240;this.lives=3;this.score=0;this.status='ready';this.elapsed=0;this.bricks=[];const width=432/this.level.cols;
  for(let row=0;row<this.level.rows;row++)for(let col=0;col<this.level.cols;col++)this.bricks.push({x:26+col*width,y:65+row*32,w:width-5,h:23,hp:this.level.hp});this.serve=0;this.resetBall();
 }
 resetBall(){this.ball={x:this.x,y:552,vx:this.level.speed*.25,vy:-this.level.speed*Math.sqrt(1-.25**2)};}
 start(){if(this.status==='ready')this.status='playing';}
 step(dt,direction=0){if(this.status!=='playing')return;number(dt,0,.1);this.elapsed+=dt;this.x=clamp(this.x+direction*370*dt,48,432);if(this.serve>0){this.serve-=dt;this.resetBall();return;}
  const steps=Math.max(1,Math.ceil(dt/(1/240))),h=dt/steps,r=8,b=this.ball;
  for(let k=0;k<steps;k++){
   const oldY=b.y;b.x+=b.vx*h;b.y+=b.vy*h;
   if(b.x<r){b.x=r;b.vx=Math.abs(b.vx);}if(b.x>480-r){b.x=480-r;b.vx=-Math.abs(b.vx);}if(b.y<r){b.y=r;b.vy=Math.abs(b.vy);}
   if(b.vy>0&&oldY+r<=583&&b.y+r>=580&&Math.abs(b.x-this.x)<=54){const speed=Math.min(520,Math.hypot(b.vx,b.vy)*1.015),angle=clamp((b.x-this.x)/52,-.95,.95)*Math.PI/3;b.y=571;b.vx=Math.sin(angle)*speed;b.vy=-Math.cos(angle)*speed;}
   for(const brick of this.bricks){if(!brick.hp)continue;const nx=clamp(b.x,brick.x,brick.x+brick.w),ny=clamp(b.y,brick.y,brick.y+brick.h);if((b.x-nx)**2+(b.y-ny)**2>r*r)continue;
    brick.hp--;this.score++;const horizontal=Math.min(Math.abs(b.x-brick.x),Math.abs(b.x-brick.x-brick.w)),vertical=Math.min(Math.abs(b.y-brick.y),Math.abs(b.y-brick.y-brick.h));
    if(vertical<=horizontal){b.y=b.vy>0?brick.y-r:brick.y+brick.h+r;b.vy=-b.vy;}else{b.x=b.vx>0?brick.x-r:brick.x+brick.w+r;b.vx=-b.vx;}break;
   }
   if(this.bricks.every(brick=>!brick.hp)){this.status='won';break;}
   if(b.y>650){this.lives--;if(!this.lives)this.status='lost';else{this.serve=.85;this.resetBall();}break;}
  }
 }
}
return Object.freeze({Catch,Puzzle,Sokoban,Breakout,clamp});
});
