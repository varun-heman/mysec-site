/* ==========================================================================
   mySecurity — Site plan simulation
   Classic script, no modules, no dependencies.

   WHY JS DRIVES THE CAMERAS TOO
   The sweeps used to be CSS keyframes, which looked right but left the script
   with no idea where any camera was pointing. Three things need that: hiding
   subjects nobody can see, tinting the cone of the camera that spots one, and
   putting the alert over that camera. So aim is computed here and written to
   the cone; CSS still supplies a static fallback for the no-JS case.

   ROADS
   Subjects move on a road graph, not on freehand polylines. Every waypoint
   sits on a named road and consecutive waypoints share an axis, so a leg can
   only ever run along a road — which is what stops vehicles cutting across
   the blocks. Adding a route means naming junctions, not drawing a line.

   COST
   One rAF loop. DOM nodes are pooled and recycled rather than created and
   destroyed, attributes are only written when the value actually changed, and
   the whole thing stops when the plan is off screen or the tab is hidden.
   Per frame it is ~34 camera writes and ~30 subject writes, no allocation.
   ========================================================================== */

(function () {
  "use strict";

  var NS = "http://www.w3.org/2000/svg";
  var DEG = Math.PI / 180;

  /* ---- road graph ------------------------------------------------------
     Ring road, two internal spines, three cross roads, and the gate spur.
     Every route below is a list of junctions on those lines. */
  /* Road coordinates re-derived from the plan image, not estimated. The
     boundary runs x 50..950, y 57..470; the north blocks occupy y 92..189, the
     amenities y 212..315 and the south blocks y 327..447. The roads are the
     gaps between those bands — which is why the earlier ring-bottom of y=488
     was wrong: it sat outside the boundary altogether, and anything routed
     along it drove across the southern blocks. */
  var H_N = 200, H_S = 321;          // internal spines
  var R_T = 80,  R_B = 458;          // ring road, north and south
  var R_L = 70,  R_R = 935;          // ring road, west and east
  var V1 = 277,  V2 = 525, V3 = 733; // cross roads
  var GATE_OUT = [V2, 600];          // off-plan, below the gate

  /* Walking pace is a quarter of driving, as it is in life. People were
     previously moving at half a car's speed, which is what made them look
     like they were skating over the estate. */
  var ROUTES = [
    { kind:"vehicle", speed:20, pts:[GATE_OUT,[V2,R_B],[V1,R_B],[V1,H_S],[V1,H_N],[V1,R_T],[R_L,R_T],[R_L,R_B],[V2,R_B],GATE_OUT] },
    { kind:"vehicle", speed:19, pts:[GATE_OUT,[V2,R_B],[V2,H_S],[V3,H_S],[V3,H_N],[V3,R_T],[R_R,R_T],[R_R,R_B],[V2,R_B],GATE_OUT] },
    { kind:"vehicle", speed:22, pts:[GATE_OUT,[V2,R_B],[R_R,R_B],[R_R,R_T],[R_L,R_T],[R_L,R_B],[V2,R_B],GATE_OUT] },
    { kind:"vehicle", speed:18, pts:[GATE_OUT,[V2,R_B],[V2,H_N],[V1,H_N],[V1,H_S],[V2,H_S],[V2,R_B],GATE_OUT] },
    { kind:"vehicle", speed:19, pts:[GATE_OUT,[V2,R_B],[V2,H_S],[V1,H_S],[V1,R_B],[V2,R_B],GATE_OUT] },
    { kind:"person",  speed:5, pts:[GATE_OUT,[V2,R_B],[V2,H_S],[400,H_S],[400,286]] },
    { kind:"person",  speed:4, pts:[GATE_OUT,[V2,R_B],[V2,H_S],[V1,H_S],[V1,H_N],[190,H_N],[190,240]] },
    { kind:"person",  speed:5, pts:[GATE_OUT,[V2,R_B],[V2,H_S],[V3,H_S],[830,H_S],[830,286]] },
    { kind:"person",  speed:4, pts:[GATE_OUT,[V2,R_B],[V2,H_N],[R_R,H_N],[R_R,R_B],[V2,R_B],GATE_OUT] },
    { kind:"person",  speed:5, pts:[GATE_OUT,[V2,R_B],[V1,R_B],[V1,H_N],[R_L,H_N],[R_L,R_B],[V2,R_B],GATE_OUT] },
    { kind:"person",  speed:4, pts:[GATE_OUT,[V2,R_B],[V2,H_S],[V3,H_S],[V3,H_N],[640,H_N],[640,282]] },
    { kind:"person",  speed:5, pts:[GATE_OUT,[V2,R_B],[V2,H_S],[V2,H_N],[V2,R_T],[R_L,R_T],[R_L,H_N],[V1,H_N],[V1,H_S],[V2,H_S],[V2,R_B],GATE_OUT] }
  ];

  var CLUSTERS = [
    { cx:400, cy:262, rx:54, ry:22, n:7 },   // pool
    { cx:830, cy:262, rx:38, ry:18, n:6 },   // courts
    { cx:190, cy:262, rx:36, ry:18, n:6 }    // play area
  ];

  var GATE = { x:525, y:486 };

  /* Detection reaches a little past the drawn cone, so subjects fade at the
     edge of coverage rather than popping exactly on the arc. */
  var CONE_RANGE = 46, CONE_HALF = 22;
  var SEE_RANGE = CONE_RANGE * 2.1, SEE_HALF = CONE_HALF + 22;

  var INCIDENTS = [
    { kind:"person",  level:"suspicious", tag:"Loitering",     title:"Person loitering near Block C entrance",       meta:"CAM-11 · 4 MIN DWELL · GUARD NOTIFIED" },
    { kind:"vehicle", level:"suspicious", tag:"Unregistered",  title:"Unregistered vehicle followed a resident in",  meta:"MAIN GATE · ANPR NO MATCH" },
    { kind:"person",  level:"suspicious", tag:"Restricted",    title:"Movement on pool deck after closing",          meta:"ZONE 4 · 23:14 · ESCALATED" },
    { kind:"person",  level:"suspicious", tag:"Unattended",    title:"Unattended bag left in Block D lobby",          meta:"CAM-14 · 6 MIN STATIC · GUARD SENT" },
    { kind:"person",  level:"suspicious", tag:"No gate log",   title:"Delivery rider entered without a gate entry",  meta:"MAIN GATE · NO VISITOR RECORD" },
    { kind:"vehicle", level:"suspicious", tag:"Obstruction",   title:"Two-wheeler blocking the Block G fire lane",    meta:"CAM-19 · OBSTRUCTION · RWA NOTIFIED" },
    { kind:"person",  level:"suspicious", tag:"After hours",   title:"Domestic staff entry outside approved hours",   meta:"BLOCK B · 06:12 · PENDING APPROVAL" },
    { kind:"person",  level:"suspicious", tag:"Unknown",       title:"Unrecognised face at Block A lobby",           meta:"CAM-07 · NO MATCH IN REGISTRY" },
    { kind:"vehicle", level:"critical",   tag:"Speeding",      title:"Vehicle at 48 km/h in a 20 zone",              meta:"RING ROAD · CAM-03 · BARRIER HELD" },
    { kind:"person",  level:"critical",   tag:"Altercation",   title:"Altercation detected outside the clubhouse",   meta:"CAM-16 · 2 SUBJECTS · GUARD DISPATCHED" },
    { kind:"vehicle", level:"critical",   tag:"Forced entry",  title:"Vehicle forced the exit barrier",              meta:"GATE 2 · BOOM DAMAGED · POLICE CALLED" },
    { kind:"person",  level:"critical",   tag:"Fall detected", title:"Possible fall detected on the east path",      meta:"CAM-09 · NO MOVEMENT 40 S" },
    { kind:"person",  level:"critical",   tag:"Unsupervised",  title:"Child alone at the pool gate",                  meta:"ZONE 4 · NO GUARDIAN IN FRAME" },
    { kind:"person",  level:"critical",   tag:"Intrusion",     title:"Perimeter wall scaled near Block D",            meta:"CAM-21 · INTRUSION · GUARDS DISPATCHED" }
  ];

  var MAX_MOVERS = 12, SPAWN = [1800,4200];
  var INCIDENT_FIRST = [6000,11000], INCIDENT_GAP = [12000,20000];
  var CROWD_GAP = [28000,46000], FLAG_MS = 7000;
  var CAM_HOLD = 2800;   // ms a camera keeps its tint after losing the subject

  function rand(r){ return r[0] + Math.random()*(r[1]-r[0]); }
  function pick(a){ return a[Math.floor(Math.random()*a.length)]; }

  function el(name, attrs){
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function measure(pts){
    var segs=[], total=0;
    for (var i=1;i<pts.length;i++){
      var dx=pts[i][0]-pts[i-1][0], dy=pts[i][1]-pts[i-1][1];
      var len=Math.sqrt(dx*dx+dy*dy);
      if (!len) continue;
      segs.push({x:pts[i-1][0], y:pts[i-1][1], dx:dx/len, dy:dy/len, len:len, at:total});
      total+=len;
    }
    return {segs:segs, total:total};
  }

  function at(route,d,out){
    var s=route.segs;
    for (var i=s.length-1;i>=0;i--){
      if (d>=s[i].at || i===0){
        var t = d-s[i].at; if (t>s[i].len) t=s[i].len;
        out.x = s[i].x + s[i].dx*t;
        out.y = s[i].y + s[i].dy*t;
        return;
      }
    }
  }

  function init(){
    var stage = document.querySelector("[data-siteplan]");
    var layer = stage && stage.querySelector("[data-units]");
    var camLayer = stage && stage.querySelector("[data-cams]");
    if (!stage || !layer || !camLayer) return;

    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    var timers = [];

    /* Hands the sweep over from the CSS fallback to this file. */
    document.documentElement.classList.add("js-plan");

    /* ---- cameras ---- */
    var cams = Array.prototype.map.call(camLayer.querySelectorAll("[data-cam]"), function(g){
      return {
        g: g,
        pan: g.querySelector(".sp-cam__pan"),
        x: +g.getAttribute("data-x"),
        y: +g.getAttribute("data-y"),
        base: +g.getAttribute("data-aim"),
        span: 20 + Math.random()*14,
        w: 0.12 + Math.random()*0.14,
        phase: Math.random()*Math.PI*2,
        aim: 0, lastAim: null, holdLevel: null, holdUntil: 0, lastLevel: null
      };
    });

    /* ---- pooled subjects ---- */
    var pool = [], live = [];

    function makeNode(){
      var g = el("g", {class:"sp-unit"});
      /* An invisible, generous hit area: a 3px dot is not something anyone can
         reliably hover. */
      g.appendChild(el("circle", {class:"sp-unit__hit", r:12}));
      g.appendChild(el("circle", {class:"sp-unit__ping", r:8}));
      g.appendChild(el("rect", {class:"sp-unit__box", x:-9, y:-9, width:18, height:18, rx:2}));
      var bg = el("rect", {class:"sp-unit__tagbg", x:-9, y:-24, width:14, height:11, rx:2});
      var tx = el("text", {class:"sp-unit__tag", x:-5, y:-15.5});
      var dot = el("circle", {class:"sp-unit__dot", r:3.4});
      g.appendChild(bg); g.appendChild(tx); g.appendChild(dot);
      return {g:g, bg:bg, tx:tx, dot:dot};
    }

    function acquire(){
      var n = pool.pop() || makeNode();
      layer.appendChild(n.g);
      return n;
    }

    function release(u){
      u.node.g.remove();
      u.node.g.setAttribute("class","sp-unit");
      pool.push(u.node);
    }

    var pos = {x:0,y:0};

    function label(u, text){
      if (u.label === text) return;
      u.label = text;
      u.node.tx.textContent = text;
      /* Size the chip from the glyphs actually rendered. A character-count
         estimate is what produced the oversized green bars. */
      var measured = u.node.tx.getComputedTextLength ? u.node.tx.getComputedTextLength() : 0;
      var w = Math.max(measured, text.length * 4.9);   // 8px mono ~ 4.9 units/glyph
      u.node.bg.setAttribute("width", w + 9);
    }

    function spawn(def){
      def = def || pick(ROUTES);
      var node = acquire();
      node.g.setAttribute("class", "sp-unit sp-unit--" + def.kind);
      node.dot.setAttribute("r", def.kind === "vehicle" ? 3.9 : 3.2);
      var u = {
        node:node, kind:def.kind, route:measure(def.pts), d:0,
        speed:def.speed*(0.85+Math.random()*0.3),
        flagged:false, level:null, label:null, lastSeen:null, tx:null, ty:null
      };
      label(u, def.kind === "vehicle" ? "Vehicle" : "Resident");
      live.push(u);
      return u;
    }

    function seedClusters(){
      CLUSTERS.forEach(function(c){
        for (var i=0;i<c.n;i++){
          var node = acquire();
          node.g.setAttribute("class","sp-unit sp-unit--person sp-unit--ambient");
          var u = {
            node:node, kind:"person", cluster:c, flagged:false, level:null, label:null,
            lastSeen:null, tx:null, ty:null,
            phase:Math.random()*Math.PI*2, w:0.2+Math.random()*0.24, r:0.45+Math.random()*0.55
          };
          label(u,"Resident");
          live.push(u);
        }
      });
    }

    function crowd(){
      var n = 5 + Math.floor(Math.random()*4);
      for (var i=0;i<n;i++){
        var node = acquire();
        node.g.setAttribute("class","sp-unit sp-unit--person sp-unit--ambient");
        var u = {
          node:node, kind:"person", flagged:false, level:null, label:null,
          lastSeen:null, tx:null, ty:null,
          cluster:{cx:GATE.x+(Math.random()-0.5)*64, cy:GATE.y+(Math.random()-0.5)*22, rx:15, ry:7},
          phase:Math.random()*Math.PI*2, w:0.5+Math.random()*0.5, r:0.6+Math.random()*0.4,
          expires: performance.now()+11000+Math.random()*6000
        };
        label(u,"Visitor");
        live.push(u);
      }
      document.dispatchEvent(new CustomEvent("mysec:incident",{detail:{
        level:"info", icon:"user",
        title:"Visitor group checked in at the main gate",
        meta:n+" PASSES ISSUED · HOSTS NOTIFIED"}}));
      timers.push(setTimeout(crowd, rand(CROWD_GAP)));
    }

    function flag(){
      var inc = pick(INCIDENTS);
      var candidates = live.filter(function(u){ return u.kind===inc.kind && !u.flagged && !u.cluster; });
      if (candidates.length){
        var u = pick(candidates);
        u.flagged = true; u.level = inc.level;
        u.node.g.setAttribute("class", "sp-unit sp-unit--"+u.kind+" is-flagged is-"+inc.level);
        label(u, inc.tag);
        document.dispatchEvent(new CustomEvent("mysec:incident",{detail:{
          level:inc.level, icon:"alert", title:inc.title, meta:inc.meta}}));
        timers.push(setTimeout(function(){
          u.flagged=false; u.level=null;
          u.node.g.setAttribute("class","sp-unit sp-unit--"+u.kind);
          label(u, u.kind==="vehicle" ? "Vehicle" : "Resident");
        }, FLAG_MS));
      }
      timers.push(setTimeout(flag, rand(INCIDENT_GAP)));
    }

    function tickSpawn(){
      var movers = 0;
      for (var i=0;i<live.length;i++) if (!live[i].cluster) movers++;
      if (movers < MAX_MOVERS) spawn();
      timers.push(setTimeout(tickSpawn, rand(SPAWN)));
    }

    /* ---- frame ---- */
    var last = null, frame = null, t = 0;

    function step(now){
      var dt = last === null ? 0 : Math.min((now-last)/1000, 0.1);
      last = now; t += dt;

      var i, k, c, u;

      /* Aim every camera first — coverage below depends on it. */
      for (i=0;i<cams.length;i++){
        c = cams[i];
        c.aim = c.base + Math.sin(t*c.w + c.phase) * c.span;
        if (c.lastAim === null || Math.abs(c.aim - c.lastAim) > 0.4){
          c.pan.setAttribute("transform","rotate("+c.aim.toFixed(1)+")");
          c.lastAim = c.aim;
        }
      }

      for (i=live.length-1;i>=0;i--){
        u = live[i];

        if (u.cluster){
          if (u.expires && now > u.expires){ release(u); live.splice(i,1); continue; }
          u.phase += u.w*dt;
          pos.x = u.cluster.cx + Math.cos(u.phase)*u.cluster.rx*u.r;
          pos.y = u.cluster.cy + Math.sin(u.phase*1.3)*u.cluster.ry*u.r;
        } else {
          u.d += u.speed*dt;
          if (u.d > u.route.total){ release(u); live.splice(i,1); continue; }
          at(u.route, u.d, pos);
        }

        /* Is anything watching? This also records which camera, so the one
           that spotted a flagged subject can be tinted and marked. */
        var seen = false;
        for (k=0;k<cams.length;k++){
          c = cams[k];
          var dx = pos.x-c.x, dy = pos.y-c.y;
          if (dx*dx + dy*dy > SEE_RANGE*SEE_RANGE) continue;
          var diff = Math.abs(((Math.atan2(dy,dx)/DEG - c.aim + 540) % 360) - 180);
          if (diff > SEE_HALF) continue;
          seen = true;
          if (!u.flagged) break;          // only need one witness for culling
          /* Every camera with the subject in frame takes the tint and starts
             its own hold, so the handover between them reads as a track rather
             than a single lamp blinking. Critical outranks suspicious. */
          if (c.holdLevel !== "critical") c.holdLevel = u.level;
          c.holdUntil = now + CAM_HOLD;
        }

        if (seen !== u.lastSeen){
          u.node.g.classList.toggle("is-unseen", !seen);
          u.lastSeen = seen;
        }

        if (u.tx !== pos.x || u.ty !== pos.y){
          u.node.g.setAttribute("transform","translate("+pos.x.toFixed(1)+" "+pos.y.toFixed(1)+")");
          u.tx = pos.x; u.ty = pos.y;
        }
      }

      /* A camera holds its tint for CAM_HOLD after last seeing the subject, so
         it stays lit while the subject moves on instead of flicking off the
         instant it leaves the cone. Only cameras whose state changed are
         written. */
      for (i=0;i<cams.length;i++){
        c = cams[i];
        var lvl = now < c.holdUntil ? c.holdLevel : null;
        if (lvl === null) c.holdLevel = null;
        if (lvl !== c.lastLevel){
          c.g.setAttribute("class", "sp-cam" + (lvl ? " is-"+lvl : ""));
          c.lastLevel = lvl;
        }
      }

      frame = requestAnimationFrame(step);
    }

    /* ---- lifecycle ---- */
    var running = false;

    function start(){
      if (running || reduced.matches) return;
      running = true;
      stage.classList.remove("is-idle");
      if (!live.length){ seedClusters(); spawn(); spawn(); spawn(); }
      last = null;
      frame = requestAnimationFrame(step);
      timers.push(setTimeout(tickSpawn, rand(SPAWN)));
      timers.push(setTimeout(flag, rand(INCIDENT_FIRST)));
      timers.push(setTimeout(crowd, rand(CROWD_GAP)));
    }

    function stop(){
      if (!running) return;
      running = false;
      stage.classList.add("is-idle");
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      for (var i=0;i<timers.length;i++) clearTimeout(timers[i]);
      timers.length = 0;
    }

    var onScreen = false, pageVisible = !document.hidden;
    function sync(){ if (onScreen && pageVisible && !reduced.matches) start(); else stop(); }

    if ("IntersectionObserver" in window){
      new IntersectionObserver(function(es){
        for (var i=0;i<es.length;i++) onScreen = es[i].isIntersecting;
        sync();
      }, {threshold:0.12}).observe(stage);
    } else { onScreen = true; sync(); }

    document.addEventListener("visibilitychange", function(){
      pageVisible = !document.hidden; sync();
    });

    if (reduced.matches){
      seedClusters(); spawn(ROUTES[0]); spawn(ROUTES[4]); spawn(ROUTES[7]);
      live.forEach(function(u,i){
        if (u.cluster){ pos.x = u.cluster.cx + (i%3-1)*16; pos.y = u.cluster.cy + (i%2)*10; }
        else at(u.route, u.route.total*0.35, pos);
        u.node.g.setAttribute("transform","translate("+pos.x.toFixed(1)+" "+pos.y.toFixed(1)+")");
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once:true });
  } else { init(); }
})();
