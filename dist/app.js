(() => {
  'use strict';
  const W = 432, H = 304, FLOOR = 272, NET = 216, NET_TOP = 176, R = 19, TARGET = 15;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const el = id => document.getElementById(id);
  const keys = new Set();
  const touch = new Set();
  const state = {
    phase: 'menu', mode: 'single', score: [0,0], server: 0, tick: 0, wait: 0,
    players: [], ball: null, sound: true, audio: null, pointSide: -1
  };
  const rand = (() => { let seed = 531997; return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; })();
  function rect(c,x,y,w,h) { ctx.fillStyle=c; ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h)); }
  function path(points, fill, stroke='#111', width=2) {
    ctx.beginPath(); ctx.moveTo(points[0][0],points[0][1]);
    for(let i=1;i<points.length;i++) ctx.lineTo(points[i][0],points[i][1]);
    ctx.closePath(); ctx.fillStyle=fill; ctx.fill(); if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.lineJoin='round';ctx.stroke();}
  }
  function circle(x,y,r,fill,stroke='',width=1) {
    ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();
    if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
  }
  function sound(freq=440,dur=.08,kind='square') {
    if(!state.sound) return;
    try {
      const A = window.AudioContext || window.webkitAudioContext;
      state.audio ||= new A();
      if(state.audio.state==='suspended') state.audio.resume();
      const o=state.audio.createOscillator(), g=state.audio.createGain(), t=state.audio.currentTime;
      o.type=kind;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(80,freq*.7),t+dur);
      g.gain.setValueAtTime(.07,t);g.gain.exponentialRampToValueAtTime(.001,t+dur);
      o.connect(g);g.connect(state.audio.destination);o.start(t);o.stop(t+dur);
    } catch (_) {}
  }
  function makePlayer(side) {
    return {x:side===0?62:370,y:244,vy:0,side,face:side===0?1:-1,ground:true,
      dive:0,hit:0,cool:0,blink:0,move:0,lastHit:false,lastJump:false,lastDive:false};
  }
  function show(which) {
    el('overlay').classList.toggle('hidden',!which);
    for(const id of ['menu','pause','end']) el(id).classList.toggle('hidden',id!==which);
  }
  function resetRound() {
    state.players=[makePlayer(0),makePlayer(1)];
    const x=state.server===0?80:352;
    state.ball={x,y:80,vx:0,vy:0,spin:0,owner:-1,shadow:0};
    state.wait=82;
    state.pointSide=-1;
  }
  function start(mode=state.mode) {
    state.mode=mode;state.phase='play';state.score=[0,0];state.server=0;state.tick=0;
    resetRound();show(null);sound(630,.12);
  }
  function menu() { state.phase='menu';state.score=[0,0];resetRound();show('menu'); }
  function togglePause() {
    if(state.phase==='play'){state.phase='pause';show('pause');}
    else if(state.phase==='pause'){state.phase='play';show(null);}
  }
  function winPoint(side) {
    if(state.phase!=='play'||state.pointSide>=0) return;
    state.pointSide=side;state.score[side]++;state.server=side;state.wait=98;
    sound(side===0?750:340,.16);
  }
  function finish() {
    state.phase='end';
    el('winner').textContent=(state.mode==='single' ? (state.score[0]>state.score[1]?'你贏了！':'電腦獲勝') : (state.score[0]>state.score[1]?'1P 獲勝！':'2P 獲勝！'));
    show('end'); sound(880,.24,'triangle');
  }
  function held(side,action) {
    if(side===0) {
      const codes={left:['ArrowLeft'],right:['ArrowRight'],jump:['ArrowUp'],dive:['ArrowDown'],hit:['Enter','KeyZ']};
      return touch.has(action)||codes[action].some(k=>keys.has(k));
    }
    const codes={left:['KeyA'],right:['KeyD'],jump:['KeyW'],dive:['KeyS'],hit:['Space','KeyF']};
    return codes[action].some(k=>keys.has(k));
  }
  function cpuInput(p) {
    const b=state.ball;
    const active=b.x>NET-22 || b.vx>1.7;
    let target=354;
    if(active) {
      let t=0, yy=b.y, vy=b.vy, xx=b.x, vx=b.vx;
      while(yy<252 && t<75) {
        vy+=.23;yy+=vy;xx+=vx;
        if(xx>W-R){xx=W-R;vx=-Math.abs(vx);}
        if(xx<NET+R){xx=NET+R;vx=Math.abs(vx);}
        t++;
      }
      target=Math.max(245,Math.min(398,xx));
      if(b.x<NET-25&&b.vx<0) target=350;
    }
    const dx=target-p.x;
    const near=Math.abs(b.x-p.x)<58&&b.y<p.y+25&&b.y>p.y-105;
    return {left:dx<-7,right:dx>7,jump:near&&b.y<p.y-30&&b.vy>-.5&&p.ground,
      dive:near&&b.y>p.y-18&&b.vy>2&&Math.abs(dx)>23,
      hit:near&&b.y<p.y-16&&(!p.ground||b.y<p.y-45)};
  }
  function playerInput(side) {
    if(side===1&&state.mode==='single') return cpuInput(state.players[side]);
    return {left:held(side,'left'),right:held(side,'right'),jump:held(side,'jump'),
      dive:held(side,'dive'),hit:held(side,'hit')};
  }
  function stepPlayer(p,input) {
    const direction=(input.right?1:0)-(input.left?1:0);
    p.move=direction;
    if(direction) p.face=direction;
    if(p.cool>0) p.cool--;
    if(p.hit>0) p.hit--;
    if(p.blink>0) p.blink--;
    if(p.dive>0) p.dive--;
    if(input.jump&&!p.lastJump&&p.ground&&p.dive===0){p.vy=-8.3;p.ground=false;sound(430,.055);}
    if(input.dive&&!p.lastDive&&p.ground&&p.dive===0){p.dive=24;p.vy=-1.5;p.ground=false;p.face=direction||p.face;sound(260,.07);}
    if(input.hit&&!p.lastHit&&p.cool===0){p.hit=13;p.cool=18;p.blink=9;}
    p.lastJump=input.jump;p.lastHit=input.hit;p.lastDive=input.dive;
    p.x+=p.dive>0?p.face*4.7:direction*2.8;
    p.x=Math.max(p.side===0?31:NET+31,Math.min(p.side===0?NET-31:W-31,p.x));
    p.vy+=.36;p.y+=p.vy;
    if(p.y>=244){p.y=244;p.vy=0;p.ground=true;p.dive=0;}
  }
  function hitBall(p) {
    const b=state.ball, dx=b.x-p.x, dy=b.y-(p.y-16);
    const distance=Math.hypot(dx,dy);
    if(distance>49||distance<.01||b.owner===p.side&&b.shadow>0) return;
    const nx=dx/distance,ny=dy/distance;
    b.x=p.x+nx*50;b.y=p.y-16+ny*50;
    const attack=p.hit>0 && (!p.ground||p.dive>0);
    if(attack) {
      b.vx=(p.side===0?1:-1)*(p.dive>0?7:6.5);
      b.vy=-3.7+(ny>0?1.4:-1.3);
      p.hit=0; sound(850,.12,'sawtooth');
    } else {
      b.vx=Math.max(-5.7,Math.min(5.7,nx*3.9+(p.side===0?.55:-.55)+p.move*.45));
      b.vy=Math.min(-3.9,-4.8+ny*1.2+Math.min(0,p.vy*.28));
      sound(470,.07,'triangle');
    }
    b.owner=p.side;b.shadow=7;
  }
  function stepBall() {
    const b=state.ball;
    if(b.shadow>0) b.shadow--;
    b.vy=Math.min(8.5,b.vy+.23);b.x+=b.vx;b.y+=b.vy;b.spin+=b.vx*.02;
    if(b.x<R){b.x=R;b.vx=Math.abs(b.vx)*.88;sound(250,.04);}
    if(b.x>W-R){b.x=W-R;b.vx=-Math.abs(b.vx)*.88;sound(250,.04);}
    if(b.y<R){b.y=R;b.vy=Math.abs(b.vy)*.82;}
    if(Math.abs(b.x-NET)<R+5&&b.y+R>NET_TOP&&b.y-R<300) {
      if(b.y<NET_TOP&&b.vy>0&&Math.abs(b.x-NET)<R){b.y=NET_TOP-R;b.vy=-Math.abs(b.vy)*.76;}
      else if(b.x<NET){b.x=NET-R-5;b.vx=-Math.abs(b.vx)*.83;}
      else{b.x=NET+R+5;b.vx=Math.abs(b.vx)*.83;}
      sound(240,.045);
    }
    hitBall(state.players[0]);hitBall(state.players[1]);
    if(b.y>=252){b.y=252;winPoint(b.x<NET?1:0);}
  }
  function step() {
    state.tick++;
    if(state.phase!=='play') return;
    if(state.pointSide>=0){
      if(--state.wait<=0){
        if(Math.max(...state.score)>=TARGET) finish();
        else resetRound();
      }
      return;
    }
    const controls=state.players.map((_,i)=>playerInput(i));
    state.players.forEach((p,i)=>stepPlayer(p,controls[i]));
    if(state.wait>0) {
      state.wait--;
      if(state.wait===0){state.ball.vx=state.server===0?3.6:-3.6;state.ball.vy=-4.3;sound(620,.09);}
    } else stepBall();
  }
  const backdrop=document.createElement('canvas');backdrop.width=W;backdrop.height=H;
  function makeBackdrop() {
    const c=backdrop.getContext('2d');c.imageSmoothingEnabled=false;
    const sky=c.createLinearGradient(0,0,0,230);sky.addColorStop(0,'#5279cf');sky.addColorStop(1,'#8dc3eb');
    c.fillStyle=sky;c.fillRect(0,0,W,230);
    for(let i=0;i<6800;i++){const x=(rand()*W)|0,y=(rand()*216)|0;c.fillStyle=rand()>.5?'#86a5e4':'#3b5cb3';c.fillRect(x,y,1,1);}
    function cloud(x,y,w) {
      c.fillStyle='#181c28';c.fillRect(x+4,y,w-8,10);c.fillRect(x+10,y-4,w-22,17);
      c.fillStyle='#e9eced';c.fillRect(x+5,y+2,w-10,8);c.fillRect(x+11,y-2,w-24,13);
      c.fillStyle='#fff';c.fillRect(x+9,y,w-19,4);
      for(let i=0;i<w/3;i++){c.fillStyle=rand()>.5?'#bbc0c8':'#8193cc';c.fillRect(x+6+rand()*(w-13),y+rand()*8,1,1);}
    }
    cloud(27,80,38);cloud(136,45,48);cloud(294,94,43);cloud(369,46,49);
    c.fillStyle='#e9f3f4';
    for(let x=0;x<W;x+=3){const y=205+Math.sin(x*.06)*3+Math.sin(x*.19)*2;c.fillRect(x,y,5,18);}
    c.fillStyle='#345b2d';c.fillRect(0,226,W,32);
    for(let i=0;i<1500;i++){c.fillStyle=rand()>.5?'#426f37':'#223f2a';c.fillRect(rand()*W,225+rand()*29,2,1);}
    c.fillStyle='#d57070';c.fillRect(0,255,W,7);c.fillStyle='#e8c3a6';c.fillRect(0,262,W,15);
    c.fillStyle='#f8e6ac';c.fillRect(0,277,W,27);
    c.fillStyle='#171717';c.fillRect(0,276,W,2);c.fillRect(0,299,W,2);
    c.fillStyle='#fff8df';c.fillRect(7,274,190,2);c.fillRect(235,274,190,2);
    for(let i=0;i<3000;i++){const x=rand()*W,y=262+rand()*42;c.fillStyle=rand()>.5?'#bf805a':'#e8a6a0';c.fillRect(x,y,1,1);}
    c.strokeStyle='#111';c.lineWidth=1;c.beginPath();c.moveTo(0,300);c.lineTo(17,280);c.moveTo(W,300);c.lineTo(W-17,280);c.stroke();
  }
  makeBackdrop();
  function drawPika(p) {
    const x=Math.round(p.x),y=Math.round(p.y),flipped=p.side===1?-1:1;
    ctx.save();ctx.translate(x,y);ctx.scale(flipped,1);
    const bounce=p.ground&&p.move?Math.sin(state.tick*.6)*1:0;ctx.translate(0,bounce);
    ctx.fillStyle='#3338';ctx.beginPath();ctx.ellipse(0,29,27,4,0,0,Math.PI*2);ctx.fill();
    if(p.dive>0) {ctx.rotate(-.4);ctx.translate(p.face*3,3);}
    path([[-18,-13],[-31,-20],[-37,-34],[-48,-30],[-40,-17],[-50,-11],[-34,-10],[-21,-3]],'#ffe300');
    path([[-13,-29],[-23,-58],[-17,-63],[-6,-35]],'#ffe500');
    path([[7,-29],[8,-63],[16,-60],[18,-31]],'#ffe500');
    path([[-23,-58],[-17,-63],[-14,-51],[-19,-49]],'#17120a',null);
    path([[8,-63],[16,-60],[17,-49],[9,-50]],'#17120a',null);
    path([[-24,-16],[-21,-28],[-9,-35],[14,-33],[27,-23],[29,-6],[22,19],[9,29],[-16,27],[-29,16]],'#ffe400','#15120c',2);
    path([[-18,20],[-27,26],[-8,29],[-1,24]],'#ffe400');
    path([[10,21],[5,28],[24,26],[23,19]],'#ffe400');
    path([[-22,-9],[-30,0],[-23,6],[-14,-3]],'#ffe400');
    path([[22,-6],[31,0],[24,8],[14,-3]],'#ffe400');
    circle(-10,-18,2.5,'#111');circle(14,-17,2.5,'#111');
    circle(-17,-8,5,'#ed2633');circle(20,-7,5,'#ed2633');
    circle(3,-10,2,'#111');
    path([[0,-5],[4,-3],[8,-5]],'#111',null);
    if(p.hit>0) {ctx.fillStyle='#fff';ctx.fillRect(26,-31,8,3);ctx.fillRect(30,-37,3,15);}
    if(p.blink>0) {ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.strokeRect(-30,-34,61,62);}
    ctx.restore();
  }
  function drawNet() {
    rect('#181818',NET-3,173,6,131);rect('#f5b8ae',NET-1,178,3,124);
    circle(NET,176,5,'#f8ecdf','#171717',2);circle(NET,176,1,'#d25656');
  }
  function drawBall() {
    const b=state.ball;
    ctx.fillStyle='#2227';ctx.beginPath();ctx.ellipse(b.x,273,Math.max(8,18-(252-b.y)*.03),3,0,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.translate(Math.round(b.x),Math.round(b.y));ctx.rotate(b.spin);
    circle(0,0,R,'#f5f3e6','#111',2);
    ctx.beginPath();ctx.arc(0,0,R-2,Math.PI,0);ctx.closePath();ctx.fillStyle='#e1241b';ctx.fill();
    rect('#111',-R+2,-2,R*2-4,4);
    circle(0,0,6,'#fff','#111',2);circle(0,0,2,'#b8b8b8');
    ctx.restore();
  }
  function drawScore() {
    ctx.textAlign='center';ctx.textBaseline='top';ctx.lineJoin='round';
    ctx.font='bold 45px Arial Black, sans-serif';ctx.lineWidth=4;ctx.strokeStyle='#111';ctx.fillStyle='#f32216';
    for(let i=0;i<2;i++){const x=i===0?54:378;const value=String(state.score[i]);ctx.strokeText(value,x,8);ctx.fillText(value,x,8);}
  }
  function drawNotice() {
    if(state.phase!=='play') return;
    let text='';
    if(state.pointSide>=0) text=state.pointSide===0?'1P 得分！':'2P 得分！';
    else if(state.wait>0) text='READY?';
    if(!text) return;
    ctx.font='bold 28px Arial Black, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineWidth=3;
    ctx.strokeStyle='#111';ctx.fillStyle='#ffef6a';ctx.strokeText(text,W/2,107);ctx.fillText(text,W/2,107);
  }
  function render() {
    ctx.drawImage(backdrop,0,0);
    drawScore();
    drawPika(state.players[0]);drawPika(state.players[1]);drawNet();drawBall();drawNotice();
  }
  let then=performance.now(),acc=0;
  function frame(now) {
    acc+=Math.min(60,now-then);then=now;
    while(acc>=1000/60){step();acc-=1000/60;}
    render();requestAnimationFrame(frame);
  }
  function bindButton(button) {
    const key=button.dataset.key;
    button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);touch.add(key);button.classList.add('pressed');});
    const release=e=>{e.preventDefault();touch.delete(key);button.classList.remove('pressed');};
    button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
  }
  document.querySelectorAll('[data-key]').forEach(bindButton);
  const gameCodes=new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter','KeyZ','KeyA','KeyD','KeyW','KeyS','Space','KeyF']);
  window.addEventListener('keydown',e=>{
    if(gameCodes.has(e.code)){e.preventDefault();keys.add(e.code);}
    if(e.code==='Escape'||e.code==='KeyP'){e.preventDefault();togglePause();}
  });
  window.addEventListener('keyup',e=>{keys.delete(e.code);});
  window.addEventListener('blur',()=>{keys.clear();touch.clear();document.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'));if(state.phase==='play')togglePause();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.phase==='play')togglePause();});
  el('single').addEventListener('click',()=>start('single'));
  el('versus').addEventListener('click',()=>start('versus'));
  el('resume').addEventListener('click',togglePause);
  el('restart').addEventListener('click',()=>start());
  el('again').addEventListener('click',()=>start());
  el('back').addEventListener('click',menu);
  el('pauseButton').addEventListener('click',togglePause);
  el('homeButton').addEventListener('click',menu);
  el('sound').addEventListener('click',()=>{state.sound=!state.sound;el('sound').textContent=state.sound?'♫ ON':'♫ OFF';if(state.sound)sound(670,.08);});
  resetRound();requestAnimationFrame(frame);
  if('serviceWorker' in navigator&&location.protocol==='https:') window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();
