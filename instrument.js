"use strict";

(() => {
  const $ = id => document.getElementById(id);
  const canvas = $("plate");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const presets = [
    {name:"铜花", m:3, n:7, b:1, palette:"copper"},
    {name:"潮汐", m:2, n:5, b:.64, palette:"ice"},
    {name:"织锦", m:6, n:10, b:1, palette:"leaf"},
    {name:"蝶翼", m:1, n:4, b:.88, palette:"copper"}
  ];
  const palettes = {
    copper:{rgb:[239,156,96], grains:["#a1663c","#cc8954","#eaae75","#f9cf93","#ffedd0"]},
    ice:{rgb:[108,187,210], grains:["#467782","#78aeb8","#a4d9e4","#c6edf0","#f1ffff"]},
    leaf:{rgb:[147,190,133], grains:["#608561","#8eb882","#bdd29b","#d4e7b2","#f4f1c1"]}
  };
  const sides = 144;
  const field = new Float32Array(sides*sides);
  const stepX = new Float32Array(field.length);
  const stepY = new Float32Array(field.length);
  const density = 9500;
  const x = new Float32Array(density), y = new Float32Array(density);
  const vx = new Float32Array(density), vy = new Float32Array(density);
  const size = new Float32Array(density);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const model = {m:3, n:7, b:1, palette:"copper"};
  let paused = reduced.matches, visible = true, held = null, frame = 0, last = 0, time = 0;
  let width = 1, height = 1, plateBounds, base, audio, voice, volume, activeAudio = false;
  let amount = density, serial = 17;
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
  const pad = n => String(n).padStart(2,"0");
  function random() {
    serial = (Math.imul(serial,1664525) + 1013904223) >>> 0;
    return serial / 4294967296;
  }
  function index(a,b) {
    return clamp(Math.round(b*(sides-1)),0,sides-1)*sides + clamp(Math.round(a*(sides-1)),0,sides-1);
  }
  function flat() { return model.m === model.n && Math.abs(model.b-1)<1e-7; }
  function compile() {
    const {m,n,b} = model;
    const cm=[],cn=[],dm=[],dn=[];
    for(let a=0;a<sides;a++){
      const p=Math.PI*a/(sides-1);
      cm[a]=Math.cos(m*p); cn[a]=Math.cos(n*p);
      dm[a]=-Math.PI*m*Math.sin(m*p); dn[a]=-Math.PI*n*Math.sin(n*p);
    }
    for(let j=0;j<sides;j++) for(let i=0;i<sides;i++){
      const k=j*sides+i;
      const value=cm[i]*cn[j]-b*cn[i]*cm[j];
      const dx=dm[i]*cn[j]-b*dn[i]*cm[j], dy=cm[i]*dn[j]-b*cn[i]*dm[j];
      const grad=dx*dx+dy*dy;
      field[k]=flat()?1:Math.abs(value)/Math.sqrt(grad+.00001);
      stepX[k]=clamp(-value*dx/(grad+.08),-.03,.03);
      stepY[k]=clamp(-value*dy/(grad+.08),-.03,.03);
    }
    base=null;
  }
  function sample(grain,settle) {
    let a=random(), b=random();
    if(settle && !flat() && random()>.09){
      for(let rep=0;rep<18;rep++){
        // Bilinear interpolation avoids snapping grains onto a visible sampling grid.
        const d=drift(a,b);
        a=clamp(a+d[0]*.65,.001,.999); b=clamp(b+d[1]*.65,.001,.999);
      }
      a+=(random()-.5)*.004; b+=(random()-.5)*.004;
    }
    x[grain]=clamp(a,0,1); y[grain]=clamp(b,0,1); vx[grain]=vy[grain]=0;
    size[grain]=.35+random()**2*1.08;
  }
  const vector = [0,0];
  function drift(a,b) {
    const u=clamp(a,0,.99999)*(sides-1), v=clamp(b,0,.99999)*(sides-1);
    const i=Math.floor(u), j=Math.floor(v), k=j*sides+i;
    const fu=u-i, fv=v-j, aa=(1-fu)*(1-fv),bb=fu*(1-fv),cc=(1-fu)*fv,dd=fu*fv;
    vector[0]=aa*stepX[k]+bb*stepX[k+1]+cc*stepX[k+sides]+dd*stepX[k+sides+1];
    vector[1]=aa*stepY[k]+bb*stepY[k+1]+cc*stepY[k+sides]+dd*stepY[k+sides+1];
    return vector;
  }
  function seed(settle) { for(let i=0;i<density;i++) sample(i,settle); }
  function advance(dt) {
    const rate=Math.min(dt*30,1.6);
    const friction=Math.pow(.79,rate);
    for(let i=0;i<amount;i++){
      const d=drift(x[i],y[i]);
      const noise=.00027*(.6+size[i]);
      vx[i]=friction*vx[i]+rate*(d[0]*.057+(random()-.5)*noise);
      vy[i]=friction*vy[i]+rate*(d[1]*.057+(random()-.5)*noise);
      x[i]=clamp(x[i]+vx[i]*rate,.001,.999); y[i]=clamp(y[i]+vy[i]*rate,.001,.999);
    }
  }
  function geometry(w,h) {
    const side=Math.min(w*.86,h*.90);
    return {side,left:(w-side)/2,top:(h-side)/2};
  }
  function backdrop(w,h) {
    const bg=document.createElement("canvas");
    bg.width=Math.ceil(w); bg.height=Math.ceil(h);
    const c=bg.getContext("2d"), {side,left,top}=geometry(w,h);
    const [red,green,blue]=palettes[model.palette].rgb;
    c.fillStyle="#121510";c.fillRect(0,0,w,h);
    const glow=c.createRadialGradient(w*.5,h*.48,0,w*.5,h*.48,side*.83);
    glow.addColorStop(0,"rgba("+red+","+green+","+blue+",.085)");glow.addColorStop(1,"transparent");
    c.fillStyle=glow;c.fillRect(0,0,w,h);
    const grid=w>420?22:18;
    c.fillStyle="rgba(225,220,175,.14)";
    for(let j=10;j<h;j+=grid) for(let i=10;i<w;i+=grid)c.fillRect(i,j,.8,.8);
    c.fillStyle="#1b1c16";c.fillRect(left,top,side,side);
    const lamp=c.createLinearGradient(left,top,left+side,top+side);
    lamp.addColorStop(0,"rgba("+red+","+green+","+blue+",.09)");lamp.addColorStop(.55,"rgba(45,44,32,.1)");lamp.addColorStop(1,"rgba(0,0,0,.20)");
    c.fillStyle=lamp;c.fillRect(left,top,side,side);
    c.strokeStyle="#67604b";c.lineWidth=.8;c.strokeRect(left-.5,top-.5,side+1,side+1);
    c.strokeStyle="#3f4134";
    for(let i=0;i<=20;i++){
      const a=side*i/20, len=i%5===0?7:3;
      c.beginPath();c.moveTo(left+a,top-2);c.lineTo(left+a,top-len-2);c.moveTo(left+side+2,top+a);c.lineTo(left+side+2+len,top+a);c.stroke();
    }
    // A repeatable matte grain remains on the plate as the larger grains move.
    let salt=1973;
    const next=()=>{salt=(Math.imul(salt,1664525)+1013904223)>>>0;return salt/4294967296;};
    for(let i=0;i<9500;i++){
      const a=next(),b=next(),distance=field[index(a,b)];
      c.fillStyle=distance<.004?"rgba("+red+","+green+","+blue+",.15)":"rgba(227,215,173,.055)";
      c.fillRect(left+a*side,top+b*side,.7,.7);
    }
    return bg;
  }
  function paint(c,w,h,background) {
    c.drawImage(background,0,0,w,h);
    const {side,left,top}=geometry(w,h), colors=palettes[model.palette].grains;
    const scale=side/420;
    for(let group=0;group<colors.length;group++){
      c.fillStyle=colors[group];
      for(let i=group;i<amount;i+=colors.length){
        const r=Math.max(.38,size[i]*scale);
        c.fillRect(left+x[i]*side,top+y[i]*side,r,r);
      }
    }
  }
  function draw() {
    if(!base)base=backdrop(width,height);
    paint(ctx,width,height,base);
  }
  function resize() {
    const rect=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,2);
    width=Math.max(1,rect.width); height=Math.max(1,rect.height);
    canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0);
    plateBounds=geometry(width,height);amount=width<480?6500:density;base=null;draw();
  }
  function tick(now) {
    frame=0;
    if(paused||!visible||document.hidden)return;
    if(!last||now-last>=32){
      const dt=last?Math.min((now-last)/1000,.06):.033;
      time+=dt;advance(dt);draw();last=now;
    }
    frame=requestAnimationFrame(tick);
  }
  function schedule() {
    cancelAnimationFrame(frame);frame=0;last=0;
    if(!paused&&visible&&!document.hidden)frame=requestAnimationFrame(tick);
  }
  function setPlay() {
    $("pause").textContent=paused?"继续":"暂停";
    $("pause").setAttribute("aria-pressed",String(paused));
    $("state").textContent=flat()?"模态相消 · 无节点线":paused?"振板已暂停":"沙粒运动中";
    schedule();
  }
  function scatterAt(a,b,all=false) {
    if(all){seed(false);draw();return;}
    const radius=.14;
    for(let i=0;i<amount;i++){
      const dx=x[i]-a,dy=y[i]-b,dist=Math.hypot(dx,dy);
      if(dist>=radius)continue;
      const force=(1-dist/radius)*.026, denom=Math.max(.002,dist);
      vx[i]+=dx/denom*force;vy[i]+=dy/denom*force;
      if(paused){x[i]=clamp(x[i]+vx[i]*2,0,1);y[i]=clamp(y[i]+vy[i]*2,0,1);}
    }
    if(paused)draw();
  }
  function point(event) {
    const box=canvas.getBoundingClientRect();
    return [(event.clientX-box.left-plateBounds.left)/plateBounds.side,(event.clientY-box.top-plateBounds.top)/plateBounds.side];
  }
  canvas.addEventListener("pointerdown",e=>{const [a,b]=point(e);if(a<0||a>1||b<0||b>1)return;held=e.pointerId;canvas.setPointerCapture(held);scatterAt(a,b);});
  canvas.addEventListener("pointermove",e=>{if(e.pointerId===held)scatterAt(...point(e));});
  canvas.addEventListener("lostpointercapture",()=>{held=null;});
  $("scatter").addEventListener("click",()=>scatterAt(.5,.5,true));
  $("pause").addEventListener("click",()=>{paused=!paused;setPlay();});
  reduced.addEventListener("change",()=>{paused=reduced.matches;if(paused)seed(true);draw();setPlay();});
  function pitch() { return Math.round(110*Math.hypot(model.m,model.n)/Math.sqrt(8)); }
  function updateTone(){
    $("pitch").textContent=pitch()+" Hz";
    if(voice)voice.frequency.setTargetAtTime(pitch(),audio.currentTime,.045);
  }
  function silence(){
    activeAudio=false;
    if(volume)volume.gain.setTargetAtTime(0,audio.currentTime,.025);
    $("sound").setAttribute("aria-pressed","false");
  }
  $("sound").addEventListener("click",async()=>{
    if(activeAudio){silence();return;}
    try{
      if(!audio){
        const Audio=window.AudioContext||window.webkitAudioContext;
        audio=new Audio();voice=audio.createOscillator();volume=audio.createGain();volume.gain.value=0;
        voice.connect(volume);volume.connect(audio.destination);voice.start();
      }
      await audio.resume();if(document.hidden)return;activeAudio=true;updateTone();
      volume.gain.setTargetAtTime(.055,audio.currentTime,.035);
      $("sound").setAttribute("aria-pressed","true");
    }catch{$("state").textContent="当前浏览器无法播放参考音";}
  });
  document.addEventListener("visibilitychange",()=>{if(document.hidden)silence();schedule();});
  window.addEventListener("pagehide",silence);
  function readUrl(){
    const params=new URLSearchParams(location.search);
    for(const [key,min,max] of [["m",1,12],["n",1,12],["b",0,1]]){
      const raw=params.get(key);if(raw===null||!raw.trim()||!Number.isFinite(Number(raw)))continue;
      const v=clamp(Number(raw),min,max);model[key]=key==="b"?Math.round(v*100)/100:Math.round(v);
    }
    if(Object.hasOwn(palettes,params.get("color")))model.palette=params.get("color");
  }
  function sync(updateUrl=false) {
    const {m,n,b,palette}=model;
    $("m").value=m;$("n").value=n;$("balance").value=b;
    $("m-out").value=pad(m);$("n-out").value=pad(n);$("balance-out").value=b.toFixed(2);
    $("plate-readout").textContent="MODE "+pad(m)+" / "+pad(n);
    for(const el of document.querySelectorAll("[data-palette]"))el.setAttribute("aria-pressed",String(el.dataset.palette===palette));
    for(const el of document.querySelectorAll(".preset")){
      const p=presets[Number(el.dataset.index)];
      el.setAttribute("aria-pressed",String(p.m===m&&p.n===n&&p.b===b&&p.palette===palette));
    }
    if(updateUrl&&location.protocol!=="file:"){
      const u=new URL(location.href);
      for(const [k,v] of [["m",m],["n",n],["b",b],["color",palette]])u.searchParams.set(k,v);
      history.replaceState(null,"",u);
    }
    updateTone();setPlay();
  }
  function changed(){
    compile();if(paused)seed(true);
    else for(let i=0;i<amount;i+=7)sample(i,false);
    sync(true);draw();
  }
  for(const [id,key] of [["m","m"],["n","n"],["balance","b"]]){
    $(id).addEventListener("input",()=>{model[key]=Number($(id).value);changed();});
  }
  for(const button of document.querySelectorAll("[data-palette]")){
    button.addEventListener("click",()=>{model.palette=button.dataset.palette;base=null;sync(true);draw();});
  }
  function thumbnail(p) {
    const thumb=document.createElement("canvas");thumb.width=thumb.height=76;
    const c=thumb.getContext("2d");c.fillStyle="#1b1c16";c.fillRect(0,0,76,76);
    c.fillStyle=palettes[p.palette].grains[3];
    for(let j=0;j<74;j++)for(let i=0;i<74;i++){
      const a=(i+.5)*Math.PI/74,b=(j+.5)*Math.PI/74;
      const value=Math.cos(p.m*a)*Math.cos(p.n*b)-p.b*Math.cos(p.n*a)*Math.cos(p.m*b);
      if(Math.abs(value)<.115)c.fillRect(i+1,j+1,1,1);
    }
    return thumb.toDataURL();
  }
  presets.forEach((p,i)=>{
    const button=document.createElement("button");button.type="button";button.className="preset";button.dataset.index=i;
    const image=new Image();image.src=thumbnail(p);image.alt="";
    const label=document.createElement("span"),name=document.createElement("b"),code=document.createElement("small");
    name.textContent=p.name;code.textContent=pad(p.m)+" / "+pad(p.n);
    label.append(name,code);button.append(image,label);$("presets").append(button);
    button.onclick=()=>{Object.assign(model,{m:p.m,n:p.n,b:p.b,palette:p.palette});changed();};
  });
  $("export").addEventListener("click",()=>{
    const print=document.createElement("canvas");print.width=1400;print.height=1490;
    const c=print.getContext("2d");paint(c,1400,1400,backdrop(1400,1400));
    c.fillStyle="#24231e";c.fillRect(0,1400,1400,90);
    c.fillStyle="#f2e9d9";c.font="bold 29px system-ui";c.fillText("声纹沙盘  /  Resonance Atlas",40,1456);
    c.textAlign="right";c.font="21px monospace";c.fillText("m "+model.m+"   n "+model.n+"   β "+model.b.toFixed(2)+"   "+model.palette,1360,1455);
    print.toBlob(blob=>{if(!blob)return;const link=document.createElement("a");link.download="resonance-"+model.m+"-"+model.n+"-"+model.palette+".png";link.href=URL.createObjectURL(blob);link.click();setTimeout(()=>URL.revokeObjectURL(link.href),15000);},"image/png");
  });
  readUrl();compile();seed(true);resize();sync();
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;schedule();}).observe(canvas);
})();
