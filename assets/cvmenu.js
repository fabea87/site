(function () {
  "use strict";

  function isOpen(menu) {
    return menu.classList.contains("open");
  }

  function setOpen(menu, open) {
    menu.classList.toggle("open", open);
    var trig = menu.querySelector(".cv-trigger");
    if (trig) trig.setAttribute("aria-expanded", open ? "true" : "false");
  }

  document.addEventListener("DOMContentLoaded", function () {
    var menus = document.querySelectorAll(".cv-menu");
    if (!menus.length) return;

    menus.forEach(function (menu) {
      var trig = menu.querySelector(".cv-trigger");
      if (!trig) return;

      trig.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var wasOpen = isOpen(menu);
        menus.forEach(function (m) { setOpen(m, false); });
        setOpen(menu, !wasOpen);
      });

      menu.addEventListener("click", function (e) {
        if (e.target.closest(".cv-menu-item")) {
          setTimeout(function () {
            setOpen(menu, false);
          }, 120);
        }
      });
    });

    document.addEventListener("click", function (e) {
      if (!e.target.closest(".cv-menu")) {
        menus.forEach(function (m) {
          setOpen(m, false);
        });
      }
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        menus.forEach(function (m) {
          setOpen(m, false);
        });
      }
    });
  });
})();
