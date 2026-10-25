const root=document.documentElement;
const body=document.body;
const opening=document.querySelector('#opening');
const video=document.querySelector('#openingVideo');
const openingFrame=document.querySelector('#openingFrame');
const progressBar=document.querySelector('#scrubProgress');
const storyPreview=document.querySelector('#storyPreview');
const storyStage=document.querySelector('#storyStage');
const storyVisual=document.querySelector('.story-visual');
const storyFrame=document.querySelector('#storyFrame');
const storyText=document.querySelector('#storyTitle');
const starfieldCanvas=document.querySelector('#starfieldCanvas');
const soundButton=document.querySelector('#soundButton');
const backButton=document.querySelector('#backButton');

const storyLines=[
  '默默是一只来自「无声星球」的兔子',
  '一场宇宙风暴夺走了他星球上所有的声音',
  '母亲用最后的声音保护了他',
  '并留下了一副封存着最后旋律的青蓝色耳机',
  '默默踏上星际旅程',
  '踩着月球在星空中行走',
  '将每颗星星的声音收进行囊',
  '希望有一天',
  '能让星球重新响起音乐'
];
let duration=0,targetTime=0,touchY=null,transitioning=false,seekRAF=0,lastOpeningSeek=0,openingEndTimer=0;
let storyReady=false,storyTrigger=null;
video.loop=false;video.autoplay=false;video.pause();
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const storyPlayer=createStorySequence(storyFrame,storyVisual,242);
video.addEventListener('loadeddata',()=>{
  if('requestIdleCallback' in window)requestIdleCallback(()=>storyPlayer.preload(),{timeout:2000});
  else setTimeout(()=>storyPlayer.preload(),1200);
},{once:true});

