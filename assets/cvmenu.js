(function () {
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

    var fine = !!(window.matchMedia && window.matchMedia("(pointer: fine)").matches);
    var hoverOK = !!(window.matchMedia && window.matchMedia("(hover: hover)").matches) && fine;

    menus.forEach(function (menu) {
      var trig = menu.querySelector(".cv-trigger");
      if (!trig) return;

      if (!hoverOK) {
        trig.addEventListener("click", function (e) {
          e.preventDefault();
          setOpen(menu, !isOpen(menu));
        });
      } else {
        trig.addEventListener("click", function (e) {
          e.preventDefault();
        });
      }

      menu.addEventListener("click", function (e) {
        if (e.target.closest(".cv-menu-item")) {
          setTimeout(function () {
            setOpen(menu, false);
          }, 120);
        }
      });
    });

    if (!hoverOK) {
      document.addEventListener("click", function (e) {
        if (!e.target.closest(".cv-menu")) {
          menus.forEach(function (m) {
            setOpen(m, false);
          });
        }
      });
    }
  });
})();
