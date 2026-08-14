/* ==========================================================================
   mySecurity — LAB: hero camera controller
   Experiment-only. Loaded by lab.html, used nowhere else.

   A classic script (no modules) on purpose: it has no dependencies and this
   keeps it independent of the site's module graph.

   WHAT IT OWNS
   The head's yaw is the single source of truth for the whole effect. This file
   drives it and publishes three custom properties every frame:

       --yaw        head rotation, degrees, scene space
       --sweep      the beam's SCREEN-space angle, derived from --yaw
       --pivot-x/y  the lens's measured position inside the hero

   CSS consumes those. Nothing else computes an angle, so the cone, the
   headline wedge and the housing can never drift apart.

   WHY --sweep IS NOT JUST --yaw
   The head turns about Y in a scene that is tilted toward the viewer, so the
   on-screen rotation is a projection of the yaw, not the yaw itself:

       screen = atan2(-sin(viewYaw + yaw) * sin(tilt), cos(viewYaw + yaw))

   WHY THE PIVOT IS MEASURED EVERY FRAME
   The lens rides on the panning head — it travels ~88px across a sweep. A
   fixed pivot detaches the cone from the camera, which is exactly the artefact
   this replaces.

   PROGRESSIVE ENHANCEMENT
   lab.css animates --yaw and --sweep with plain keyframes on its own. This
   file adds .js-cam to <html>, which switches those animations off and hands
   control here. With JS unavailable the hero still pans, just without the
   pointer interaction.
   ========================================================================== */

