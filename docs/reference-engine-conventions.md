# Reference engine conventions (condensed from the subagent's read of adam-engine.js)

Axes: x right, y UP, z toward viewer. Orthographic. R = zoom*canvas/2; baseline zoom 0.6.
position [x,y]: body radii at current zoom, applied AFTER projection as 2D translate (+y up).
rotation [x,y,z] deg: R = Rz(z)·Ry(y)·Rx(x). +x looks down, +y turns to screen right, +z CCW on screen. Not wrapped.
squash [sx,sy]: sphere = ellipse radii (sx R, sy R); centre y(up) = off_y + anchor*(1-sy). anchor 0 centre fixed, -1 bottom fixed. Sphere eyes NOT squashed (clipped). Non-sphere: whole sprite incl. eyes scaled about anchor.
zoom: clamp [0.25,2.5]; no track => previous value persists; rest pose default 0.6.
lids v: eye replaced by upright capsule from bbox (w,h): height = h + (0.42w - h)*v; if < w horizontal capsule length w thickness newH. centre fixed.
lids suppression: forced 0 while face not blink-capable or face morph running; re-enabled only once lids track back at exactly 0. blink-capable = not {sad,happy,confused,squinted,sleepy} and not oval => neutral,surprised,inspecting.
defaults: position 0, rotation 0, squash 1, lids 0, expression neutral, anchor 0, ease [.42,0,.58,1].
keys: ease from STARTING key; hold before first/after last; Newton 8 iters.
loop: at t>=duration loopCount++; if pose not close to rest pose => bridge back to rest pose then reload at phase 0; else t-=duration. close: rot<4deg/axis mod 360, pos<0.015, squash<0.02, zoom<0.02, lids<0.05.
workArea.start = restTime (rest pose sample time). end unused. After bridge clip starts at phase*duration.
clip clock \*= (1 - morphAmount). dt capped 0.1.
bridge: 0.35 s, ease [.4,0,.2,1], from current track pose (no gaze/gesture), to rest pose; channels pos,rot,squash,zoom, lids if either nonzero; anchor stays from-value; angles: target shifted by whole turns nearest current (per axis). Face: if no override/held and differs, morph(rest expression) at bridge start; rest expression = last event <= restTime else FIRST event's name. End: hard load target at phase. load() bridges if a clip is loaded and (bridge in progress or name differs).
expression events: cut true/missing = direct morph; only cut===false = through-blink (never in data). ease ignored. "blink" => lids keys t:0, t+0.117:1, t+0.26:0 ease [.42,0,.58,1].
aliases: thinking→sad, strange→inspecting, angry→neutral, inspect→inspecting, squint→squinted, idle→neutral, smile→happy, sleep→sleepy; unknown→neutral.
events fire for t in (prev, now], only when no override and no held face; if lids>0 deferred (single slot) until lids back to 0.
direct morph 0.28 s ease [.4,.06,.18,1]; lerp off,tilt,wid,lidY,oval,path; inspect weight lerps with it. lid morph 0.35. engine blink 0.26.
face priority: setExpression override > holdFace (state face / emphasis) > clip expression (neutral before first event).
eyes: units = radians on unit sphere ≈ radii. local +y up, +x OUTWARD for both eyes. wid = half-width (stroke radius) swept along pts (21 pts from path: 3 anchors x [x,y,in dx,dy,out dx,dy], two cubic segs 11+10 pts). lidY scales local y before tilt and off. oval [rx,ry] (calm .296,.247), mix = smoothstep(0,.08,min(rx,ry)) when ovalMix 0.
anchors: eye0 screen LEFT M0=(-0.31535,0,0.94898), eye1 right (+). yaw ±18.38°. exp map: P = cos(L)·M + sin(L)/L·(a·C + b·T), L=hypot(a,b), T=(0,1,0), C outward tangent (∓0.949,0,-0.315).
inspect: b = follow ? clamp(yaw/20,-1,1) : bias; p=(1+b)/2; r = wid1/wid0 (0.18/0.27); eye0 scale = 1+(r^p-1)w; eye1 = 1+((1/r)^p-1)w; applies to wid and pts. yaw incl. gaze+gestures.
gestures (clock not slowed by morph): spin dur 0.9+0.4(turns-1), yaw += 180·turns·(1-cos(πp)); nod 0.5 s pitch(x) += 16·sin²(πp); bounce 0.62 s: E(p,a,b)=sin²(π(p-a)/(b-a)) in (a,b); t=E(p,0,.18)+E(p,.82,1), n=E(p,.18,.82); lift(+y up, R) = 0.3·sin(π·clamp((p-.14)/.72)); sx\*=1+.08t-.04n; sy\*=1-.1t+.06n. rot/pos add, squash multiplies.
gaze: gx=clamp((px-cx)/(2·width),-1,1), gy up likewise; smoothing k=1-0.86^(dt·60) for cx,cy and hold; sphere: rx=-14·gy, ry=18·gx deg, px=.03gx, py=.024gy; other bodies -19,26,.07,.055; while playing only if gazeAlways, scaled 0.55·hold. look(dir) 0.5 s ±20°, ±0.1.
director: mulberry32: t=t+1831565813|0; e=imul(t^t>>>15,t|1); e^=e+imul(e^e>>>7,e|61); ((e^e>>>14)>>>0)/4294967296. seed default 1 (adapter: FNV-1a of id: h=2166136261; h=imul(h^c,16777619)).
bag: copy; Fisher-Yates for(e=len-1;e>0;--e) swap(e,floor(rand()*(e+1))); then i=findIndex(x!==lastClip); if i>0 swap(0,i); shift(); refill when empty; bag keyed by clips ARRAY object (six working states share one). pick equal to current clip => do nothing. first load of non-ordered: phase = rand() (drawn after shuffle); later 0.
ordered (next, no hold): play in order; each loopCount change index++; at end → next. hold: d+=dt (raw); d>=holdSeconds → next; otherwise shuffled loop. on state change: setMorph(state.morph??null), holdFace(state.face ?? (emphasis?'surprised':null)), reset timers, pick. compact when size<48.
rest(): bridge to rest pose rotation [-15.896, 33.293, 25.385].
adapter order: director.advance(dt) then engine.advance(dt). reduced motion: pause, seek(0), 60×advance(0.1), render once.
MORPH springs v += (-2ζω v - ω²(x-target))h; x += v h; substeps ceil(dt/(1/120)). amount ω14 ζ1; swap ω11; spin ω14 (rad); body blend ω10.
spin: each activation toggle target += π·dir, dir from mulberry32(2654435769) rand()<.5?1:-1. swap: replacing while amount>0.02 → old outgoing, weights new=amount·swap old=amount·(1-swap); drop at swap>0.996. clocks stateTime, shotTime. cyclic: progress 2.5 s on / 1.5 s off; spawning 2.0 / 1.5.
effect A=amount,u=1-A: clip clock×u; rot = ref+(rot-ref)u (ref = angles rounded to mult of 360 at morph start); pos×u; squash=1+(s-1)u; eyes removed at A>=0.5.
outline: round=cubicInOut(clamp(A/0.62)); body outline radially sampled → lerp to circle radius U=114.2705 design units scaled to body radius; head group scale (1-A)+(0.6/zoom)·D·A, D=coreRadius/U·pop. design space: U = centre and unit radius = body radius at zoom .6. small boost 1+(Wi-1)A(1-smoothstep((px-44)/90)).
core radius / Wi: dots 22/1.5, orbit 19/1.14, radar 19/1.14, progress 19/1.32, gather 19/1.15, wave 16/1.42, send 20/1.12, receive 20/1.12, dock 20/1.3, ball 18/1.22, pencil 17/1.18, bang 13/1.28, standby 13/1.75.
modes→pattern: thinking dots, orbit orbit, radar radar, progress progress, spawning gather, dictating wave, sending send, receiving receive, uploading dock, bouncing ball, writing pencil, alerting bang, powering-down standby.
patterns (w weight, out(x)=1-(1-x)^3, back(x)=1+2.70158(x-1)^3+1.70158(x-1)^2, t stateTime s, y down):
dots period 1.4: satellites x=U∓62·back(o), o=w left, clamp((w-.12)/.88) right; ph=fract(t/1.4+0.119); slot k (left0 core1 right2) d=circular |ph-k/3|, s=exp(-d²/0.045); lift=9sw up; pop=.84+.22s; tone=.5+.5s; sat radius 22·out(o)·pop·1.02, opacity out(o)·tone; core slot1 scale×pop dy=-lift opacity tone.
orbit: 5 discs a_k=1.7t+k2π/5; pos (U+r sin a, U-0.42 r cos a), r=52·back(w); radius max(12(.5+.5clamp(cos a,0,1))out(w),.3); opacity clamp((cos a+.4)/.6,.18,1)·out(w).
radar: 3 rings a=fract(t/1.3+k/3); radius core+(104-core)a; stroke 3.4(1-.55a); opacity out(w)(1-a).9.
progress: track ring radius 62·back(w) width 5 opacity .16out(w); arc same, opacity out(w), fraction clamp((shot/2.5)/.85), from 12 o'clock clockwise.
gather: 5 discs i=clamp((shot/2-k·.09)/.62); hidden i>=1; e=out(i); angle 2.4k+2.2i; dist 96(1-e); pos (U+d cos, U+.8 d sin); radius 9(.5+.5e)out(w); opacity out(w)clamp(5i)(1-.25e).
wave: 4 discs s∈{-2,-1,1,2}, ms=1000t; i=clamp((w-.1|s|)/(1-.1|s|)); x=U+44 s back(i); o=(.42+.29 sin(.0021ms)sin(.0034ms)+.29 sin(.0013ms+1.7))(.55+.45 sin(.012ms-1.05|s|)); radius (7+9clamp(o,.08,1))out(i); y=U-6clamp(o,0,1)i; opacity i.
send period 1.5 r=fract(t/1.5) dir (0.74,-0.62): packet i=clamp((r-.18)/.55), a=i²(.4+.6i), at U+dir·108a, radius 10(1-.55a)out(w), opacity out(w)(1-a²); streak same with .26 delay radius 5(1-.6f) opacity .3out(w)(1-f); ring p=clamp((r-.18)/.3) radius 20+34out(p) width 2.8(1-p) opacity .8out(w)(1-p); core ×(1-.06 sin(πr/.18)) r<.18; ×(1+.05 sin(π(r-.18)/.24)) .18<=r<.42.
receive period 1.7: angle per cycle n = -1.25π + mulberry32(n)()·1.5π; a=fract(t/1.7), o=clamp(a/.6), s=out(o); packet dist 108(1-s) along angle + perpendicular bow 18 sin(πo)(1-.7s); radius 3.5+6.5s; opacity out(w)clamp(3.5o)(.3+.7s); ring m=clamp((a-.58)/.32) radius 20+26out(m) width 2.8(1-m) opacity .8out(w)(1-m); core ×(1+.11 sin(π clamp((a-.58)/.34))).
dock: 2 discs k; a=clamp((t-(.2+1.3k))/.9), e=out(a); from (U-120+30k, U+95) to (U+42 sin(1.1t+kπ), U+21 cos(1.1t+kπ)+2 sin(3t+k)) lerp e; radius (7+3e)out(w); opacity out(w)clamp(4a).
ball: core y: t<0.2719: 541.1 t²; then i=fract((t-.2719)/.62), y=40-208 i(1-i).
pencil period 2.5, write 68%: write n: x=-54+118 smoothstep(n), y=26, wiggle=3.2 sin(24n)clamp(n/.08)clamp((1-n)/.08), rot=17°+sin(.6t); return n=cubicInOut: x=64-118n, y=26-20 sin(πn), rot=17-2 sin(πn)+sin(.6t); core dx=x dy=y+.5wiggle rotation rot (×w); core ring = teardrop r=88 tip down corner 18; shaft capsule 30×88 centred 68 from tip along (rot-90°), scaled out(w), opacity clamp(1.6w-.3); ink stroke width 6 through trail (U+x, U+y+wiggle+19), spacing>=2.4, last 64, erased 120 pts/s on return; opacity clamp(1.2w).
bang: core moved down 58; bar tapered capsule top 30 bottom 17 height 96, translated up 26+70(1-out(clamp(1.1w))), scaled clamp(1.2w), opacity clamp(1.5w-.2); shake rot 2.2° sin(42t) exp(-5.5(t mod 2.2)) about (U,U-74); core ×(1+.04 exp(-5.5(t mod 2.2))).
standby: n=.5+.5 sin(1.6t); halo radius 26+7n opacity out(w)(.06+.1n); core opacity ×(1-(.28+.2 sin(1.6t))w).
