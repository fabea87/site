(function () {
  "use strict";

  var filterBar = document.getElementById("pub-filter");
  if (!filterBar) return;

  var cards = Array.prototype.slice.call(
    document.querySelectorAll("#publications .pub-card")
  );
  var labels = Array.prototype.slice.call(
    document.querySelectorAll("#publications .year-label")
  );
  if (!cards.length) return;

  /* ---------- 筛选 ---------- */
  filterBar.addEventListener("click", function (e) {
    var btn = e.target.closest(".filter-pill");
    if (!btn || btn.id === "bib-download") return;
    var f = btn.getAttribute("data-filter");

    filterBar
      .querySelectorAll(".filter-pill")
      .forEach(function (p) {
        p.classList.toggle("active", p === btn);
      });

    cards.forEach(function (card) {
      var show;
      if (f === "all") {
        show = true;
      } else if (f === "featured") {
        show = card.getAttribute("data-featured") === "true";
      } else {
        show = card.getAttribute("data-year") === f;
      }
      card.classList.toggle("is-hidden", !show);
    });

    labels.forEach(function (label) {
      var y = label.getAttribute("data-year");
      var visible = cards.some(function (c) {
        return (
          c.getAttribute("data-year") === y && !c.classList.contains("is-hidden")
        );
      });
      label.classList.toggle("is-hidden", !visible);
    });
  });

  /* ---------- 下载全部 BibTeX ---------- */
  var downloadBtn = document.getElementById("bib-download");
  if (downloadBtn) {
    downloadBtn.addEventListener("click", function () {
      var parts = [];
      document.querySelectorAll("#publications .bib code").forEach(function (c) {
        parts.push(c.textContent);
      });
      if (!parts.length) return;
      var blob = new Blob([parts.join("\n\n")], {
        type: "text/plain;charset=utf-8",
      });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "publications.bib";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 500);
    });
  }
})();
