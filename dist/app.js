(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = 800, H = 480, GROUND = 418, NET = 400, NET_TOP = 234, BALL_R = 16, WIN = 7;
  const $ = id => document.getElementById(id);
  const panels = ['menuPanel','pausePanel','endPanel','onlinePanel'];
  const levels = {
    easy: {label:'新手',speed:155,delay:.44,error:48,jump:.62,spike:.23},
    normal: {label:'普通',speed:225,delay:.22,error:22,jump:.82,spike:.55},
    hard: {label:'高手',speed:290,delay:.09,error:6,jump:.96,spike:.88}
  };
  let difficulty = localStorage.getItem('pika-level') || 'normal';
  if (!levels[difficulty]) difficulty = 'normal';
  let soundOn = localStorage.getItem('pika-sound') !== 'off';
  let audioCtx = null;
  const input = {left:false,right:false,jump:false,hit:false};
  const game = {
    mode:'menu', score:[0,0], roundTimer:0, pointTimer:0, pointWinner:0,
    server:0, rally:0, flash:0, particles:[], time:0,
    player:{x:190,y:GROUND-37,vy:0,onGround:true,face:1,hitWindow:0,hitCooldown:0,hitGlow:0},
    cpu:{x:610,y:GROUND-37,vy:0,onGround:true,face:-1,hitWindow:0,hitCooldown:0,hitGlow:0,think:0,target:610},
    ball:{x:245,y:260,vx:0,vy:0,spin:0,lastTouch:-1}
  };

  function showPanel(id) {
    panels.forEach(name => $(name).classList.toggle('hidden', name !== id));
    $('overlay').classList.toggle('hidden', !id && game.mode === 'playing');
    $('countdown').classList.add('hidden');
    $('pointToast').classList.add('hidden');
  }
  function updateDifficulty() {
    document.querySelectorAll('.difficulty-btn').forEach(button => button.classList.toggle('selected', button.dataset.level === difficulty));
    $('statusText').textContent = game.mode === 'menu' ? `挑戰 ${levels[difficulty].label} 電腦 · 先得 7 分獲勝` : `對戰 ${levels[difficulty].label} 電腦 · 先得 7 分獲勝`;
  }
  function updateScore() {
    $('playerScore').textContent = game.score[0];
    $('cpuScore').textContent = game.score[1];
  }
  function beep(frequency=440,duration=.08,type='square',volume=.055) {
    if (!soundOn) return;
    try {
      audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const oscillator=audioCtx.createOscillator(), gain=audioCtx.createGain();
      oscillator.type=type; oscillator.frequency.setValueAtTime(frequency,audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(80,frequency*.68),audioCtx.currentTime+duration);
      gain.gain.setValueAtTime(volume,audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);
      oscillator.connect(gain).connect(audioCtx.destination);
      oscillator.start(); oscillator.stop(audioCtx.currentTime+duration);
    } catch (_) { /* Audio is optional. */ }
  }
  function vibrate(ms=18) { if (navigator.vibrate) navigator.vibrate(ms); }
  function resetPlayers() {
    Object.assign(game.player,{x:190,y:GROUND-37,vy:0,onGround:true,face:1,hitWindow:0,hitCooldown:0,hitGlow:0});
    Object.assign(game.cpu,{x:610,y:GROUND-37,vy:0,onGround:true,face:-1,hitWindow:0,hitCooldown:0,hitGlow:0,think:0,target:610});
  }
  function prepareRound(server=0) {
    game.server=server;
    resetPlayers();
    Object.assign(game.ball,{x:server===0?220:580,y:270,vx:0,vy:0,spin:0,lastTouch:server});
    game.roundTimer=3.15;
    game.mode='countdown';
    showPanel(null);
    $('countdown').classList.remove('hidden');
    $('countdown').textContent='3';
    $('pauseButton').classList.remove('hidden');
  }
  function startGame() {
    game.score=[0,0]; game.rally=0; game.particles=[];
    updateScore(); updateDifficulty(); prepareRound(0);
    beep(620,.12);
  }
  function menu() {
    game.mode='menu'; game.score=[0,0]; game.particles=[]; updateScore(); updateDifficulty();
    $('pauseButton').classList.add('hidden'); showPanel('menuPanel');
  }
  function pause() {
    if (game.mode !== 'playing' && game.mode !== 'countdown') return;
    game.previousMode=game.mode; game.mode='paused'; showPanel('pausePanel');
    $('pauseButton').classList.add('hidden');
  }
  function resume() {
    if (game.mode !== 'paused') return;
    game.mode=game.previousMode;
    showPanel(null);
    if(game.mode==='countdown') { $('countdown').classList.remove('hidden'); $('countdown').textContent=Math.max(1,Math.ceil(game.roundTimer)); }
    $('pauseButton').classList.remove('hidden');
  }
  function finish() {
    game.mode='gameover';
    const won=game.score[0]>game.score[1];
    $('endIcon').textContent=won?'🏆':'⚡';
    $('endTitle').textContent=won?'你贏了！':'再接再厲！';
    $('endText').textContent=`比數 ${game.score[0]} : ${game.score[1]} · ${won?'精彩的一場！':'再挑戰一次，把勝利拿回來。'}`;
    $('pauseButton').classList.add('hidden'); showPanel('endPanel');
    beep(won?880:240,.25,'triangle',.09);
  }
  function point(winner) {
    if(game.mode!=='playing') return;
    game.score[winner]++; updateScore(); game.pointWinner=winner; game.pointTimer=1.35;
    game.mode='point'; game.flash=1;
    $('overlay').classList.remove('hidden');
    $('pointToast').textContent=winner===0?'你得分！':'電腦得分！';
    $('pointToast').classList.remove('hidden');
    burst(game.ball.x,Math.min(game.ball.y,GROUND-20),winner===0?'#ffd23c':'#ff8d78',15);
    beep(winner===0?710:310,.2,'square',.075); vibrate(40);
  }
  function jump(character, power=1) {
    if(character.onGround) { character.vy=-625*power; character.onGround=false; beep(320,.065,'triangle',.03); }
  }
  function hit(character) {
    if(character.hitCooldown>0) return;
    character.hitWindow=.18; character.hitCooldown=.37; character.hitGlow=.23;
    beep(680,.07,'sawtooth',.035);
  }
  function burst(x,y,color,count=9) {
    for(let i=0;i<count;i++) { const a=Math.random()*Math.PI*2,s=60+Math.random()*170;
      game.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-50,life:.4+Math.random()*.25,color,size:2+Math.random()*4});
    }
  }
  function moveCharacter(ch,move,dt,leftSide,speed) {
    ch.x+=move*speed*dt;
    ch.x=Math.max(leftSide?39:NET+40,Math.min(leftSide?NET-40:W-39,ch.x));
    if(move) ch.face=move>0?1:-1;
    ch.vy+=1240*dt; ch.y+=ch.vy*dt;
    if(ch.y>=GROUND-37){ch.y=GROUND-37;ch.vy=0;ch.onGround=true;}
    ch.hitWindow=Math.max(0,ch.hitWindow-dt);
    ch.hitCooldown=Math.max(0,ch.hitCooldown-dt);
    ch.hitGlow=Math.max(0,ch.hitGlow-dt);
  }
  function updateAI(dt) {
    const cpu=game.cpu, b=game.ball, cfg=levels[difficulty];
    cpu.think-=dt;
    if(cpu.think<=0) {
      cpu.think=cfg.delay;
      let target=610;
      if(b.x>NET-70 || b.vx>0) {
        const fall=Math.max(0,Math.min(1.2,(-b.vy+Math.sqrt(Math.max(0,b.vy*b.vy+2*760*(GROUND-BALL_R-b.y))))/760));
        target=b.x+b.vx*fall*.75;
        while(target>W-BALL_R || target<NET+BALL_R) {
          if(target>W-BALL_R) target=2*(W-BALL_R)-target;
          if(target<NET+BALL_R) target=2*(NET+BALL_R)-target;
        }
        target+=Math.sin(game.time*3.7)*cfg.error;
      }
      cpu.target=Math.max(NET+48,Math.min(W-48,target));
    }
    const dx=cpu.target-cpu.x;
    moveCharacter(cpu,Math.abs(dx)>11?Math.sign(dx):0,dt,false,cfg.speed);
    if(b.x>NET+18 && Math.abs(b.x-cpu.x)<88 && b.y<cpu.y+10 && b.y>cpu.y-150 && b.vy>0 && cpu.onGround && Math.random()<cfg.jump*dt*7) jump(cpu);
    if(Math.hypot(b.x-cpu.x,b.y-cpu.y)<82 && cpu.hitCooldown<=0 && Math.random()<cfg.spike*dt*15) hit(cpu);
  }
  function resolvePlayerCollision(ch,index) {
    const b=game.ball;
    const dx=b.x-ch.x, dy=b.y-(ch.y-7), dist=Math.hypot(dx,dy);
    if(dist>=BALL_R+34 || dist<.01) return;
    const nx=dx/dist,ny=dy/dist;
    b.x=ch.x+nx*(BALL_R+35); b.y=ch.y-7+ny*(BALL_R+35);
    const spike=ch.hitWindow>0;
    if(spike) {
      const dir=index===0?1:-1;
      b.vx=dir*660;
      b.vy=-210-(Math.max(0,-ny)*110);
      ch.hitWindow=0;
      burst(b.x,b.y,'#fff9ad',12); beep(850,.13,'sawtooth',.085); vibrate(23);
    } else {
      b.vx=Math.max(-500,Math.min(500,nx*350+(index===0?95:-95)));
      b.vy=Math.min(-300,ny*380-300+Math.min(0,ch.vy*.3));
      beep(460,.07,'triangle',.045);
      burst(b.x,b.y,'#ffffff',4);
    }
    b.lastTouch=index; game.rally++;
  }
  function updateBall(dt) {
    const b=game.ball;
    b.vy+=760*dt; b.x+=b.vx*dt; b.y+=b.vy*dt; b.spin+=b.vx*dt*.012;
    if(b.x<BALL_R){b.x=BALL_R;b.vx=Math.abs(b.vx)*.9;beep(270,.05)}
    if(b.x>W-BALL_R){b.x=W-BALL_R;b.vx=-Math.abs(b.vx)*.9;beep(270,.05)}
    if(b.y<BALL_R){b.y=BALL_R;b.vy=Math.abs(b.vy)*.8}
    const overlapNet=b.x+BALL_R>NET-6 && b.x-BALL_R<NET+6;
    if(overlapNet && b.y+BALL_R>NET_TOP && b.y-BALL_R<GROUND) {
      if(b.y<NET_TOP && b.vy>0){b.y=NET_TOP-BALL_R;b.vy=-Math.abs(b.vy)*.7;b.vx*=.75;}
      else if(b.x<NET){b.x=NET-6-BALL_R;b.vx=-Math.abs(b.vx)*.8;}
      else{b.x=NET+6+BALL_R;b.vx=Math.abs(b.vx)*.8;}
      beep(250,.07);
    }
    resolvePlayerCollision(game.player,0); resolvePlayerCollision(game.cpu,1);
    if(b.y+BALL_R>=GROUND){b.y=GROUND-BALL_R;point(b.x<NET?1:0)}
  }
  function update(dt) {
    game.time+=dt; game.flash=Math.max(0,game.flash-dt*2);
    game.particles=game.particles.filter(p=>p.life>0);
    for(const p of game.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=260*dt;p.life-=dt;}
    if(game.mode==='countdown') {
      const before=Math.ceil(game.roundTimer);
      game.roundTimer-=dt;
      const after=Math.ceil(game.roundTimer);
      if(after!==before && after>0) { $('countdown').textContent=String(after); beep(560,.07); }
      if(game.roundTimer<=0) {
        game.mode='playing'; $('countdown').classList.add('hidden'); $('overlay').classList.add('hidden');
        game.ball.vx=game.server===0?280:-280; game.ball.vy=-380; beep(780,.15);
      }
      return;
    }
    if(game.mode==='point') {
      game.pointTimer-=dt;
      if(game.pointTimer<=0) { $('pointToast').classList.add('hidden'); if(Math.max(...game.score)>=WIN) finish(); else prepareRound(game.pointWinner); }
      return;
    }
    if(game.mode!=='playing') return;
    if(input.jump) jump(game.player);
    if(input.hit) hit(game.player);
    moveCharacter(game.player,(input.right?1:0)-(input.left?1:0),dt,true,290);
    updateAI(dt);
    updateBall(dt);
  }

  function rect(x,y,w,h,fill){ctx.fillStyle=fill;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
  function ellipse(x,y,rx,ry,fill){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();}
  function line(points,stroke,width=3){ctx.beginPath();ctx.moveTo(...points[0]);for(let i=1;i<points.length;i++)ctx.lineTo(...points[i]);ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();}
  function renderBackground() {
    const sky=ctx.createLinearGradient(0,0,0,GROUND);sky.addColorStop(0,'#8ddae9');sky.addColorStop(1,'#d7f4d0');rect(0,0,W,GROUND,sky);
    ellipse(675,90,46,46,'#ffed9e');
    const cloud=(x,y,s)=>{ellipse(x,y,33*s,14*s,'#fffbee');ellipse(x+24*s,y-10*s,25*s,20*s,'#fffbee');ellipse(x+49*s,y,34*s,15*s,'#fffbee')};
    cloud(105,82,1); cloud(482,126,.7); cloud(706,176,.6);
    ctx.beginPath();ctx.moveTo(0,330);ctx.lineTo(125,248);ctx.lineTo(245,336);ctx.lineTo(370,258);ctx.lineTo(505,345);ctx.lineTo(655,260);ctx.lineTo(800,335);ctx.lineTo(800,GROUND);ctx.lineTo(0,GROUND);ctx.fillStyle='#8dd0af';ctx.fill();
    ctx.beginPath();ctx.moveTo(0,356);ctx.lineTo(165,292);ctx.lineTo(340,355);ctx.lineTo(568,293);ctx.lineTo(800,356);ctx.lineTo(800,GROUND);ctx.lineTo(0,GROUND);ctx.fillStyle='#65bf98';ctx.fill();
    rect(0,GROUND-12,W,14,'#84bb68');rect(0,GROUND,W,H-GROUND,'#e7bc79');rect(0,GROUND+13,W,4,'#d4a265');
    for(let x=21;x<W;x+=45){rect(x,GROUND+30+(x%3)*4,16,3,'#d5a765')}
    for(let x=35;x<W;x+=86){rect(x,GROUND-17,4,8,'#3da678');rect(x-3,GROUND-13,3,5,'#3da678');rect(x+4,GROUND-13,3,5,'#3da678')}
    rect(38,GROUND+6,322,3,'#ffefd0');rect(440,GROUND+6,322,3,'#ffefd0');
  }
  function renderNet() {
    rect(NET-8,NET_TOP-3,16,GROUND-NET_TOP+8,'#243350');rect(NET-5,NET_TOP,10,GROUND-NET_TOP,'#fff5e4');
    for(let y=NET_TOP+13;y<GROUND-8;y+=18)rect(NET-5,y,10,3,'#b5bdbe');
    rect(NET-17,NET_TOP-11,34,13,'#243350');rect(NET-13,NET_TOP-9,26,7,'#fff4e0');
  }
  function renderPika(ch,cpu=false) {
    const x=ch.x,y=ch.y,face=ch.face;
    ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(face,1);
    const bob=ch.onGround?Math.sin(game.time*6+(cpu?2:0))*1.5:0;ctx.translate(0,bob);
    ellipse(0,38,37,8,'#97764f55');
    // Lightning tail, ears and body form a compact hand drawn sprite.
    ctx.beginPath();ctx.moveTo(-26,8);ctx.lineTo(-46,-7);ctx.lineTo(-40,-20);ctx.lineTo(-59,-27);ctx.lineTo(-42,-28);ctx.lineTo(-36,-46);ctx.lineTo(-30,-25);ctx.lineTo(-19,-19);ctx.closePath();ctx.fillStyle='#ffca3e';ctx.strokeStyle='#243350';ctx.lineWidth=4;ctx.fill();ctx.stroke();
    line([[-22,-20],[-25,-69],[-12,-80],[-2,-39]],'#243350',14);line([[-22,-20],[-25,-69],[-12,-80],[-2,-39]],'#ffda4b',9);
    line([[12,-29],[23,-79],[36,-84],[30,-25]],'#243350',14);line([[12,-29],[23,-79],[36,-84],[30,-25]],'#ffda4b',9);
    line([[-25,-64],[-12,-78]],'#243350',10);line([[23,-76],[35,-83]],'#243350',10);
    ellipse(0,1,33,38,'#243350');ellipse(0,-2,29,34,'#ffdb50');
    ellipse(-17,27,13,8,'#243350');ellipse(-17,25,10,6,'#ffe87b');ellipse(21,27,13,8,'#243350');ellipse(21,25,10,6,'#ffe87b');
    ellipse(-28,2,9,14,'#243350');ellipse(-28,1,6,11,'#ffdb50');ellipse(31,0,10,14,'#243350');ellipse(31,-1,7,11,'#ffdb50');
    ellipse(11,-25,3.8,6,'#243350');ellipse(-12,-25,3.8,6,'#243350');
    ellipse(-17,-12,8,7,'#f46a5c');ellipse(20,-12,8,7,'#f46a5c');
    ellipse(2,-16,3,2,'#243350');line([[-3,-12],[2,-9],[7,-12]],'#243350',2);
    if(cpu){rect(-26,-43,52,8,'#f27266');rect(-15,-43,12,8,'#fff3cb');}
    else{rect(-25,-43,50,8,'#5dbac7');rect(3,-43,11,8,'#fff3cb');}
    if(ch.hitGlow>0){ctx.globalAlpha=ch.hitGlow/.23;ctx.font='bold 32px system-ui';ctx.fillStyle='#fff05b';ctx.fillText('⚡',40,-32);ctx.globalAlpha=1;}
    ctx.restore();
  }
  function renderBall() {
    const b=game.ball;
    ellipse(b.x+5,GROUND+3,Math.max(8,20-(GROUND-b.y)*.018),4,'#8f6a4855');
    ctx.save();ctx.translate(b.x,b.y);ctx.rotate(b.spin);
    ellipse(0,0,BALL_R+2,BALL_R+2,'#243350');ellipse(0,0,BALL_R-1,BALL_R-1,'#fffbee');
    ctx.beginPath();ctx.arc(0,0,12,-1.1,.8);ctx.strokeStyle='#5bbfce';ctx.lineWidth=6;ctx.stroke();
    ctx.beginPath();ctx.arc(0,0,12,1.1,2.8);ctx.strokeStyle='#ffcc4b';ctx.lineWidth=6;ctx.stroke();
    ctx.beginPath();ctx.arc(0,0,12,3.1,4.3);ctx.strokeStyle='#f57d6d';ctx.lineWidth=6;ctx.stroke();
    ellipse(-4,-5,3,2,'#ffffff');ctx.restore();
  }
  function render() {
    ctx.clearRect(0,0,W,H);renderBackground();
    renderPika(game.player);renderPika(game.cpu,true);renderNet();renderBall();
    for(const p of game.particles){ctx.globalAlpha=Math.max(0,Math.min(1,p.life*2));rect(p.x,p.y,p.size,p.size,p.color)}
    ctx.globalAlpha=1;
    if(game.flash>0){ctx.globalAlpha=game.flash*.13;rect(0,0,W,H,'#ffffff');ctx.globalAlpha=1;}
  }
  let last=performance.now();
  function frame(now) {
    const dt=Math.min(.033,(now-last)/1000);last=now;
    if(game.mode!=='paused')update(dt);
    render();requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function bindControl(id,key) {
    const button=$(id);
    button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);input[key]=true;button.classList.add('pressed');if(key==='jump'&&game.mode==='playing')jump(game.player);if(key==='hit'&&game.mode==='playing')hit(game.player)});
    const release=event=>{event.preventDefault();input[key]=false;button.classList.remove('pressed')};
    button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',()=>{input[key]=false;button.classList.remove('pressed')});
  }
  bindControl('leftButton','left');bindControl('rightButton','right');bindControl('jumpButton','jump');bindControl('hitButton','hit');
  const keys={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'jump',Space:'jump',KeyW:'jump',KeyX:'hit',KeyJ:'hit'};
  window.addEventListener('keydown',event=>{if(keys[event.code]){event.preventDefault();if(!input[keys[event.code]]){if(keys[event.code]==='jump'&&game.mode==='playing')jump(game.player);if(keys[event.code]==='hit'&&game.mode==='playing')hit(game.player);}input[keys[event.code]]=true;}if(event.code==='KeyP'||event.code==='Escape'){event.preventDefault();game.mode==='paused'?resume():pause();}});
  window.addEventListener('keyup',event=>{if(keys[event.code]){event.preventDefault();input[keys[event.code]]=false;}});
  window.addEventListener('blur',()=>{Object.keys(input).forEach(key=>input[key]=false);pause()});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});
  document.querySelectorAll('.difficulty-btn').forEach(button=>button.addEventListener('click',()=>{difficulty=button.dataset.level;localStorage.setItem('pika-level',difficulty);updateDifficulty();beep(520,.07)}));
  $('startButton').addEventListener('click',startGame);
  $('playAgainButton').addEventListener('click',startGame);
  $('restartFromPause').addEventListener('click',startGame);
  $('backToMenuButton').addEventListener('click',menu);
  $('pauseButton').addEventListener('click',pause);
  $('resumeButton').addEventListener('click',resume);
  $('onlineButton').addEventListener('click',()=>{showPanel('onlinePanel')});
  $('onlineBackButton').addEventListener('click',()=>showPanel('menuPanel'));
  $('soundButton').addEventListener('click',()=>{soundOn=!soundOn;localStorage.setItem('pika-sound',soundOn?'on':'off');$('soundButton').classList.toggle('muted',!soundOn);$('soundButton').textContent=soundOn?'♫':'♪';if(soundOn)beep(660,.09)});
  $('soundButton').classList.toggle('muted',!soundOn);$('soundButton').textContent=soundOn?'♫':'♪';
  updateDifficulty();updateScore();showPanel('menuPanel');
  if('serviceWorker' in navigator && location.protocol==='https:')window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();
