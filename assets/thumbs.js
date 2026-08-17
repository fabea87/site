(function () {
  var preview = null;
  var hideTimer = null;

  function getPreview() {
    if (!preview) {
      preview = document.createElement("div");
      preview.className = "thumb-preview";
      preview.hidden = true;
      preview.innerHTML = '<img alt="Paper preview">';
      document.body.appendChild(preview);
      preview.addEventListener("pointerenter", clearHide);
      preview.addEventListener("pointerleave", scheduleHide);
    }
    return preview;
  }

  function show(thumb) {
    var src = thumb.querySelector("img");
    if (!src) return;
    var p = getPreview();
    p.querySelector("img").src = src.src;
    p.hidden = false;

    var r = thumb.getBoundingClientRect();
    var w = p.offsetWidth;
    var gap = 14;
    var left = r.right + gap;
    if (left + w > window.innerWidth - 8) {
      left = r.left - gap - w;
      if (left < 8) left = Math.max(8, window.innerWidth - w - 8);
    }
    var top = r.top;
    if (top + p.offsetHeight > window.innerHeight - 8) {
      top = Math.max(8, window.innerHeight - p.offsetHeight - 8);
    }
    p.style.left = left + "px";
    p.style.top = top + "px";
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(function () {
      if (preview) preview.hidden = true;
    }, 160);
  }

  function clearHide() {
    clearTimeout(hideTimer);
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (window.matchMedia && window.matchMedia("(hover: none)").matches) return;
    document.querySelectorAll(".pub-thumb").forEach(function (t) {
      t.addEventListener("pointerenter", function () {
        clearHide();
        show(t);
      });
      t.addEventListener("pointerleave", scheduleHide);
    });
    document.addEventListener("scroll", scheduleHide, true);
  });
})();