function renderOpening(time){
  const progress=duration>0?clamp(time/duration,0,1):0;
  root.style.setProperty('--progress',progress.toFixed(4));
  progressBar.setAttribute('aria-valuenow',String(Math.round(progress*100)));
}
// Follow the last decoded frame so slow seeks never accumulate a jump backlog.
function seekFrame(now){
  seekRAF=0;
  if(opening.hidden||transitioning||duration<=0||video.readyState<2||video.seeking)return;
  const frameDuration=1/30;
  const endTime=Math.max(0,(Math.ceil(duration*30)-2)/30);
  const goal=clamp(Math.round(targetTime*30)/30,0,endTime);
  const gap=goal-video.currentTime;
  renderOpening(video.currentTime);
  if(Math.abs(gap)<=.008){
    lastOpeningSeek=0;
    if(targetTime>=duration&&video.currentTime>=endTime-.008&&!openingEndTimer){
      // Give the decoded final frame a paint opportunity before hiding the opening.
      openingEndTimer=setTimeout(()=>{
        openingEndTimer=0;
        if(!opening.hidden&&!video.seeking&&video.readyState>=2&&targetTime>=duration&&video.currentTime>=endTime-.008)enterFirstStage();
      },120);
    }
    return;
  }
  const elapsed=lastOpeningSeek?clamp(now-lastOpeningSeek,8,50):16.7;
  lastOpeningSeek=now;
  const eased=gap*(1-Math.exp(-elapsed/180));
  // Seek once per actual video frame; sub-frame seeks decode the same image again.
  const step=Math.sign(gap)*Math.min(Math.abs(gap),Math.max(frameDuration,Math.min(Math.abs(eased),.16)));
  const nextTime=clamp(Math.round((video.currentTime+step)*30)/30,0,endTime);
  try{video.currentTime=nextTime;}catch{lastOpeningSeek=0;return;}
  queueOpeningSeek();
}
function queueOpeningSeek(){
  if(!seekRAF&&!opening.hidden&&!transitioning)seekRAF=requestAnimationFrame(seekFrame);
}
function setTarget(time){
  if(duration<=0)return;
  targetTime=clamp(time,0,duration);
  clearTimeout(openingEndTimer);openingEndTimer=0;
  queueOpeningSeek();
}
function enterFirstStage(){
  if(transitioning)return;
  transitioning=true;cancelAnimationFrame(seekRAF);seekRAF=0;clearTimeout(openingEndTimer);openingEndTimer=0;video.pause();
  opening.hidden=true;storyPreview.hidden=false;body.style.overflow='auto';window.scrollTo(0,0);
  initStoryExperience();primeChapter(0);storyTrigger?.enable();window.ScrollTrigger?.refresh();
}
function returnToOpening(){
  storyTrigger?.disable();storyPreview.hidden=true;opening.hidden=false;body.style.overflow='hidden';
  cancelAnimationFrame(seekRAF);seekRAF=0;clearTimeout(openingEndTimer);openingEndTimer=0;lastOpeningSeek=0;
  transitioning=false;targetTime=0;video.currentTime=0;renderOpening(0);window.scrollTo(0,0);
}
opening.addEventListener('wheel',event=>{
  if(transitioning)return;event.preventDefault();
  const delta=event.deltaY*(event.deltaMode===1?18:event.deltaMode===2?innerHeight:1);
  setTarget(targetTime+delta*duration/2600);
},{passive:false});
opening.addEventListener('touchstart',event=>{touchY=event.touches[0].clientY;},{passive:true});
opening.addEventListener('touchmove',event=>{
  if(touchY===null||transitioning)return;
  const nextY=event.touches[0].clientY,delta=touchY-nextY;
  if(Math.abs(delta)>2){event.preventDefault();setTarget(targetTime+delta*duration/900);touchY=nextY;}
},{passive:false});
opening.addEventListener('touchend',()=>{touchY=null;},{passive:true});
function syncOpeningDuration(){
  if(!Number.isFinite(video.duration)||video.duration<=0)return;
  duration=video.duration;
  targetTime=clamp(targetTime,0,duration);
  renderOpening(targetTime);
  queueOpeningSeek();
}
for(const event of ['loadedmetadata','durationchange','loadeddata','canplay']){
  video.addEventListener(event,syncOpeningDuration);
}
video.addEventListener('seeked',queueOpeningSeek);
// Cached metadata may have loaded before this script registered its listeners.
syncOpeningDuration();
video.addEventListener('play',()=>video.pause());
video.addEventListener('ended',queueOpeningSeek);
video.addEventListener('error',()=>progressBar.setAttribute('aria-label','视频暂时无法加载'));
const backgroundMusic=document.querySelector('#backgroundMusic');
const musicStatus=document.querySelector('#musicStatus');
backgroundMusic.volume=.4;
function syncMusicButton(){
  const playing=!backgroundMusic.paused;
  soundButton.setAttribute('aria-pressed',String(playing));
  soundButton.setAttribute('aria-label',playing?'暂停背景音乐':'播放背景音乐');
  soundButton.title=playing?'暂停背景音乐':'播放背景音乐';
}
backgroundMusic.addEventListener('play',syncMusicButton);
backgroundMusic.addEventListener('pause',syncMusicButton);
backgroundMusic.addEventListener('error',()=>{
  syncMusicButton();musicStatus.textContent='音乐暂时无法加载，请稍后重试';musicStatus.hidden=false;
});
soundButton.addEventListener('click',async()=>{
  musicStatus.hidden=true;
  if(!backgroundMusic.paused){backgroundMusic.pause();return;}
  soundButton.disabled=true;
  try{
    if(backgroundMusic.error)backgroundMusic.load();
    await backgroundMusic.play();
  }catch{
    musicStatus.textContent='音乐未能播放，请再次点击声音开关';musicStatus.hidden=false;
  }finally{soundButton.disabled=false;syncMusicButton();}
});
backButton.addEventListener('click',returnToOpening);
document.addEventListener('keydown',event=>{
  if(opening.hidden||transitioning)return;
  if(['ArrowDown','PageDown',' '].includes(event.key)){event.preventDefault();setTarget(targetTime+duration*.05);}
  if(['ArrowUp','PageUp'].includes(event.key)){event.preventDefault();setTarget(targetTime-duration*.05);}
  if(event.key==='End'){event.preventDefault();setTarget(duration);}
  if(event.key==='Home'){event.preventDefault();setTarget(0);}
});

