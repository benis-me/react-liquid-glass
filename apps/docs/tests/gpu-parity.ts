import { createLiquidGlassRenderer } from '../../../packages/react-liquid-glass/src/liquid-glass/renderer';
import 'refractive-glass-react/controls.css';
import { createRoot } from 'react-dom/client';
import { createElement as h, useState } from 'react';
import { GlassStage, GlassSwitch, GlassSlider, GlassTabs, GlassPopover, GlassVideo } from 'refractive-glass-react/controls';
import { paintLiquidBackdrop, LiquidGlassProvider, LiquidGlassCanvas } from 'refractive-glass-react/liquid-glass';
import type { GlassRendererBackend } from 'refractive-glass-react/liquid-glass/renderer';
import { createWebGL2GlassRenderer } from '../../../packages/react-liquid-glass/src/liquid-glass/webgl2-renderer';
import { createWebGPUGlassRenderer } from '../../../packages/react-liquid-glass/src/liquid-glass/webgpu-renderer';
import { subscribeLiquidFrames } from '../../../packages/react-liquid-glass/src/liquid-glass/frame-events';
import type { LiquidGlassFrame } from '../../../packages/react-liquid-glass/src/liquid-glass/render-frame';
const result = document.querySelector<HTMLPreElement>('#result')!;
const nextPaint = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
function source() {
  const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0,0,640,480); gradient.addColorStop(0,'#fff'); gradient.addColorStop(1,'#111'); ctx.fillStyle=gradient;ctx.fillRect(0,0,640,480);
  ctx.lineWidth = 2;ctx.strokeStyle='#777';
  for(let x=16;x<640;x+=36){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,480);ctx.stroke()}
  for(let y=11;y<480;y+=36){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(640,y);ctx.stroke()}
  ctx.fillStyle='#e94433';ctx.fillRect(0,0,100,90);ctx.fillStyle='#3388ee';ctx.fillRect(510,350,130,130);
  ctx.font='bold 42px sans-serif';ctx.fillStyle='#222';ctx.fillText('TOP LEFT',110,70);ctx.fillStyle='#ddd';ctx.fillText('bottom',320,420);
  return canvas;
}
function ink() {const c=document.createElement('canvas');c.width=280;c.height=360;const ctx=c.getContext('2d')!;ctx.fillStyle='#111';ctx.font='24px sans-serif';ctx.fillText('Material',28,52);ctx.fillStyle='#ea5830';ctx.fillRect(30,100,60,60);ctx.fillStyle='#555';ctx.fillText('Refraction',28,230);return c;}
function pixels(canvas: HTMLCanvasElement) {const c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;const ctx=c.getContext('2d',{willReadFrequently:true})!;ctx.drawImage(canvas,0,0);return ctx.getImageData(0,0,c.width,c.height).data;}
function drawPixels(renderer: { draw(p: LiquidGlassFrame): boolean }, canvas: HTMLCanvasElement, p: LiquidGlassFrame) {
  return new Promise<Uint8ClampedArray>((resolve, reject) => {
    const timeout = setTimeout(() => { stop(); reject(new Error('Renderer did not present')); }, 5000);
    const stop = subscribeLiquidFrames(output => {
      if (output !== canvas) return;
      clearTimeout(timeout); stop(); const data = pixels(canvas);
      if (!data.some((value, i) => i % 4 === 3 && value > 0)) reject(new Error('Empty render cannot pass parity'));
      else resolve(data);
    });
    renderer.draw(p);
  });
}
async function setup() {
  const glCanvas=document.querySelector<HTMLCanvasElement>('#gl')!,gpuCanvas=document.querySelector<HTMLCanvasElement>('#gpu')!;
  let failure: Error | undefined;
  const gl=createWebGL2GlassRenderer(glCanvas),gpu=await createWebGPUGlassRenderer(gpuCanvas,error=>{failure=error;result.textContent=error.stack??error.message;result.dataset.status='fail'});
  return {gl,gpu,glCanvas,gpuCanvas,check:()=>{if(failure)throw failure}};
}
let current: Awaited<ReturnType<typeof setup>> | undefined;
async function get() { return current ??= await setup(); }
document.querySelector('#run')!.addEventListener('click', async()=> {
  result.dataset.status='running';result.textContent='Compiling WebGPU…';
  try {
    const {gl,gpu,glCanvas,gpuCanvas,check}=await get();
    const base: LiquidGlassFrame={source:source(),width:320,height:240,blobs:[{x:.46,y:.43,radius:29,halfWidth:85,halfHeight:70}],hdr:false};
    const cases: [string,Partial<LiquidGlassFrame>][]=[['clear',{blurStrength:0}],['fine',{blurStrength:.2}],['fine endpoint',{blurStrength:.5}],['frost blend',{blurStrength:.62}],['menu frost',{blurStrength:1.6}],['broad frost',{blurStrength:4}],['deep frost',{blurStrength:12}],['angle',{specularRotation:37}],['opaque rest',{tintStrength:1}],['transparent',{transparentOutside:true}],['partial opacity',{transparentOutside:true,opacity:.43}],['debug',{debug:true}],['foreground',{content:ink(),contentOpacity:.7,contentBlur:1.8,contentRefraction:.8}],['fusion',{blobs:[{x:.45,y:.44,radius:26,halfWidth:69,halfHeight:57},{x:.69,y:.72,radius:31}],mergeDistance:38}],['contact',{blobs:[{x:.42,y:.53,radius:24,halfWidth:62,halfHeight:83,contactStrength:.8,contactX:.55,contactY:-.4,pullX:16,pullY:-12,velocityX:550,velocityY:-140}],specularRotation:123}]];
    const picture=new Image();picture.src=(base.source as HTMLCanvasElement).toDataURL();await picture.decode();
    const video=document.createElement('video');video.muted=true;video.preload='auto';video.src='/assets/flowers.mp4';
    await new Promise<void>((resolve,reject)=>{video.onloadeddata=()=>resolve();video.onerror=()=>reject(new Error('Video fixture failed to load'));video.load()});
    video.currentTime=3;await new Promise<void>(resolve=>video.onseeked=()=>resolve());
    cases.push(['background only',{blobs:[]}],['image source',{source:picture,blurStrength:1.6}],['paused video',{source:video,blurStrength:.5}]);
    const rows=[];
    for(const ratio of [1,2])for(const [name,config]of cases){
      const p={...base,...config,pixelRatio:ratio};
      const a=await drawPixels(gl,glCanvas,p),b=await drawPixels(gpu,gpuCanvas,p);check();let total=0,max=0,compositedMax=0;const histogram=new Uint32Array(256);
      for(let i=0;i<a.length;i++){const d=Math.abs(a[i]-b[i]);total+=d;max=Math.max(max,d);histogram[d]++;if(i%4!==3){const pixel=i-i%4,aa=a[pixel+3]/255,ba=b[pixel+3]/255;for(const bg of [0,255])compositedMax=Math.max(compositedMax,Math.abs(a[i]*aa+bg*(1-aa)-b[i]*ba-bg*(1-ba)));}}
      let p99=0,seen=0;for(;p99<255;p99++){seen+=histogram[p99];if(seen>Math.floor(a.length*.99))break}const mean=total/a.length;
      rows.push({name,ratio,mean:+mean.toFixed(3),p99,max,compositedMax:+compositedMax.toFixed(2),...(name==='paused video'?{samples:[10,10000].map(n=>({gl:[...a.slice(n*4,n*4+4)],gpu:[...b.slice(n*4,n*4+4)]}))}:{})}); result.textContent=JSON.stringify(rows,null,2);
    }
    const vf=new VideoFrame(video,{timestamp:0});const colorSpace=vf.colorSpace.toJSON();vf.close();
    // Cross-API interpolation/mip rounding may differ at a few glyph-edge pixels.
    // Tight mean/P99 plus a composited bound still reject visible material/color drift.
    const failed=rows.filter(r=>r.mean>0.2||r.p99>3||r.compositedMax>6);
    result.dataset.status=failed.length?'fail':'pass';result.textContent=JSON.stringify({status:result.dataset.status,failed:failed.map(r=>r.name),videoColorSpace:colorSpace,rows,gl:gl.stats,gpu:gpu.stats},null,2);
  }catch(error){result.dataset.status='fail';result.textContent=error instanceof Error?error.stack!:String(error)}
});
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve,ms));
async function until(predicate:()=>boolean, message:string, timeout=7000) {const t=performance.now();while(!predicate()){if(performance.now()-t>timeout)throw new Error(message);await wait(20)}}
function assert(value:unknown,message:string):asserts value{if(!value)throw new Error(message)}
async function reset(){current?.gl.dispose();current?.gpu.dispose();current=undefined;await nextPaint()}
const fixture=()=>{const node=document.createElement('div');node.style.cssText='position:fixed;top:100px;left:40px;width:800px;display:flex;flex-wrap:wrap;gap:4px;background:#eee;z-index:10';document.body.append(node);return node};
const newCanvas=(host:HTMLElement)=>{const c=document.createElement('canvas');c.style.cssText='width:96px;height:64px';host.append(c);return c};
const baseFrame=(image:HTMLCanvasElement):LiquidGlassFrame=>({source:image,width:96,height:64,pixelRatio:2,blobs:[{x:.5,y:.5,radius:16,halfWidth:30,halfHeight:18}],blurStrength:1.6,hdr:false});
async function report(body:()=>Promise<unknown>){result.dataset.status='running';result.textContent='Running…';try{const detail=await body();result.dataset.status='pass';result.textContent=JSON.stringify({status:'pass',detail},null,2)}catch(e){result.dataset.status='fail';result.textContent=e instanceof Error?e.stack!:String(e)}}
document.querySelector('#benchmark')!.addEventListener('click',()=>report(async()=>{
  await reset();const host=fixture(),image=source(),rows=[];
  const adapter=await navigator.gpu.requestAdapter();const info=adapter?.info;
  try{
    for(const backend of ['webgl2','webgpu'] as const){
      const renderers=Array.from({length:24},()=>createLiquidGlassRenderer(newCanvas(host),{backend,shared:true}));
      try{
        await Promise.all(renderers.map(r=>r.ready));assert(renderers.every(r=>r.backend===backend),'Benchmark backend unavailable');
        const cpu:number[]=[],intervals:number[]=[];let previous=performance.now();
        const frames=renderers.map(()=>baseFrame(image));
        for(let i=0;i<160;i++){
          await new Promise(requestAnimationFrame);const now=performance.now();if(i>=30)intervals.push(now-previous);previous=now;
          const start=performance.now();
          renderers.forEach((r,index)=>{frames[index].blobs[0].x=.5+Math.sin(i*.08+index)*.15;r.draw(frames[index])});
          await Promise.resolve();if(i>=30)cpu.push(performance.now()-start);
        }
        cpu.sort((a,b)=>a-b);intervals.sort((a,b)=>a-b);
        rows.push({backend,controls:24,cpuP50:+cpu[Math.floor(cpu.length*.5)].toFixed(3),cpuP95:+cpu[Math.floor(cpu.length*.95)].toFixed(3),frameP50:+intervals[Math.floor(intervals.length*.5)].toFixed(3),frameP95:+intervals[Math.floor(intervals.length*.95)].toFixed(3),uploads:renderers.reduce((n,r)=>n+r.stats.sourceUploads,0)});
      }finally{renderers.forEach(r=>r.dispose());host.replaceChildren();await nextPaint()}
    }
    return {adapter:info?{vendor:info.vendor,architecture:info.architecture,description:info.description}:null,note:'CPU includes encoding/submission and any synchronous presentation stalls. Frame intervals are not GPU pass timings.',rows};
  }finally{host.remove()}
}));
document.querySelector('#lifecycle')!.addEventListener('click',()=>report(async()=>{
  await reset();const host=fixture(),image=source(),p=baseFrame(image);let renderers:ReturnType<typeof createLiquidGlassRenderer>[]=[];
  const own=Object.getOwnPropertyDescriptor(navigator,'gpu');
  try{
    Object.defineProperty(navigator,'gpu',{configurable:true,value:{requestAdapter:async()=>null}});
    const original=newCanvas(host),fallback=createLiquidGlassRenderer(original);renderers.push(fallback);fallback.draw(p);
    assert(await fallback.ready==='webgl2','Unavailable adapter did not fall back');
    assert(fallback.canvas===original&&fallback.stats.draws===1,'Startup fallback replaced an unclaimed canvas or lost its pending frame');fallback.dispose();
  }finally{if(own)Object.defineProperty(navigator,'gpu',own);else delete (navigator as unknown as {gpu?:GPU}).gpu}
  try{
    const canceled=createLiquidGlassRenderer(newCanvas(host));renderers.push(canceled);canceled.draw(p);canceled.dispose();await canceled.ready;assert(canceled.stats.draws===0,'Disposed initialization presented a stale frame');
    const first=createLiquidGlassRenderer(newCanvas(host)),second=createLiquidGlassRenderer(newCanvas(host));renderers.push(first,second);
    first.draw(p);second.draw(p);await Promise.all([first.ready,second.ready]);await nextPaint();
    assert(first.backend==='webgpu'&&second.backend==='webgpu','GPU path was not selected');
    const empty=document.createElement('canvas');empty.width=empty.height=64;
    const emptyOwner=createLiquidGlassRenderer(newCanvas(host));renderers.push(emptyOwner);await emptyOwner.ready;
    emptyOwner.draw({...p,source:empty,blobs:[]});await nextPaint();assert(emptyOwner.backend==='webgpu','An unpainted source forced fallback');
    const paint=empty.getContext('2d')!;paint.fillStyle='#f00';paint.fillRect(0,0,64,64);
    const initialized=await drawPixels(emptyOwner,emptyOwner.canvas,{...p,source:empty,sourceRevision:1,blobs:[]});
    assert(initialized[0]===255&&initialized[3]===255,'An initialized canvas retained its empty source');emptyOwner.dispose();
    const a=first.context as GPUCanvasContext,b=second.context as GPUCanvasContext;
    assert(a.getConfiguration()!.device===b.getConfiguration()!.device,'Canvases created separate devices');
    first.draw({...p,tintStrength:1,tintColor:[0,1,0]});await nextPaint();
    const capture=document.createElement('canvas'),rect=first.canvas.getBoundingClientRect();
    paintLiquidBackdrop(host,capture,{left:rect.left,top:rect.top,width:rect.width,height:rect.height});
    const center=capture.getContext('2d')!.getImageData(capture.width/2,capture.height/2,1,1).data;
    assert(center[1]>240&&center[0]<15&&center[2]<15,'Presented GPU canvas became blank in the DOM backdrop');
    await nextPaint();paintLiquidBackdrop(host,capture,{left:rect.left,top:rect.top,width:rect.width,height:rect.height});
    assert(capture.getContext('2d')!.getImageData(capture.width/2,capture.height/2,1,1).data[1]>240,'Cached backdrop snapshot expired');
    first.draw({...p,blobs:[{x:.6,y:.5,radius:16}]});await nextPaint();assert(first.stats.sourceUploads===1,'Geometry change re-uploaded the source');
    const before=first.stats.draws;first.draw(p);first.suspend();await nextPaint();assert(first.stats.draws===before,'Suspension did not cancel queued work');
    first.draw(p);await nextPaint();const old=first.canvas; a.getConfiguration()!.device.destroy();
    await until(()=>first.backend==='webgl2'&&second.backend==='webgl2','Device loss did not recover both owners');
    assert(first.canvas!==old&&first.canvas.isConnected,'Context-locked canvas was not replaced');
    assert(first.draw(p)&&second.draw(p),'Fallback did not keep rendering');
    return {adapterFallback:true,pendingFrame:true,canceledInitialization:true,sharedDevice:true,sourceCache:true,retainedBackdrop:true,unpaintedSource:true,suspension:true,deviceLossFallback:true};
  }finally{renderers.forEach(r=>r.dispose());host.remove()}
}));
document.querySelector('#react')!.addEventListener('click',()=>report(async()=>{
  await reset();const host=fixture();host.style.width='360px';const root=createRoot(host);
  let count=0;const stop=subscribeLiquidFrames(c=>{if(host.contains(c))count++});
  function Fixture({revision=0}:{revision?:number}){const[checked,setChecked]=useState(false),[value,setValue]=useState(40);return h(LiquidGlassProvider,{material:{hdr:false,specularRotation:90+revision},children:h(GlassStage,{style:{width:350,height:260}},h(GlassSwitch,{checked,onCheckedChange:setChecked,ariaLabel:'Recovery switch'}),h(GlassSlider,{value,onValueChange:setValue,ariaLabel:'Recovery slider'}),h(GlassTabs,{label:'Recovery tabs',value:'a',items:[{value:'a',label:'One'},{value:'b',label:'Two'}]}),h(GlassPopover,{label:'Recovery popover',trigger:'Menu',children:h('p',null,'Ready')}))})}
  try{
    root.render(h(Fixture));await until(()=>host.querySelectorAll('canvas[data-dg-renderer="liquid-webgpu"]').length>=2,'React surfaces did not select WebGPU');
    const input=host.querySelector<HTMLInputElement>('input[role="switch"]')!;assert(input,'Switch missing');input.click();
    await wait(1800);const atRest=count;await wait(250);assert(count===atRest,'Resting React controls keep drawing');
    host.style.top='-1000px';await wait(150);const hidden=count;root.render(h(Fixture,{revision:1}));await wait(250);assert(count===hidden,'Offscreen controls kept drawing');host.style.top='100px';await until(()=>count>hidden,'Returning onscreen did not repaint');
    const canvas=host.querySelector<HTMLCanvasElement>('canvas[data-dg-renderer="liquid-webgpu"]')!;
    canvas.getContext('webgpu')!.getConfiguration()!.device.destroy();
    await until(()=>host.querySelectorAll('canvas[data-dg-renderer="liquid-webgl2"]').length>=2,'React did not remount after device loss');
    assert(host.querySelector<HTMLInputElement>('input[role="switch"]')?.checked,'Device loss reset controlled state');
    return {webgpu:true,idleFrames:0,offscreenPause:true,visibilityRestoration:true,deviceLossFallback:true,controlledStatePreserved:true};
  }finally{stop();root.unmount();host.remove()}
}));