(function () {
  "use strict";

  /* ---- geometry -------------------------------------------------------- */

  var VIEW_YAW = -38;   // .cam__scene rotateY, degrees
  var VIEW_TILT = 34;   // .cam__scene rotateX magnitude, degrees
  var YAW_MIN = -24;    // autonomous left limit  (asymmetric: keeps both ends in 3/4)
  var YAW_MAX = 14;     // autonomous right limit

  /* The head can be *driven* further than it chooses to sweep on its own —
     a real PTZ has more travel than its patrol preset uses. Widening only the
     pointer range keeps the idle animation composed while making the
     interaction feel responsive rather than walled in. */
  var DRIVE_MIN = -36;
  var DRIVE_MAX = 26;
  var CYCLE = 8400;     // ms, one full sweep
  var DEG = Math.PI / 180;

  /* Dwell/travel profile, as fractions of the cycle. A real PTZ head ramps,
     then holds at each limit; a pure sine reads as a pendulum. */
  var HOLD_L_END = 0.07;
  var TRAVEL_END = 0.43;
  var HOLD_R_END = 0.57;
  var RETURN_END = 0.93;

  /* Smoothing rates, in "e-folds per second". Higher = snappier. Following
     the pointer is deliberately quicker than recovering from it. */
  var K_FOLLOW = 5.0;
  var K_AUTO = 2.6;

  /* How long the pointer must sit still before the head gives up on it and
     resumes its own patrol. */
  var IDLE_RELEASE = 1500;   // ms
  var ALERT_MS = 1700;       // must match the cam-alert keyframes

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /* Shortest distance from a point to a rectangle; 0 when inside. */
  function distToRect(x, y, r) {
    var dx = Math.max(r.left - x, 0, x - r.right);
    var dy = Math.max(r.top - y, 0, y - r.bottom);
    return Math.sqrt(dx * dx + dy * dy);
  }

  /* Smootherstep — zero first AND second derivative at both ends, so the head
     eases out of a dwell without a visible corner. */
  function ease(t) { return t * t * t * (t * (t * 6 - 15) + 10); }

  /* The autonomous pan, as a pure function of phase. Keeping it pure is what
     makes the hand-back seamless: we can search it for the phase that matches
     wherever the pointer left the head. */
  function oscillate(phase) {
    if (phase < HOLD_L_END) return YAW_MIN;
    if (phase < TRAVEL_END) {
      return YAW_MIN + (YAW_MAX - YAW_MIN) *
        ease((phase - HOLD_L_END) / (TRAVEL_END - HOLD_L_END));
    }
    if (phase < HOLD_R_END) return YAW_MAX;
    if (phase < RETURN_END) {
      return YAW_MAX - (YAW_MAX - YAW_MIN) *
        ease((phase - HOLD_R_END) / (RETURN_END - HOLD_R_END));
    }
    return YAW_MIN;
  }

  /* Screen-space angle of the beam for a given head yaw. */
  function screenAngle(yaw) {
    var t = (VIEW_YAW + yaw) * DEG;
    var p = VIEW_TILT * DEG;
    return Math.atan2(-Math.sin(t) * Math.sin(p), Math.cos(t)) / DEG;
  }

  /* Phase whose oscillator output best matches `yaw`, preferring the half of
     the cycle already travelling in `dir`. This is what stops the camera
     jumping when the pointer leaves: instead of snapping to wherever the clock
     happens to be, we move the clock to where the camera already is. */
  function phaseFor(yaw, dir) {
    var best = 0;
    var bestErr = Infinity;
    for (var i = 0; i <= 240; i++) {
      var p = i / 240;
      var outgoing = p >= HOLD_L_END && p < TRAVEL_END;
      var returning = p >= HOLD_R_END && p < RETURN_END;
      if (dir > 0 && !outgoing) continue;
      if (dir < 0 && !returning) continue;
      var err = Math.abs(oscillate(p) - yaw);
      if (err < bestErr) { bestErr = err; best = p; }
    }
    return best;
  }

  /* ---- boot ------------------------------------------------------------ */

  function init() {
    var hero = document.querySelector(".hero--lab");
    var rig = document.querySelector(".hero__rig");
    var lens = document.querySelector(".lens__glass");
    if (!hero || !rig || !lens) return;

    var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    var lit = hero.querySelectorAll("[data-lit], [data-lit-glow]");

    /* Mirror each lit element's own text into data-text for the ::after layer.
       Generated rather than hand-written so the bright copy can never drift
       from the real text, and so the accessibility tree still sees it once. */
    for (var i = 0; i < lit.length; i++) {
      /* Only text elements get a bright duplicate; controls are lit additively
         and have nothing to mirror. */
      if (!lit[i].hasAttribute("data-lit")) continue;
      lit[i].setAttribute(
        "data-text",
        lit[i].textContent.replace(/\s+/g, " ").trim()
      );
    }

    document.documentElement.classList.add("js-cam");

    var heroBox = null;

    function measureLayout() {
      heroBox = hero.getBoundingClientRect();
      for (var j = 0; j < lit.length; j++) {
        var b = lit[j].getBoundingClientRect();
        lit[j].style.setProperty("--dx", Math.round(b.left - heroBox.left) + "px");
        lit[j].style.setProperty("--dy", Math.round(b.top - heroBox.top) + "px");
      }
    }

    /* ---- state ---- */
    var yaw = YAW_MIN;
    var target = YAW_MIN;
    var following = false;
    var phase = 0;
    var last = null;
    var frame = null;
    var lastMoveAt = -Infinity;
    var alertEl = hero.querySelector("[data-alert]");
    var alertTimer = null;

    /* The "!" beat, fired when the head re-acquires a moving subject: on first
       entry, and again whenever the pointer wakes up after the head has given
       up and gone back to patrolling. Restarting the animation needs the class
       removed, a reflow forced, then re-added — otherwise re-adding it in the
       same frame is a no-op. */
    function alert() {
      if (!alertEl || reduced.matches) return;
      alertEl.classList.remove("is-on");
      void alertEl.offsetWidth;
      alertEl.classList.add("is-on");
      window.clearTimeout(alertTimer);
      alertTimer = window.setTimeout(function () {
        alertEl.classList.remove("is-on");
      }, ALERT_MS);
    }

    /* Hand the head back to its patrol, continuing from where it is rather
       than snapping to wherever the clock happens to have got to. */
    function release() {
      if (!following) return;
      following = false;
      phase = phaseFor(yaw, target >= yaw ? 1 : -1);
      /* Subject lost: drop the annotation too. It reappears with the alert on
         the next movement. */
      if (tracker) tracker.classList.remove("is-on");
    }

    var lastYaw = null;
    var lastPivot = "";

    function publish(hb, lb) {
      var y = yaw.toFixed(2);
      if (y !== lastYaw) {
        lastYaw = y;
        hero.style.setProperty("--yaw", y + "deg");
        hero.style.setProperty("--sweep", screenAngle(yaw).toFixed(2) + "deg");
      }

      if (lb.width === 0 && lb.height === 0) return;
      var px = Math.round(lb.left + lb.width / 2 - hb.left);
      var py = Math.round(lb.top + lb.height / 2 - hb.top);
      var key = px + "," + py;
      if (key !== lastPivot) {
        lastPivot = key;
        hero.style.setProperty("--pivot-x", px + "px");
        hero.style.setProperty("--pivot-y", py + "px");
      }
    }

    function step(now) {
      if (last === null) last = now;
      var dt = Math.min((now - last) / 1000, 0.1);   // clamp after a tab switch
      last = now;

      /* Pointer has gone quiet — resume patrolling on our own. */
      if (following && now - lastMoveAt > IDLE_RELEASE) release();

      var k;
      if (following) {
        k = K_FOLLOW;
      } else {
        phase = (phase + dt * 1000 / CYCLE) % 1;
        target = oscillate(phase);
        k = K_AUTO;
      }

      /* Exponential smoothing, framerate-independent. Critically damped by
         construction — it cannot overshoot, so the head never wobbles. */
      yaw += (target - yaw) * (1 - Math.exp(-k * dt));

      /* READ, then WRITE. Both rects come out of one layout pass; nothing
         below reads geometry again. */
      heroBox = hero.getBoundingClientRect();
      publish(heroBox, lens.getBoundingClientRect());

      frame = window.requestAnimationFrame(step);
    }

    function start() {
      hero.classList.remove("is-idle");
      if (frame === null && !reduced.matches) {
        last = null;   // don't integrate the gap we were asleep for
        frame = window.requestAnimationFrame(step);
      }
    }

    /* Also parks the rig's own CSS animations — stopping the loop alone left
       the status LED and lens highlight animating an element nobody can see. */
    function stop() {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
      hero.classList.add("is-idle");
    }

    /* ---- tracker ---------------------------------------------------------
       Classifies what the pointer is doing relative to the calls to action and
       annotates it. Three states:

         interest — within NEAR of a CTA
         loiter   — was near one recently and is now moving away from it
         track    — anything else

       "Moving away" is measured against the previous distance rather than a
       velocity vector, so it stays true when the cursor arcs around a button
       instead of retreating in a straight line. */

    var NEAR_IN = 135;       // px — cross this inward to become "interested"
    var NEAR_OUT = 172;      // px — cross this outward to fall back
    var tracker = hero.querySelector("[data-tracker]");
    var trackerLabel = hero.querySelector("[data-tracker-label]");
    var ctas = hero.querySelectorAll(".hero__actions .btn");
    var boxX = 0, boxY = 0, hasBox = false;
    var state = "loiter";

    var LABELS = { interest: "Showing interest", loiter: "Loitering" };

    function classify(px, py) {
      var d = Infinity;
      for (var c = 0; c < ctas.length; c++) {
        d = Math.min(d, distToRect(px, py, ctas[c].getBoundingClientRect()));
      }

      /* Hysteresis: the threshold to become interested is tighter than the one
         to stop being interested, so hovering right on the boundary does not
         flicker between two labels. */
      var next = state === "interest"
        ? (d > NEAR_OUT ? "loiter" : "interest")
        : (d <= NEAR_IN ? "interest" : "loiter");

      if (next !== state) {
        state = next;
        tracker.setAttribute("data-state", state);
        trackerLabel.textContent = LABELS[state];
      }
    }

    function trackPointer(event) {
      if (!tracker) return;
      /* Viewport coords: the CTA rects are viewport-relative too, so the
         comparison needs no conversion. The box is positioned in hero space. */
      trackerX = event.clientX;
      trackerY = event.clientY;
      boxX = trackerX;
      boxY = trackerY;
      hasBox = true;

      if (heroBox === null) measureLayout();

      /* The label row sits above the box, so the top edge is where it would be
         clipped by the hero's overflow. Drop it below the box there. */
      tracker.classList.toggle(
        "tracker--flip",
        boxY - heroBox.top < 96
      );

      placeTracker();
      classify(trackerX, trackerY);
      tracker.classList.add("is-on");
    }

    var trackerX = 0, trackerY = 0;

    function placeTracker() {
      if (heroBox === null) measureLayout();
      tracker.style.transform =
        "translate3d(" + (boxX - heroBox.left).toFixed(1) + "px," +
        (boxY - heroBox.top).toFixed(1) + "px,0)";
    }

    /* ---- pointer --------------------------------------------------------
       The head follows the pointer across the hero, mapped onto its drive
       range — wider than the patrol sweep, but still bounded by what the
       hardware could actually do. */

    function onMove(event) {
      if (window.matchMedia("(max-width: 720px)").matches) return;
      if (heroBox === null) measureLayout();

      trackPointer(event);

      /* The annotation is informational and stays; only the head-follow is
         motion, so that is what reduced-motion drops. */
      if (reduced.matches) return;

      /* Re-acquisition: either the first move in the hero, or the pointer
         waking up after the head had given up on it. */
      if (!following) alert();

      var nx = clamp((event.clientX - heroBox.left) / heroBox.width, 0, 1);
      target = DRIVE_MIN + nx * (DRIVE_MAX - DRIVE_MIN);
      following = true;
      lastMoveAt = performance.now();
    }

    function onLeave() {
      if (tracker) {
        tracker.classList.remove("is-on");
        hasBox = false;                    // next entry starts fresh
        state = "loiter";
        tracker.setAttribute("data-state", state);
        trackerLabel.textContent = LABELS[state];
      }
      release();
    }

    hero.addEventListener("pointermove", onMove, { passive: true });
    hero.addEventListener("pointerleave", onLeave, { passive: true });
    hero.addEventListener("pointercancel", onLeave, { passive: true });

    /* ---- lifecycle ---- */

    measureLayout();
    publish(hero.getBoundingClientRect(), lens.getBoundingClientRect());

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        measureLayout();
        publish(hero.getBoundingClientRect(), lens.getBoundingClientRect());
      });
    }

    if ("ResizeObserver" in window) {
      var ro = new ResizeObserver(function () {
        measureLayout();
        publish(hero.getBoundingClientRect(), lens.getBoundingClientRect());
      });
      ro.observe(hero);
      ro.observe(rig);
    } else {
      window.addEventListener("resize", function () {
        measureLayout();
        publish(hero.getBoundingClientRect(), lens.getBoundingClientRect());
      }, { passive: true });
    }

    /* The loop should run only when the hero is on screen AND the page is
       visible AND motion is allowed. Deriving it from all three, rather than
       letting each source call start/stop directly, stops them undoing each
       other — a scroll callback could otherwise wake the loop on a hidden tab. */
    var onScreen = true;
    var pageVisible = !document.hidden;

    function sync() {
      if (onScreen && pageVisible && !reduced.matches) start();
      else stop();
    }

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        for (var n = 0; n < entries.length; n++) onScreen = entries[n].isIntersecting;
        sync();
      }, { threshold: 0, rootMargin: "80px" }).observe(hero);
    }

    document.addEventListener("visibilitychange", function () {
      pageVisible = !document.hidden;
      sync();
    });

    function onMotion() {
      if (reduced.matches) {
        yaw = 0;
        target = 0;
        following = false;
        publish(hero.getBoundingClientRect(), lens.getBoundingClientRect());
      }
      sync();
    }
    if (typeof reduced.addEventListener === "function") {
      reduced.addEventListener("change", onMotion);
    }
    onMotion();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
