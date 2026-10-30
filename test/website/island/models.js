import * as THREE from './vendor/three-island.js';
export const GROUND = 2.83;
const colors = { sand:0xe4cda5, cliff:0xbfa888, grass:0xb7c395, cream:0xfff0ce, white:0xfffbed, wood:0xb98d61, dark:0x36545e, blue:0x79b8e8, orange:0xd68a61, green:0x658e7f };
const materials = new Map();
const geometry = { box:new THREE.BoxGeometry(1,1,1), ball:new THREE.SphereGeometry(1,12,8), pebble:new THREE.IcosahedronGeometry(1,0), cylinder:new THREE.CylinderGeometry(1,1,1,12), cone:new THREE.ConeGeometry(1,1,8) };
function material(color, glow=false) {
 const key=color+':'+glow;
 if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.95,flatShading:true,...(glow?{emissive:color,emissiveIntensity:.12}:{})}));
 return materials.get(key);
}
function primitive(parent, kind, color, x,y,z, sx,sy,sz, rotation) {
 const mesh=new THREE.Mesh(geometry[kind],material(color));mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);if(rotation)mesh.rotation.set(...rotation);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
const box=(p,c,x,y,z,w,h,d,r)=>primitive(p,'box',c,x,y,z,w,h,d,r);
const ball=(p,c,x,y,z,w,h,d)=>primitive(p,'ball',c,x,y,z,w,h,d);
const cylinder=(p,c,x,y,z,r,h)=>primitive(p,'cylinder',c,x,y,z,r,h,r);
function group(parent,x=0,y=0,z=0){const g=new THREE.Group();g.position.set(x,y,z);parent.add(g);return g;}
function sign(parent,text,x,y,z,w=2,h=.5,bg='#fff5d8',ink='#36545e') {
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=192;
 const ctx=canvas.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,768,192);ctx.fillStyle=ink;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 78px Georgia, "Microsoft JhengHei", sans-serif';ctx.fillText(text,384,103,720);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture}));mesh.position.set(x,y,z);parent.add(mesh);mesh.userData.noBatch=true;return mesh;
}
function roof(parent,w,d,h,y,color) {
 const shape=new THREE.Shape();shape.moveTo(-w/2,0);shape.lineTo(0,h);shape.lineTo(w/2,0);shape.closePath();
 const geo=new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false});geo.translate(0,0,-d/2);
 const mesh=new THREE.Mesh(geo,material(color));mesh.position.y=y;mesh.castShadow=true;parent.add(mesh);
 const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geo,25),new THREE.LineBasicMaterial({color:0x40514e,transparent:true,opacity:.24}));edges.position.y=y;parent.add(edges);return mesh;
}
function windowPane(parent,x,y,z,w=1,h=1) {
 box(parent,colors.wood,x,y,z,w+.16,h+.16,.14);
 const mesh=box(parent,0xb2d1ce,x,y,z+.09,w,h,.03);mesh.material=material(0xbed5c8,true);
 box(parent,colors.cream,x,y,z+.12,.055,h,.04);box(parent,colors.cream,x,y,z+.12,w,.05,.04);
}
function door(parent,x,z,h=1.8,w=.75) {box(parent,colors.dark,x,h/2,z,w+.15,h+.1,.1);box(parent,0xd4b384,x,h/2,z+.07,w,h,.05);ball(parent,0xd0b574,x+w*.3,h*.48,z+.12,.06,.06,.06);}
function footShadow(parent,x,z,sx,sz){const m=new THREE.Mesh(new THREE.CircleGeometry(1,40),new THREE.MeshBasicMaterial({color:0x4d665a,transparent:true,opacity:.12,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(x,GROUND+.012,z);m.scale.set(sx,sz,1);parent.add(m);}
function makeShape(points,scale=1){const s=new THREE.Shape();const midpoint=(a,b)=>[(a[0]+b[0])/2*scale,-(a[1]+b[1])/2*scale];const start=midpoint(points.at(-1),points[0]);s.moveTo(...start);points.forEach((p,i)=>{const end=midpoint(p,points[(i+1)%points.length]);s.quadraticCurveTo(p[0]*scale,-p[1]*scale,...end)});s.closePath();return s;}
function pathRibbon(parent,points,width=.85){const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,GROUND+.028,z))),vertices=[],indices=[];for(let i=0;i<=50;i++){const t=i/50,p=curve.getPoint(t),dir=curve.getTangent(t),side=new THREE.Vector3(-dir.z,0,dir.x).multiplyScalar(width/2);vertices.push(p.x+side.x,p.y,p.z+side.z,p.x-side.x,p.y,p.z-side.z);if(i<50){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3)}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();const mesh=new THREE.Mesh(g,material(0xead9b5));mesh.material.side=THREE.DoubleSide;mesh.receiveShadow=true;parent.add(mesh);}
function makeTree(parent,x,z,scale=1,type=0){const t=group(parent,x,GROUND,z);box(t,0x9d7e53,0,.55*scale,0,.17*scale,1.1*scale,.17*scale);if(type%3===0){primitive(t,'cone',0x6e8e70,0,1.65*scale,0,.75*scale,1.9*scale,.75*scale);primitive(t,'cone',0x78977b,0,2.15*scale,0,.5*scale,1.35*scale,.5*scale)}else{primitive(t,'pebble',type%2?0x8ea274:0x749786,0,1.65*scale,0,.95*scale,1.2*scale,.8*scale);primitive(t,'pebble',0x9dad7c,.35*scale,1.38*scale,.1*scale,.6*scale,.7*scale,.65*scale)}}
function bench(parent,x,z,rotation=0){const b=group(parent,x,GROUND,z);b.rotation.y=rotation;for(const sx of[-.58,.58])box(b,colors.dark,sx,.3,0,.12,.6,.45);box(b,colors.wood,0,.63,0,1.6,.12,.52);box(b,colors.wood,0,1.05,-.23,1.6,.5,.09)}
function penguin(parent,x,z,chicken=false){const g=group(parent,x,GROUND,z);g.userData.moving=true;g.rotation.y=.2;const c=chicken?0xf2cf54:0x6298ce;
 ball(g,c,0,.67,0,.47,.66,.36);ball(g,0xfff7df,0,.48,.3,.31,.36,.07);ball(g,c,0,1.19,0,.39,.39,.32);
 for(const side of[-1,1]){ball(g,0xfffcf0,side*.16,1.25,.27,.15,.19,.06);ball(g,0x293e48,side*.16,1.24,.325,.05,.07,.025);ball(g,0xe5b952,side*.2,.07,.15,.21,.075,.28);const wing=ball(g,c,side*.46,.66,0,.12,.35,.19);wing.rotation.z=side*.28}
 const beak=primitive(g,'cone',0xf1c553,0,1.08,.4,.22,.34,.17,[Math.PI/2,0,0]);
 if(chicken){for(let i=0;i<3;i++)ball(g,0xd96c55,(i-1)*.15,1.56+i*.015,-.02,.13,.22,.1)}else{for(let i=0;i<3;i++)primitive(g,'cone',0xf5d260,(i-1)*.15,1.62,-.04,.12,.3,.09);box(g,0xf5d260,0,1.49,-.04,.48,.09,.2)}
 return g;
}
function batchStatic(parent){parent.updateMatrixWorld(true);const buckets=new Map();parent.traverse(mesh=>{if(!mesh.isMesh||mesh.isInstancedMesh||mesh.userData.noBatch||!Object.values(geometry).includes(mesh.geometry))return;let place='',moving=false;for(let p=mesh;p;p=p.parent){if(p.userData.moving)moving=true;if(p.userData.place)place=p.userData.place}if(moving)return;const key=mesh.geometry.uuid+mesh.material.uuid+place;if(!buckets.has(key))buckets.set(key,{place,items:[]});buckets.get(key).items.push(mesh)});for(const {place,items}of buckets.values()){if(items.length<3)continue;const m=new THREE.InstancedMesh(items[0].geometry,items[0].material,items.length);items.forEach((item,i)=>m.setMatrixAt(i,item.matrixWorld));m.castShadow=true;m.receiveShadow=true;m.userData.place=place;m.computeBoundingSphere();parent.add(m);items.forEach(item=>item.removeFromParent())}}
export function buildIsland(scene){
 const world=new THREE.Group();scene.add(world);const artSurfaces=[],interactive=[],anchors={};
 const outline=[[-12,-1],[-10,-7],[-4,-10],[4,-9],[10,-5],[12,2],[8,8],[1,10],[-7,8],[-12,3]];
 const landShape=makeShape(outline);const landGeo=new THREE.ExtrudeGeometry(landShape,{depth:2.55,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.22,bevelThickness:.22,curveSegments:3});landGeo.rotateX(-Math.PI/2);
 const land=new THREE.Mesh(landGeo,[material(colors.sand),material(colors.cliff)]);land.position.y=.05;land.castShadow=true;land.receiveShadow=true;world.add(land);
 const grassGeo=new THREE.ShapeGeometry(makeShape(outline,.956),5);grassGeo.rotateX(-Math.PI/2);const grass=new THREE.Mesh(grassGeo,material(colors.grass));grass.position.y=GROUND;grass.receiveShadow=true;world.add(grass);
 const coast=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(landShape.getPoints(90).map(p=>new THREE.Vector3(p.x*1.065,-.17,-p.y*1.065))),new THREE.LineBasicMaterial({color:0xe4f0df,transparent:true,opacity:.68}));world.add(coast);
 pathRibbon(world,[[-6,2],[-3,2.4],[.8,1.8],[4,1.7],[5.5,1.6]],1.05);pathRibbon(world,[[-1,1.9],[-.8,-.5],[-1.7,-2.3],[-2.6,-3.4]],.95);pathRibbon(world,[[.5,2.1],[-.1,4],[-1.8,6.5]],1.1);pathRibbon(world,[[3,2.2],[5.7,5.6],[6.5,8.8]],.9);
 const plaza=cylinder(world,0xeddcb7,1,GROUND+.035,.2,1.9,.055);plaza.receiveShadow=true;
 function destination(id,x,z,height){const g=group(world,x,GROUND,z);g.userData.place=id;interactive.push(g);anchors[id]=new THREE.Vector3(x,GROUND+height,z);footShadow(world,x,z,2.5,2);return g;}
 // Gallery: open portico, pitched blue roof and frames with real published art.
 const gallery=destination('gallery',-6,-.3,5.7);box(gallery,0xeaddb9,0,.12,0,4.8,.24,3.4);box(gallery,0xf4ebd1,0,1.7,0,4.05,3.1,2.75);roof(gallery,4.55,3.35,1.1,3.26,0x536e7b);
 for(const x of[-1.83,1.83]){box(gallery,0xeee3c8,x,1.6,1.63,.2,3.05,.2);box(gallery,colors.cream,x,.15,1.63,.42,.25,.45)}
 box(gallery,colors.cream,0,3.08,1.67,4.4,.22,.24);sign(gallery,'SHI-GAI GALLERY',0,2.91,1.82,3.2,.36);door(gallery,0,1.4,2.05,.85);
 for(const x of[-1.22,1.22]){box(gallery,0xb4975e,x,1.55,1.43,.95,1.45,.13);box(gallery,colors.white,x,1.55,1.51,.8,1.3,.035);const m=new THREE.Mesh(new THREE.PlaneGeometry(.76,1.24),new THREE.MeshBasicMaterial({color:0xc5d9d3}));m.position.set(x,1.55,1.54);m.userData.noBatch=true;gallery.add(m);artSurfaces.push({mesh:m,width:.76,height:1.24})}
 windowPane(gallery,-1,1.7,-1.4,1,1.4);windowPane(gallery,1,1.7,-1.4,1,1.4);
 // Study: storybook roof, chimney, books and a small front porch.
 const study=destination('study',-2.6,-5.2,5.4);box(study,0xb99e76,0,.15,0,3.8,.3,3.4);box(study,0xe5d3a5,0,1.5,0,3.2,2.65,2.65);roof(study,3.8,3.3,1.55,2.83,0x6c8f85);box(study,0xd9c5a1,.95,3.53,-.55,.55,1.35,.55);box(study,0xf6e7c7,.95,4.22,-.55,.7,.17,.7);door(study,-.76,1.38,1.85,.68);windowPane(study,.62,1.6,1.38,1.05,1.15);sign(study,'JOURNAL',0,2.55,1.55,2.15,.35);
 for(let i=0;i<5;i++)box(study,[0x8faba0,0xd1956c,0xe3c36d,0x728da7,0xaab386][i],.26+i*.17,1.35,1.5,.12,.3+(i%2)*.08,.11);
 for(const x of[-1.45,1.45])box(study,0x9c805e,x,.85,1.68,.11,1.45,.12);box(study,0xc6aa7f,0,.35,1.8,2.25,.18,.65);box(study,0xd9c49f,0,.12,2.1,2.7,.16,.65);
 // Arcade: open-front playroom with a dimensional controller on the roof.
 const games=destination('games',5.4,-.8,5.9);box(games,0xceaf83,0,.14,0,4.2,.28,3.4);box(games,0x6e9593,0,1.55,0,3.65,2.8,2.7);roof(games,4.3,3.3,.75,3.08,0xce8b66);box(games,colors.dark,0,1.5,1.39,2.85,2.3,.1);sign(games,'PLAY',0,2.68,1.48,2.7,.42,'#f5d882','#36545e');
 for(const x of[-.85,.85]){box(games,x<0?0xd99865:0x7899bd,x,.66,1.54,.69,1.28,.67);box(games,0x354f59,x,1.07,1.91,.5,.42,.04);box(games,0xa7d7cf,x,1.07,1.94,.38,.3,.025);box(games,0xe0c477,x,.77,1.94,.65,.13,.17);cylinder(games,0xd86f5c,x+.12,.88,1.96,.06,.1)}
 const controller=group(games,0,3.96,0);box(controller,0xf0d27d,0,0,0,2.18,.76,.64,[0,0,-.12]);box(controller,colors.dark,-.55,.12,.35,.4,.13,.08);box(controller,colors.dark,-.55,.12,.35,.13,.4,.09);ball(controller,0xd07c66,.47,.16,.35,.13,.13,.055);ball(controller,0x729caa,.78,-.04,.35,.13,.13,.055);
 // Tea shop: striped awning, serving counter and a giant cup.
 const tea=destination('tea',-1.8,5.2,5.45);box(tea,0xddd0ae,0,.1,0,4.05,.2,2.9);box(tea,0xd2dcc3,0,1.3,0,3.45,2.35,2.15);box(tea,colors.green,0,2.65,0,3.8,.3,2.65);box(tea,0x526a62,0,1.55,1.11,2.8,1.3,.07);box(tea,0xc7a878,0,.83,1.4,3.3,.18,.65);
 for(let i=0;i<10;i++){const x=-1.8+i*.4;box(tea,i%2?0xf6eed8:0xc58f6c,x,2.34,1.45,.4,.15,1.18,[.12,0,0]);box(tea,i%2?0xf6eed8:0xc58f6c,x,2.16,1.99,.4,.29,.09)}
 sign(tea,'TEA & A LITTLE CHAT',0,.44,1.19,2.65,.33,'#d2dcc3');
 for(let i=0;i<3;i++){cylinder(tea,0xeedbb2,-.65+i*.65,1.07,1.33,.14,.35);box(tea,0x718a68,-.65+i*.65,1.37,1.33,.035,.32,.035)}
 cylinder(tea,0xfff2d5,0,3.68,-.18,.67,1.55);cylinder(tea,colors.green,0,4.51,-.18,.74,.18);box(tea,0xd7ba72,.21,4.98,-.18,.13,.85,.13,[0,0,-.16]);
 for(let i=0;i<5;i++)ball(tea,0x77836b,Math.cos(i*1.8)*.42,3.05+(i%2)*.13,.34,.095,.095,.075);
 for(const x of[-1.2,1.2]){cylinder(tea,0x876e51,x,.3,2.25,.1,.6);cylinder(tea,0xcdad79,x,.63,2.25,.32,.12)}
 // Clock tower and tiny public square.
 const tower=group(world,1,GROUND,-.3);cylinder(tower,0xe4cf9f,0,.15,0,1.03,.3);box(tower,0xf4e6bf,0,1.9,0,1.05,3.6,1.05);box(tower,0xe1c38d,0,3.18,0,1.6,1.15,1.6);primitive(tower,'cone',0x536e7b,0,4.35,0,1.21,1.28,1.21,[0,Math.PI/4,0]);box(tower,0xd1b36e,0,5.16,0,.055,.65,.055);box(tower,0xf0d17c,.31,5.28,0,.6,.27,.04);
 const clockCanvas=document.createElement('canvas');clockCanvas.width=clockCanvas.height=256;const clockCtx=clockCanvas.getContext('2d');clockCtx.fillStyle='#fff5d8';clockCtx.fillRect(0,0,256,256);clockCtx.strokeStyle='#72633f';clockCtx.lineWidth=8;clockCtx.beginPath();clockCtx.arc(128,128,112,0,Math.PI*2);clockCtx.stroke();for(let i=0;i<12;i++){const a=i*Math.PI/6;clockCtx.beginPath();clockCtx.moveTo(128+Math.sin(a)*89,128-Math.cos(a)*89);clockCtx.lineTo(128+Math.sin(a)*100,128-Math.cos(a)*100);clockCtx.lineWidth=4;clockCtx.stroke()}const now=new Date();for(const [a,r,w]of[[(now.getHours()%12+now.getMinutes()/60)*Math.PI/6,53,8],[now.getMinutes()*Math.PI/30,79,5]]){clockCtx.beginPath();clockCtx.moveTo(128,128);clockCtx.lineTo(128+Math.sin(a)*r,128-Math.cos(a)*r);clockCtx.lineWidth=w;clockCtx.stroke()}const clockTexture=new THREE.CanvasTexture(clockCanvas);clockTexture.colorSpace=THREE.SRGBColorSpace;const face=new THREE.Mesh(new THREE.CircleGeometry(.56,32),new THREE.MeshBasicMaterial({map:clockTexture}));face.position.set(0,3.2,.82);tower.add(face);
 // A wooden pier and small ferry make the water feel inhabited.
 const dock=group(world,6.2,0,9.9);for(let i=0;i<11;i++)box(dock,0xbe9b6c,0,.87,i*.32,1.8,.16,.27);for(const z of[0,1.4,3.2])for(const x of[-.85,.85]){box(dock,0x967c59,x,.65,z,.13,1.7,.13);ball(dock,0xe4d0a3,x,1.52,z,.16,.1,.16)}box(dock,0xb89b70,-.85,1.22,1.6,.09,.1,3.3);box(dock,0xb89b70,.85,1.22,1.6,.09,.1,3.3);
 for(let i=0;i<4;i++)box(world,0xd6bd91,6.2,2.38-i*.4,8.1+i*.4,1.65,.22,.43);
 const ferry=group(scene,5,.16,15);ferry.userData.moving=true;const hull=new THREE.Mesh(new THREE.CylinderGeometry(.9,.55,2.8,6),material(0xf6e9c5));hull.rotation.x=Math.PI/2;hull.scale.set(1,.72,.42);ferry.add(hull);box(ferry,0x5f8b8a,0,.31,0,1.4,.38,2);box(ferry,0xf1e7c4,0,.87,-.1,1.05,.85,1.1);box(ferry,0xbb8660,0,1.35,-.1,1.3,.13,1.35);box(ferry,0x88aaa8,0,1.02,.47,.75,.36,.03);box(ferry,0xbfa16c,.5,1.86,-.65,.04,.95,.04);box(ferry,0xe5c775,.75,2.1,-.65,.5,.28,.025);
 const trees=[[-10,-1,1],[-9,-4,.8],[-7.6,-5.6,.8],[-6,-7.4,.8],[-.1,-7.5,.9],[2.9,-6.8,.9],[6.6,-5.2,1.1],[8.6,-3.7,.7],[9.6,.2,.9],[8.2,3.4,.85],[6.4,5.4,.75],[3,7,.8],[-5.3,6.1,.8],[-8.1,3.8,1],[-9.5,1.6,.6]];trees.forEach(([x,z,s],i)=>makeTree(world,x,z,s,i));
 bench(world,-7.8,2.65,.25);bench(world,3.45,4.25,-.5);
 const pebbles=[[12,4],[11,6],[-13,2],[-12,4],[9,10],[-10,-8],[6,-10.5]];pebbles.forEach(([x,z],i)=>{const stone=primitive(world,'pebble',0xa5b3a5,x,.05,z,.65+(i%2)*.3,.3,.6);stone.rotation.y=i});
 const hosts=[penguin(world,-3.1,6.8),penguin(world,4,1.3,true)];
 const clouds=[];for(const [x,y,z,size]of[[-14,10,-7,1],[12,11,-10,1.15],[-1,13,-15,.8]]){const cloud=group(scene,x,y,z);cloud.userData.moving=true;for(const [dx,dy,dz,r]of[[-1,0,0,.8],[0,.25,0,1.1],[1.1,0,0,.75],[.5,.05,.45,.75]]){const part=ball(cloud,0xfffae9,dx*size,dy*size,dz*size,r*size,.52*size,r*.65*size);part.castShadow=false}clouds.push({group:cloud,x})}
 batchStatic(world);
 for(const child of world.children)if(child.isInstancedMesh&&child.userData.place)interactive.push(child);
 return {world,artSurfaces,interactive,anchors,hosts,clouds,ferry,windowMaterials:[...materials.values()].filter(m=>m.emissive.getHex()!==0)};
}