// Exercise floating-point HDR output even on an SDR display. This validates the
// render pipeline/calibration, not the physical display's brightness or gamut.
async function checkHDRPipeline(backend: 'webgpu' | 'webgl2') {
  await reset();const host=fixture(),match=window.matchMedia,configure=GPUCanvasContext.prototype.configure;
  const readbacks:Promise<Float32Array>[]=[];let capture=false;
  const half=(x:number)=>{const sign=x&0x8000?-1:1,exp=(x>>10)&31,mant=x&1023;return sign*(exp?Math.pow(2,exp-15)*(1+mant/1024):Math.pow(2,-14)*mant/1024)};
  const read=async(canvas:HTMLCanvasElement)=>{
    const ctx=canvas.getContext('webgpu')!,device=ctx.getConfiguration()!.device,w=canvas.width,h=canvas.height;
    const stride=Math.ceil(w*8/256)*256,buffer=device.createBuffer({size:stride*h,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
    const commands=device.createCommandEncoder();commands.copyTextureToBuffer({texture:ctx.getCurrentTexture()},{buffer,bytesPerRow:stride},[w,h]);device.queue.submit([commands.finish()]);
    await buffer.mapAsync(GPUMapMode.READ);const bytes=new DataView(buffer.getMappedRange()),values=new Float32Array(w*h*4);
    for(let y=0;y<h;y++)for(let x=0;x<w*4;x++)values[y*w*4+x]=half(bytes.getUint16(y*stride+x*2,true));
    buffer.unmap();buffer.destroy();return values;
  };
  window.matchMedia=(query)=>{const media=match.call(window,query);if(query==='(dynamic-range: high)')Object.defineProperty(media,'matches',{value:true});return media};
  GPUCanvasContext.prototype.configure=function(options){return configure.call(this,options.format==='rgba16float'?{...options,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC}:options)};
  const stop=subscribeLiquidFrames(canvas=>{if(capture&&host.contains(canvas)){const hdr=host.querySelector<HTMLCanvasElement>('[data-dg-highlight-hdr]');if(hdr){capture=false;readbacks.push(read(hdr))}}});
  let renderer:ReturnType<typeof createLiquidGlassRenderer>|undefined;
  try{
    const image=source(),p:LiquidGlassFrame={...baseFrame(image),hdr:true,tintStrength:0,blobs:[{x:.5,y:.5,radius:24,contactStrength:1,contactX:0,contactY:0}]};
    renderer=createLiquidGlassRenderer(newCanvas(host),{backend});await renderer.ready;
    capture=true;renderer.draw(p);await until(()=>readbacks.length>0,'HDR surface did not render');const values=await readbacks[0];
    const peak=values.reduce((max,n,i)=>i%4===3?max:Math.max(max,n),0);assert(peak>1,'HDR did not preserve above-white values');
    const emissions=renderer.stats.emissionDraws;renderer.draw({...p,sourceRevision:2});await nextPaint();assert(renderer.stats.emissionDraws===emissions,'Background-only changes redrew HDR');
    const cover=document.createElement('canvas');cover.width=64;cover.height=64;cover.getContext('2d')!.fillRect(0,0,64,64);
    capture=true;renderer.draw({...p,sourceRevision:2,content:cover,contentOpacity:1});await until(()=>readbacks.length>1,'Foreground did not refresh HDR');
    const covered=await readbacks[1],w=renderer.canvas.width,h=renderer.canvas.height,center=(Math.floor(h/2)*w+Math.floor(w/2))*4;
    assert(covered[center]===0&&covered[center+3]===0,'Opaque foreground did not occlude HDR');
    renderer.draw({...p,hdr:false});await nextPaint();assert(host.querySelector<HTMLCanvasElement>('[data-dg-highlight-hdr]')?.style.opacity==='0','HDR disable did not hide its presentation');
    return {backend,floatingPointPeak:peak,sourceChangeRetainsLight:true,foregroundOcclusion:true,disable:true,physicalDisplayHDR:match.call(window,'(dynamic-range: high)').matches};
  }finally{stop();renderer?.dispose();host.remove();window.matchMedia=match;GPUCanvasContext.prototype.configure=configure}
}
document.querySelector('#hdr')!.addEventListener('click',()=>report(()=>checkHDRPipeline('webgpu')));
document.querySelector('#hdr-fallback')!.addEventListener('click',()=>report(()=>checkHDRPipeline('webgl2')));

// Changing a provider must change its backend without resetting application state.
document.querySelector('#switching')!.addEventListener('click', () => report(async () => {
  await reset();
  const host = fixture(), root = createRoot(host), image = source();
  host.style.width = '420px';
  const sourceRef = { current: image };
  function Fixture({ backend, shared = false, videoSrc = '/assets/flowers.mp4' }: { backend: GlassRendererBackend; shared?: boolean; videoSrc?: string }) {
    const [checked, setChecked] = useState(false);
    return h(LiquidGlassProvider, { backend, material: { hdr: false }, children: h('div', null,
      h(GlassSwitch, { checked, onCheckedChange: setChecked, ariaLabel: 'Backend switch' }),
      h(LiquidGlassCanvas, { sourceRef, ...baseFrame(image), shared, ariaLabel: 'Backend canvas' }),
      h(GlassVideo, { src: videoSrc }),
    ) });
  }
  const canvases = () => [...host.querySelectorAll<HTMLCanvasElement>('canvas[data-dg-renderer]')];
  const ready = async (backend: 'webgpu' | 'webgl2') => {
    await until(() => canvases().length >= 3 && canvases().every(canvas => canvas.dataset.dgRenderer === `liquid-${backend}`), `Provider did not select ${backend}`);
    await until(() => host.querySelector<HTMLCanvasElement>('.dg-video-player canvas')?.style.opacity === '1', 'Video did not resume after backend change');
    await nextPaint();
  };
  try {
    root.render(h(Fixture, { backend: 'auto' })); await ready('webgpu');
    host.querySelector<HTMLInputElement>('input[role="switch"]')!.click();
    const old = canvases()[0];
    old.getContext('webgpu')!.getConfiguration()!.device.destroy();
    await ready('webgl2');
    root.render(h(Fixture, { backend: 'webgl2' })); await ready('webgl2');
    root.render(h(Fixture, { backend: 'webgl2', videoSrc: '/assets/flowers.mp4?source-change' })); await ready('webgl2');
    root.render(h(Fixture, { backend: 'webgpu' })); await ready('webgpu');
    assert(host.querySelector<HTMLInputElement>('input[role="switch"]')!.checked, 'Switch state changed during backend recovery');
    root.render(h(Fixture, { backend: 'webgl2' })); await ready('webgl2');
    root.render(h(Fixture, { backend: 'webgl2', shared: true })); await ready('webgl2');
    const canvas = host.querySelector<HTMLCanvasElement>('canvas[aria-label="Backend canvas"]')!;
    assert(canvas.getContext('2d'), 'Shared output retained the direct WebGL context');
    root.render(h(Fixture, { backend: 'webgpu', shared: true })); await ready('webgpu');
    root.render(h(Fixture, { backend: 'auto' })); await ready('webgpu');
    return { deviceRecovery: true, explicitBackendAfterFailure: true, sharedModeSwitch: true, video: true, videoSourceChange: true, controlledStatePreserved: true };
  } finally { root.unmount(); host.remove(); }
}));

document.querySelector('#failures')!.addEventListener('click', () => report(async () => {
  await reset();
  const host = fixture(), image = source(), p = baseFrame(image);
  const renderers: ReturnType<typeof createLiquidGlassRenderer>[] = [];
  const own = Object.getOwnPropertyDescriptor(navigator, 'gpu');
  const restoreGPU = () => { if (own) Object.defineProperty(navigator, 'gpu', own); else delete (navigator as unknown as { gpu?: GPU }).gpu; };
  try {
    Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined });
    let errors = 0;
    const required = createLiquidGlassRenderer(newCanvas(host), { backend: 'webgpu', onError: () => errors++ });
    renderers.push(required);
    assert(await required.ready === null && required.backend === 'unavailable' && errors === 1, 'Required WebGPU silently used a fallback');
    const automatic = createLiquidGlassRenderer(newCanvas(host)); renderers.push(automatic);
    automatic.draw(p); automatic.suspend();
    assert(await automatic.ready === 'webgl2' && automatic.stats.draws === 0, 'Suspended startup presented a frame');
    assert(automatic.draw(p), 'Fallback did not resume'); automatic.dispose();
    restoreGPU();

    const keeper = createLiquidGlassRenderer(newCanvas(host), { backend: 'webgpu' }); renderers.push(keeper);
    await keeper.ready;
    const device = (keeper.context as GPUCanvasContext).getConfiguration()!.device;
    let lost = false; void device.lost.then(() => { lost = true; });
    const brokenCanvas = newCanvas(host), getContext = brokenCanvas.getContext;
    brokenCanvas.getContext = function (this: HTMLCanvasElement, kind: string, options?: unknown) {
      if (kind === 'webgpu') throw new DOMException('Context setup failed', 'InvalidStateError');
      return Reflect.apply(getContext, this, [kind, options]);
    } as typeof getContext;
    const broken = createLiquidGlassRenderer(brokenCanvas); renderers.push(broken);
    assert(await broken.ready === 'webgl2', 'A throwing WebGPU context did not fall back');
    keeper.dispose();
    await until(() => lost, 'Failed initialization leaked the shared GPU device', 2000);
    assert(broken.draw(p), 'Failed GPU owner broke its WebGL fallback'); broken.dispose();
    const conflicting = newCanvas(host), configure = GPUCanvasContext.prototype.configure;
    let notifications = 0;
    GPUCanvasContext.prototype.configure = function (options) {
      if (this.canvas === conflicting) {
        options.device.dispatchEvent(new GPUUncapturedErrorEvent('uncapturederror', { error: new GPUValidationError('Configuration validation failure') }));
        throw new Error('Configuration also threw');
      }
      return configure.call(this, options);
    };
    try {
      const recovery = createLiquidGlassRenderer(conflicting, { onReady: () => notifications++ }); renderers.push(recovery);
      assert(await recovery.ready === 'webgl2', 'Simultaneous initialization errors lost the fallback');
      await nextPaint();
      assert(notifications === 1 && recovery.draw(p), 'Simultaneous errors initialized the fallback more than once');
    } finally { GPUCanvasContext.prototype.configure = configure; }
    return { requiredBackend: true, suspendedInitialization: true, contextExceptionFallback: true, failedInitializationReleasesDevice: true, concurrentFailureRecovery: true };
  } finally { restoreGPU(); renderers.forEach(renderer => renderer.dispose()); host.remove(); }
}));