function setStoryProgress(progress){storyPlayer.setTarget(progress);}

function initStoryExperience(){
  if(storyReady)return;storyReady=true;
  storyPlayer.preload();storyPlayer.resize();
  storyText.replaceChildren(...storyLines.map(text=>{const beat=document.createElement('section');beat.className='story-beat';const line=document.createElement('div');line.className='story-line';line.textContent=text;beat.append(line);return beat;}));
  const ctx=starfieldCanvas.getContext('2d');
  let width=0,height=0,dpr=1,stars=[],bursts=[],particleVisible=true,particleRunning=false;
  const pointer={x:.5,y:.5,targetX:.5,targetY:.5};
  function resize(){
    const r=storyVisual.getBoundingClientRect();width=r.width;height=r.height;dpr=Math.min(devicePixelRatio||1,1.25);
    starfieldCanvas.width=Math.round(width*dpr);starfieldCanvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
    const count=Math.min(120,Math.max(80,Math.round(width/12)));
    stars=Array.from({length:count},(_,i)=>({x:(Math.random()-.5)*width*2.2,y:(Math.random()-.5)*height*1.7,z:Math.random()*width+40,r:i%23===0?2.6:Math.random()*1.45+.35,twinkle:Math.random()*6}));
  }
  function burst(x,y){
    const colors=['#fff7d6','#ffc857','#7eddd5','#65a8ff'];
    for(let i=0;i<72;i++){const angle=Math.random()*Math.PI*2,speed=2+Math.random()*9;bursts.push({x,y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,life:1,size:Math.random()*4.2+1,color:colors[i%colors.length]});}
    gsap.fromTo('.click-hint',{scale:1.18,opacity:1},{scale:1,opacity:.42,duration:.7});
  }
  function draw(time){
    if(!particleVisible){particleRunning=false;return;}
    particleRunning=true;
    pointer.x+=(pointer.targetX-pointer.x)*.055;pointer.y+=(pointer.targetY-pointer.y)*.055;
    ctx.clearRect(0,0,width,height);
    for(const star of stars){
      star.z-=.55;if(star.z<8){star.z=width+80;star.x=(Math.random()-.5)*width*2.2;star.y=(Math.random()-.5)*height*1.7;}
      const perspective=420/(star.z+420);
      const depth=1-star.z/(width+80);
      const x=width/2+(star.x+(pointer.x-.5)*width*.48*depth)*perspective;
      const y=height/2+(star.y+(pointer.y-.5)*height*.38*depth)*perspective;
      const alpha=.35+.55*(.5+.5*Math.sin(time*.002+star.twinkle));
      const radius=star.r*(.55+perspective*1.8);
      ctx.globalAlpha=alpha;ctx.fillStyle=star.r>2?'#ffc857':'#f4f7ff';ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();
      if(star.r>2){ctx.globalAlpha=alpha*.6;ctx.strokeStyle='#ffc857';ctx.beginPath();ctx.moveTo(x-7,y);ctx.lineTo(x+7,y);ctx.moveTo(x,y-7);ctx.lineTo(x,y+7);ctx.stroke();}
    }
    ctx.globalCompositeOperation='lighter';
    for(let i=bursts.length-1;i>=0;i--){const p=bursts[i];p.x+=p.vx;p.y+=p.vy;p.vx*=.982;p.vy=p.vy*.982+.02;p.life-=.014;ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,Math.max(.4,p.size*p.life),0,Math.PI*2);ctx.fill();if(p.life<=0)bursts.splice(i,1);}
    ctx.globalCompositeOperation='source-over';
    ctx.globalAlpha=1;requestAnimationFrame(draw);
  }
  storyStage.addEventListener('pointermove',event=>{const r=storyStage.getBoundingClientRect();pointer.targetX=clamp((event.clientX-r.left)/r.width,0,1);pointer.targetY=clamp(event.clientY/innerHeight,0,1);root.style.setProperty('--sky-x',`${(pointer.targetX-.5)*-9}%`);root.style.setProperty('--sky-y',`${(pointer.targetY-.5)*-7}%`);});
  storyStage.addEventListener('pointerleave',()=>{pointer.targetX=.5;pointer.targetY=.5;root.style.setProperty('--sky-x','0%');root.style.setProperty('--sky-y','0%');});
  document.querySelectorAll('.burst-star').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();const stageRect=storyVisual.getBoundingClientRect(),rect=button.getBoundingClientRect();burst(rect.left-stageRect.left+rect.width/2,rect.top-stageRect.top+rect.height/2);gsap.fromTo(button,{scale:1.8,rotation:0},{scale:1,rotation:540,duration:.8,ease:'back.out(2)'});}));
  addEventListener('resize',resize);resize();requestAnimationFrame(draw);
  new IntersectionObserver(entries=>{particleVisible=entries[0].isIntersecting;if(particleVisible&&!particleRunning)requestAnimationFrame(draw);},{threshold:.01}).observe(storyVisual);
  if(window.gsap&&window.ScrollTrigger){
    gsap.registerPlugin(ScrollTrigger);
    storyTrigger=ScrollTrigger.create({
      trigger:storyStage,start:'top top',end:'bottom bottom',scrub:.45,
      onUpdate:self=>{
        root.style.setProperty('--stage-progress',`${self.progress*100}%`);
        setStoryProgress(self.progress);
      }
    });
    document.querySelectorAll('.story-beat').forEach(beat=>{
      const line=beat.querySelector('.story-line');
      gsap.timeline({scrollTrigger:{trigger:beat,start:'top bottom',end:'bottom top',scrub:.25}})
        .fromTo(line,{opacity:.1,y:35},{opacity:1,y:0,duration:.3,ease:'none'})
        .to(line,{opacity:1,y:0,duration:.4})
        .to(line,{opacity:.1,y:-35,duration:.3,ease:'none'});
    });
    document.querySelectorAll('.chapter-panel').forEach(panel=>{
      const frame=panel.querySelector('iframe');
      const heading=panel.querySelector('header');
      if(!frame)return;
      gsap.fromTo(frame,{scale:.82,opacity:.18},{scale:1,opacity:1,ease:'none',scrollTrigger:{trigger:panel,start:'top 92%',end:'top 6%',scrub:.5}});
      if(heading&&getComputedStyle(heading).display!=='none')gsap.fromTo(heading,{opacity:0,y:18},{opacity:1,y:0,ease:'none',scrollTrigger:{trigger:panel,start:'top 60%',end:'top 18%',scrub:.35}});
    });
    setStoryProgress(0);
  }
}

const chapterLoader=new IntersectionObserver(entries=>{
  for(const entry of entries){
    if(!entry.isIntersecting)continue;
    const frame=entry.target.querySelector('iframe[data-src]');
    if(frame){frame.src=frame.dataset.src;frame.removeAttribute('data-src');}
    chapterLoader.unobserve(entry.target);
  }
},{rootMargin:'250% 0px'});
document.querySelectorAll('.chapter-panel').forEach(panel=>chapterLoader.observe(panel));
function primeChapter(index){
  const panel=document.querySelectorAll('.chapter-panel')[index];
  const frame=panel?.querySelector('iframe[data-src]');
  if(!frame)return;
  frame.src=frame.dataset.src;
  frame.removeAttribute('data-src');
  chapterLoader.unobserve(panel);
}
