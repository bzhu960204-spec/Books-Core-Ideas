/* Chapter-image viewer for exported explanation HTML.
 *
 * Inlined verbatim into the exported file (imported with ?raw), so it is NOT
 * transpiled: keep it a self-contained IIFE with ES2019 syntax at most (no ?. / ??,
 * no import/export). It reads the images from #chapter-images .ci-fig and builds a
 * floating button, a side / bottom panel and a full-screen lightbox with the DOM API.
 */
(function () {
  'use strict';

  // Mirrors utils/zoomMath.js; keep in sync. A module cannot be imported here.
  function fitScale(natural, container) {
    if (!natural.width || !natural.height || !container.width || !container.height) return 1;
    return Math.min(container.width / natural.width, container.height / natural.height, 1);
  }
  function clampScale(scale, min, max) {
    return Math.min(max, Math.max(min, scale));
  }
  function zoomAt(view, nextScale, point) {
    var ratio = nextScale / view.scale;
    return {
      scale: nextScale,
      x: point.x - (point.x - view.x) * ratio,
      y: point.y - (point.y - view.y) * ratio,
    };
  }
  function clampAxis(offset, imageSize, containerSize) {
    if (imageSize <= containerSize) return (containerSize - imageSize) / 2;
    return Math.min(0, Math.max(containerSize - imageSize, offset));
  }
  function clampOffset(view, natural, container) {
    return {
      x: clampAxis(view.x, natural.width * view.scale, container.width),
      y: clampAxis(view.y, natural.height * view.scale, container.height),
    };
  }

  var figs = document.querySelectorAll('#chapter-images .ci-fig');
  if (!figs.length) return;

  var root = document.documentElement;
  var body = document.body;
  root.classList.remove('no-js');
  root.classList.add('js');

  var items = [];
  Array.prototype.forEach.call(figs, function (fig, i) {
    var img = fig.querySelector('img');
    if (!img) return;
    items.push({
      src: img.getAttribute('src'),
      name: fig.getAttribute('data-name') || 'Image ' + (i + 1),
    });
  });
  if (!items.length) return;

  var MAX_SCALE = 8;
  var STEP = 1.2;
  var TAP_MS = 300;
  var TAP_DIST = 10;
  var SWIPE_MIN = 50;

  function make(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }
  function button(cls, text, label) {
    var node = make('button', cls, text);
    node.type = 'button';
    if (label) {
      node.setAttribute('aria-label', label);
      node.title = label;
    }
    return node;
  }
  function distance(a, b) {
    return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
  }

  // ---- Zoomable stage: { scale, x, y, fit }, transform: translate(x, y) scale(s) ----
  function createStage(onSwipe, withOneToOne) {
    var stage = make('div', 'ci-stage');
    stage.tabIndex = 0;
    var img = make('img', 'ci-img');
    img.alt = '';
    img.setAttribute('draggable', 'false');
    stage.appendChild(img);

    var tools = make('div', 'ci-zoom-tools');
    var zoomOutBtn = button('ci-btn ci-tool', '\u2212', 'Zoom out');
    var pct = make('span', 'ci-zoom-pct', '100%');
    var zoomInBtn = button('ci-btn ci-tool', '+', 'Zoom in');
    var fitBtn = button('ci-btn ci-tool', 'Fit', 'Fit to window');
    tools.appendChild(zoomOutBtn);
    tools.appendChild(pct);
    tools.appendChild(zoomInBtn);
    tools.appendChild(fitBtn);
    var oneBtn = null;
    if (withOneToOne) {
      oneBtn = button('ci-btn ci-tool ci-wide-only', '1:1', 'Actual size');
      tools.appendChild(oneBtn);
    }
    stage.appendChild(tools);

    var natural = { width: 0, height: 0 };
    var view = { scale: 1, x: 0, y: 0, fit: true };
    var pointers = new Map();
    var drag = null;
    var pinch = null;
    var multi = false;
    var lastTap = null;

    function size() {
      return { width: stage.clientWidth, height: stage.clientHeight };
    }
    function center() {
      var c = size();
      return { x: c.width / 2, y: c.height / 2 };
    }
    function local(clientX, clientY) {
      var r = stage.getBoundingClientRect();
      return { x: clientX - r.left, y: clientY - r.top };
    }
    function minScale() {
      return Math.min(fitScale(natural, size()), 0.1);
    }
    function paint() {
      img.style.transform = 'translate(' + view.x + 'px, ' + view.y + 'px) scale(' + view.scale + ')';
      pct.textContent = Math.round(view.scale * 100) + '%';
    }
    function isFitScale(scale) {
      return Math.abs(scale - fitScale(natural, size())) < 0.001;
    }
    function setView(scale, x, y) {
      var o = clampOffset({ scale: scale, x: x, y: y }, natural, size());
      view = { scale: scale, x: o.x, y: o.y, fit: isFitScale(scale) };
      paint();
    }
    function fit() {
      setView(fitScale(natural, size()), 0, 0);
    }
    function zoomTo(next, point) {
      var s = clampScale(next, minScale(), MAX_SCALE);
      var z = zoomAt(view, s, point);
      setView(s, z.x, z.y);
    }
    function isZoomed() {
      return view.scale > fitScale(natural, size()) + 0.001;
    }
    function toggleZoom(point) {
      var fs = fitScale(natural, size());
      if (view.scale <= fs + 0.001) zoomTo(fs >= 0.999 ? 2 : 1, point);
      else fit();
    }

    function onLoad() {
      natural = { width: img.naturalWidth, height: img.naturalHeight };
      fit();
      img.style.visibility = 'visible';
    }
    img.addEventListener('load', onLoad);

    function setImage(src) {
      natural = { width: 0, height: 0 };
      img.style.visibility = 'hidden';
      if (img.getAttribute('src') !== src) img.setAttribute('src', src);
      if (img.complete && img.naturalWidth) onLoad();
    }
    function resize() {
      var c = size();
      if (!c.width || !c.height || !natural.width) return;
      if (view.fit) fit();
      else setView(view.scale, view.x, view.y);
    }
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(stage);
    else window.addEventListener('resize', resize);

    zoomOutBtn.addEventListener('click', function () { zoomTo(view.scale / STEP, center()); });
    zoomInBtn.addEventListener('click', function () { zoomTo(view.scale * STEP, center()); });
    fitBtn.addEventListener('click', fit);
    if (oneBtn) oneBtn.addEventListener('click', function () { zoomTo(1, center()); });

    function handleKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return false;
      if (e.key === '+' || e.key === '=') zoomTo(view.scale * STEP, center());
      else if (e.key === '-') zoomTo(view.scale / STEP, center());
      else if (e.key === '0') fit();
      else if (e.key === '1') zoomTo(1, center());
      else return false;
      return true;
    }
    stage.addEventListener('keydown', function (e) {
      if (handleKey(e)) e.preventDefault();
    });

    stage.addEventListener('wheel', function (e) {
      e.preventDefault();
      zoomTo(e.deltaY < 0 ? view.scale * STEP : view.scale / STEP, local(e.clientX, e.clientY));
    }, { passive: false });

    // Old iOS Safari would otherwise zoom the whole page on a pinch.
    stage.addEventListener('gesturestart', function (e) { e.preventDefault(); });
    stage.addEventListener('gesturechange', function (e) { e.preventDefault(); });

    function pinchPoints() {
      var pts = Array.from(pointers.values());
      return {
        dist: distance(pts[0], pts[1]) || 1,
        mid: local((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2),
      };
    }
    function startPinch() {
      var p = pinchPoints();
      pinch = { dist: p.dist, mid: p.mid, view: view };
      drag = null;
    }

    stage.addEventListener('pointerdown', function (e) {
      if (tools.contains(e.target)) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      try { stage.setPointerCapture(e.pointerId); } catch { /* not supported */ }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        multi = false;
        drag = { x: e.clientX, y: e.clientY, view: view, moved: false };
      } else {
        multi = true;
        startPinch();
      }
    });

    stage.addEventListener('pointermove', function (e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pointers.size >= 2) {
        var p = pinchPoints();
        var s = clampScale(pinch.view.scale * p.dist / pinch.dist, minScale(), MAX_SCALE);
        var z = zoomAt(pinch.view, s, pinch.mid);
        setView(s, z.x + p.mid.x - pinch.mid.x, z.y + p.mid.y - pinch.mid.y);
      } else if (drag) {
        var dx = e.clientX - drag.x;
        var dy = e.clientY - drag.y;
        if (Math.abs(dx) > TAP_DIST || Math.abs(dy) > TAP_DIST) drag.moved = true;
        if (isZoomed()) setView(drag.view.scale, drag.view.x + dx, drag.view.y + dy);
      }
    });

    function endPointer(e, cancelled) {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (pointers.size >= 2) {
        startPinch();
        return;
      }
      if (pointers.size === 1) {
        var rest = pointers.values().next().value;
        pinch = null;
        drag = { x: rest.x, y: rest.y, view: view, moved: true };
        return;
      }
      var d = drag;
      var wasMulti = multi;
      drag = null;
      pinch = null;
      multi = false;
      if (cancelled || wasMulti || !d) return;
      var dx = e.clientX - d.x;
      var dy = e.clientY - d.y;
      if (!isZoomed() && Math.abs(dx) > SWIPE_MIN && Math.abs(dx) > Math.abs(dy)) {
        lastTap = null;
        onSwipe(dx < 0 ? 1 : -1);
        return;
      }
      if (d.moved) return;
      var p = local(e.clientX, e.clientY);
      var now = Date.now();
      if (lastTap && now - lastTap.t <= TAP_MS && distance(p, lastTap) <= TAP_DIST) {
        lastTap = null;
        toggleZoom(p);
      } else {
        lastTap = { t: now, x: p.x, y: p.y };
      }
    }
    stage.addEventListener('pointerup', function (e) { endPointer(e, false); });
    stage.addEventListener('pointercancel', function (e) { endPointer(e, true); });

    return { el: stage, setImage: setImage, resize: resize, handleKey: handleKey };
  }

  // ---- Shared state ----
  var state = { index: 0, panel: false, lightbox: false };
  var panelShown = -1;
  var lightboxShown = -1;

  function go(delta) {
    var next = state.index + delta;
    if (next < 0 || next >= items.length || next === state.index) return;
    state.index = next;
    render();
  }

  function createBar(extra) {
    var bar = make('div', 'ci-bar');
    var prev = button('ci-btn', '\u2039', 'Previous image');
    var count = make('span', 'ci-count');
    var next = button('ci-btn', '\u203a', 'Next image');
    var name = make('span', 'ci-name');
    prev.addEventListener('click', function () { go(-1); });
    next.addEventListener('click', function () { go(1); });
    bar.appendChild(prev);
    bar.appendChild(count);
    bar.appendChild(next);
    bar.appendChild(name);
    extra.forEach(function (node) { bar.appendChild(node); });
    return {
      el: bar,
      update: function () {
        var item = items[state.index];
        count.textContent = state.index + 1 + ' / ' + items.length;
        name.textContent = item.name;
        name.title = item.name;
        prev.disabled = state.index === 0;
        next.disabled = state.index === items.length - 1;
      },
    };
  }

  // ---- Floating button ----
  var fab = button('ci-fab', null, 'Show chapter images');
  fab.appendChild(make('span', 'ci-fab-icon', '\uD83D\uDDBC'));
  fab.appendChild(make('span', 'ci-badge', String(items.length)));

  // ---- Panel (right side on wide screens, bottom on narrow ones) ----
  var panel = make('aside', 'ci-panel');
  panel.setAttribute('aria-label', 'Chapter images');
  var resizerV = make('div', 'ci-resizer-v');
  resizerV.setAttribute('role', 'separator');
  resizerV.setAttribute('aria-orientation', 'vertical');
  resizerV.setAttribute('aria-label', 'Resize image panel');
  resizerV.tabIndex = 0;
  var resizerH = make('div', 'ci-resizer-h');
  resizerH.setAttribute('role', 'separator');
  resizerH.setAttribute('aria-orientation', 'horizontal');
  resizerH.setAttribute('aria-label', 'Resize image panel');
  resizerH.tabIndex = 0;

  var expandBtn = button('ci-btn', '\u26F6', 'Open full screen');
  var closeBtn = button('ci-btn', '\u2715', 'Close images');
  var panelBar = createBar([expandBtn, closeBtn]);
  var panelStage = createStage(go, true);
  panel.appendChild(resizerV);
  panel.appendChild(resizerH);
  panel.appendChild(panelBar.el);
  panel.appendChild(panelStage.el);

  var thumbs = [];
  if (items.length > 1) {
    var thumbStrip = make('div', 'ci-thumbs');
    items.forEach(function (item, i) {
      var t = button('ci-thumb', null, 'Show ' + item.name);
      var ti = make('img');
      ti.src = item.src;
      ti.alt = '';
      ti.setAttribute('draggable', 'false');
      t.appendChild(ti);
      t.addEventListener('click', function () {
        state.index = i;
        render();
        if (t.scrollIntoView) t.scrollIntoView({ inline: 'nearest', block: 'nearest' });
      });
      thumbs.push(t);
      thumbStrip.appendChild(t);
    });
    panel.appendChild(thumbStrip);
  }

  // Arrow keys switch images only while focus is inside the panel.
  panel.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'ArrowRight') go(1);
    else return;
    e.preventDefault();
  });

  function openPanel() {
    if (state.panel) return;
    state.panel = true;
    panel.classList.add('ci-show');
    body.classList.add('ci-open');
    render();
    panelStage.resize();
    try { panelStage.el.focus({ preventScroll: true }); } catch { /* ignore */ }
  }
  function closePanel() {
    if (!state.panel) return;
    state.panel = false;
    panel.classList.remove('ci-show');
    body.classList.remove('ci-open');
    try { fab.focus({ preventScroll: true }); } catch { /* ignore */ }
  }
  fab.addEventListener('click', openPanel);
  closeBtn.addEventListener('click', closePanel);
  expandBtn.addEventListener('click', function () { openLightbox(); });

  // ---- Resizing the panel ----
  var ratio = { w: null, h: null };
  function applySizes() {
    if (ratio.w != null) root.style.setProperty('--ci-panel-w', Math.round(window.innerWidth * ratio.w) + 'px');
    if (ratio.h != null) root.style.setProperty('--ci-panel-h', Math.round(window.innerHeight * ratio.h) + 'px');
    panelStage.resize();
  }
  window.addEventListener('resize', applySizes);

  function currentRatio(axis) {
    if (ratio[axis] != null) return ratio[axis];
    var rect = panel.getBoundingClientRect();
    if (axis === 'w') return rect.width / window.innerWidth || 0.4;
    return rect.height / window.innerHeight || 0.45;
  }
  function setRatio(axis, value) {
    ratio[axis] = axis === 'w' ? clampScale(value, 0.25, 0.65) : clampScale(value, 0.25, 0.75);
    applySizes();
  }
  function makeResizer(handle, axis, shrinkKey, growKey, fromPointer) {
    var dragging = false;
    handle.addEventListener('pointerdown', function (e) {
      dragging = true;
      try { handle.setPointerCapture(e.pointerId); } catch { /* not supported */ }
      e.preventDefault();
    });
    handle.addEventListener('pointermove', function (e) {
      if (dragging) setRatio(axis, fromPointer(e));
    });
    function stop() { dragging = false; }
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
    handle.addEventListener('keydown', function (e) {
      if (e.key !== shrinkKey && e.key !== growKey) return;
      setRatio(axis, currentRatio(axis) + (e.key === growKey ? 0.05 : -0.05));
      e.preventDefault();
      e.stopPropagation();
    });
  }
  // The side panel grows when its divider moves left; the bottom one when its handle moves up.
  makeResizer(resizerV, 'w', 'ArrowRight', 'ArrowLeft', function (e) {
    return (window.innerWidth - e.clientX) / window.innerWidth;
  });
  makeResizer(resizerH, 'h', 'ArrowDown', 'ArrowUp', function (e) {
    return (window.innerHeight - e.clientY) / window.innerHeight;
  });

  // ---- Lightbox ----
  var lightbox = make('div', 'ci-lightbox');
  lightbox.setAttribute('role', 'dialog');
  lightbox.setAttribute('aria-modal', 'true');
  lightbox.setAttribute('aria-label', 'Chapter images');
  var lbClose = button('ci-btn', '\u2715', 'Close');
  var lbBar = createBar([lbClose]);
  var lbStage = createStage(go, true);
  lightbox.appendChild(lbBar.el);
  lightbox.appendChild(lbStage.el);

  var pushed = false;
  var pendingBack = 0;
  var prevOverflow = '';
  var lastFocus = null;

  function openLightbox() {
    if (state.lightbox) return;
    state.lightbox = true;
    lastFocus = document.activeElement;
    lightbox.classList.add('ci-show');
    prevOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    // So the Android back button closes the lightbox instead of leaving the page.
    try {
      history.pushState({ ciLightbox: true }, '');
      pushed = true;
    } catch {
      pushed = false;
    }
    render();
    lbStage.resize();
    try { lbStage.el.focus({ preventScroll: true }); } catch { /* ignore */ }
  }
  function hideLightbox() {
    if (!state.lightbox) return;
    state.lightbox = false;
    lightbox.classList.remove('ci-show');
    body.style.overflow = prevOverflow;
    if (lastFocus && lastFocus.focus) {
      try { lastFocus.focus({ preventScroll: true }); } catch { /* ignore */ }
    }
    lastFocus = null;
    panelStage.resize();
  }
  function closeLightbox() {
    if (!state.lightbox) return;
    hideLightbox();
    if (pushed) {
      pushed = false;
      pendingBack++;
      try {
        history.back();
      } catch {
        pendingBack--;
      }
    }
  }
  lbClose.addEventListener('click', closeLightbox);
  window.addEventListener('popstate', function () {
    if (pendingBack > 0) {
      pendingBack--;
      return;
    }
    if (state.lightbox) {
      pushed = false;
      hideLightbox();
    }
  });

  // While the lightbox is open it owns the keyboard; the capture phase keeps the page from reacting.
  window.addEventListener('keydown', function (e) {
    if (!state.lightbox) return;
    var handled = true;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === 'ArrowRight') go(1);
    else handled = lbStage.handleKey(e);
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  // ---- Rendering ----
  function render() {
    var item = items[state.index];
    panelBar.update();
    lbBar.update();
    thumbs.forEach(function (t, i) {
      var current = i === state.index;
      if (current) t.setAttribute('aria-current', 'true');
      else t.removeAttribute('aria-current');
      t.classList.toggle('ci-current', current);
    });
    if (state.panel && panelShown !== state.index) {
      panelShown = state.index;
      panelStage.setImage(item.src);
    }
    if (state.lightbox && lightboxShown !== state.index) {
      lightboxShown = state.index;
      lbStage.setImage(item.src);
    }
  }

  body.appendChild(fab);
  body.appendChild(panel);
  body.appendChild(lightbox);
  render();
})();
