/* =========================================================
   Александр Чайников — архитектура
   Интерактив: шапка, меню, индекс, «план → дом», лайтбокс
   ========================================================= */
(function () {
  "use strict";

  var doc = document;
  var root = doc.documentElement;
  var $ = function (sel, ctx) { return (ctx || doc).querySelector(sel); };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel));
  };

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var header = $("#site-header");

  /* ================= ШАПКА ================= */
  var isSolid = false;
  function updateHeader() {
    if (!header) return;
    var next = window.scrollY > 40;
    if (next !== isSolid) {
      isSolid = next;
      header.classList.toggle("is-solid", isSolid);
    }
  }

  /* ================= «ПЛАН → ДОМ» ================= */
  var morphSection = $("#plan-morph");
  var morphFrame = $("#morph-frame");
  var morphStatic = true;

  function updateMorph() {
    if (!morphSection || !morphFrame || morphStatic) return;
    var rect = morphSection.getBoundingClientRect();
    var headH = header ? header.offsetHeight : 76;
    var stickyH = window.innerHeight - headH;
    var travel = rect.height - stickyH;
    if (travel <= 0) return;
    var progress = (headH - rect.top) / travel;
    progress = Math.max(0, Math.min(1, progress));
    morphFrame.style.setProperty("--morph", (progress * 100).toFixed(2) + "%");
  }

  function syncMorphMode() {
    if (!morphSection) return;
    var narrow = window.matchMedia("(max-width: 1024px)").matches;
    morphStatic = narrow || reduceMotion.matches;
    morphSection.classList.toggle("is-static", morphStatic);
    if (morphStatic) {
      morphFrame.style.removeProperty("--morph");
    } else {
      updateMorph();
    }
  }

  var ticking = false;
  function onScroll() {
    updateHeader();
    updateMorph();
  }
  function requestScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      ticking = false;
      onScroll();
    });
  }

  window.addEventListener("scroll", requestScroll, { passive: true });
  window.addEventListener("resize", function () {
    requestScroll();
    if (morphSection) syncMorphMode();
  }, { passive: true });
  if (reduceMotion.addEventListener) {
    reduceMotion.addEventListener("change", syncMorphMode);
  }

  updateHeader();
  if (morphSection) syncMorphMode();

  /* ================= МОБИЛЬНОЕ МЕНЮ ================= */
  var menuBtn = $(".menu-btn");
  var siteNav = $("#site-nav");
  var menuOpen = false;

  function setMenu(open, restoreFocus) {
    if (!menuBtn || !siteNav) return;
    menuOpen = open;
    doc.body.classList.toggle("nav-open", open);
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    menuBtn.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
    if (open) {
      var first = $("a", siteNav);
      if (first) {
        window.setTimeout(function () { first.focus(); }, 120);
      }
    } else if (restoreFocus) {
      menuBtn.focus();
    }
  }

  if (menuBtn) {
    menuBtn.addEventListener("click", function () { setMenu(!menuOpen, true); });
  }
  if (siteNav) {
    siteNav.addEventListener("click", function (event) {
      if (event.target.closest("a") && menuOpen) setMenu(false, false);
    });
  }

  /* ================= ПОЯВЛЕНИЕ ПРИ СКРОЛЛЕ ================= */
  var revealItems = $$("[data-reveal]");
  if (revealItems.length) {
    if ("IntersectionObserver" in window) {
      var revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });

      revealItems.forEach(function (item) { revealObserver.observe(item); });

      /* Страховка: если наблюдатель не сработал, показываем через 3 с */
      window.setTimeout(function () {
        revealItems.forEach(function (item) {
          if (!item.classList.contains("is-visible")) item.classList.add("is-visible");
        });
      }, 3000);
    } else {
      revealItems.forEach(function (item) { item.classList.add("is-visible"); });
    }
  }

  /* ================= АКТИВНЫЙ ПУНКТ ИНДЕКСА ================= */
  var chapters = $$(".chapter[id]");
  var indexLinks = $$(".idx-link");

  if (chapters.length && indexLinks.length && "IntersectionObserver" in window) {
    var linkByHash = {};
    indexLinks.forEach(function (link) {
      linkByHash[link.getAttribute("href")] = link;
    });

    var chapterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        indexLinks.forEach(function (link) { link.classList.remove("is-active"); });
        var active = linkByHash["#" + entry.target.id];
        if (active) {
          active.classList.add("is-active");
          active.setAttribute("aria-current", "true");
          var inner = active.parentNode;
          if (inner && inner.scrollWidth > inner.clientWidth) {
            var innerRect = inner.getBoundingClientRect();
            var linkRect = active.getBoundingClientRect();
            var delta = (linkRect.left - innerRect.left) - (inner.clientWidth - linkRect.width) / 2;
            inner.scrollTo({
              left: inner.scrollLeft + delta,
              behavior: reduceMotion.matches ? "auto" : "smooth"
            });
          }
        }
        indexLinks.forEach(function (link) {
          if (link !== active) link.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });

    chapters.forEach(function (chapter) { chapterObserver.observe(chapter); });
  }

  /* ================= ФИЛЬТР КАТАЛОГА ================= */
  var filterBar = $(".catalog-filter");
  if (filterBar) {
    var chips = $$("[data-filter]", filterBar);
    var cards = $$("#project-grid .project-card");
    var countEl = $("#catalog-count");

    var plural = function (n, forms) {
      var n10 = n % 10;
      var n100 = n % 100;
      if (n10 === 1 && n100 !== 11) return forms[0];
      if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
      return forms[2];
    };

    var applyFilter = function (filter) {
      var shown = 0;
      cards.forEach(function (card) {
        var match = filter === "all" || card.getAttribute("data-type") === filter;
        card.classList.toggle("is-hidden", !match);
        if (match) shown++;
      });
      chips.forEach(function (chip) {
        var active = chip.getAttribute("data-filter") === filter;
        chip.classList.toggle("is-active", active);
        chip.setAttribute("aria-pressed", active ? "true" : "false");
      });
      if (countEl) {
        countEl.textContent = shown + " " + plural(shown, ["проект", "проекта", "проектов"]);
      }
    };

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        applyFilter(chip.getAttribute("data-filter"));
      });
    });

    applyFilter("all");
  }

  /* ================= ЛАЙТБОКС ================= */
  var lb = $("#lightbox");
  var lbImage = $("#lbImage");
  var lbTitle = $("#lbTitle");
  var lbMeta = $("#lbMeta");
  var lbIndex = $("#lbIndex");
  var lbTotal = $("#lbTotal");
  var lbClose = lb ? $(".lb-close", lb) : null;
  var lbPrev = lb ? $("[data-lb-prev]", lb) : null;
  var lbNext = lb ? $("[data-lb-next]", lb) : null;

  var slides = [];
  var slideIndex = 0;
  var lastFocused = null;
  var lbOpen = false;

  function renderSlide() {
    if (!lbImage || !slides.length) return;
    var title = lbTitle ? lbTitle.textContent : "Проект";
    lbImage.classList.remove("is-loaded");
    lbImage.src = slides[slideIndex];
    lbImage.alt = title + " — изображение " + (slideIndex + 1) + " из " + slides.length;
    if (lbIndex) lbIndex.textContent = String(slideIndex + 1);
    if (lbTotal) lbTotal.textContent = String(slides.length);

    var single = slides.length < 2;
    if (lbPrev) {
      lbPrev.disabled = single;
      lbPrev.style.display = single ? "none" : "";
    }
    if (lbNext) {
      lbNext.disabled = single;
      lbNext.style.display = single ? "none" : "";
    }
  }

  function stepSlide(dir) {
    if (slides.length < 2) return;
    slideIndex = (slideIndex + dir + slides.length) % slides.length;
    renderSlide();
  }

  function withTransition(fn) {
    if (reduceMotion.matches || typeof doc.startViewTransition !== "function") {
      fn();
      return;
    }
    try {
      doc.startViewTransition(fn);
    } catch (err) {
      fn();
    }
  }

  function openLightbox(trigger) {
    if (!lb || !lbImage) return;
    var source = trigger.getAttribute("data-images") || "";
    slides = source.split("|").map(function (s) { return s.trim(); }).filter(Boolean);
    if (!slides.length) return;

    var start = parseInt(trigger.getAttribute("data-start"), 10);
    slideIndex = isNaN(start) ? 0 : Math.max(0, Math.min(slides.length - 1, start));
    if (lbTitle) lbTitle.textContent = trigger.getAttribute("data-title") || "Проект";
    if (lbMeta) lbMeta.textContent = trigger.getAttribute("data-meta") || "";

    lastFocused = doc.activeElement;
    renderSlide();

    lbOpen = true;
    withTransition(function () {
      lb.hidden = false;
      doc.body.classList.add("lb-open");
      if (lbClose) lbClose.focus();
    });
  }

  function closeLightbox() {
    if (!lb || !lbOpen) return;
    lbOpen = false;
    withTransition(function () {
      lb.hidden = true;
      doc.body.classList.remove("lb-open");
      if (lastFocused && typeof lastFocused.focus === "function") {
        lastFocused.focus();
      }
    });
  }

  doc.addEventListener("click", function (event) {
    var trigger = event.target.closest("[data-images]");
    if (trigger) {
      event.preventDefault();
      openLightbox(trigger);
    }
  });

  if (lb) {
    $$("[data-lb-close]", lb).forEach(function (el) {
      el.addEventListener("click", closeLightbox);
    });
    if (lbPrev) lbPrev.addEventListener("click", function () { stepSlide(-1); });
    if (lbNext) lbNext.addEventListener("click", function () { stepSlide(1); });

    /* Свайпы */
    var swipeX = null;
    lb.addEventListener("pointerdown", function (event) {
      swipeX = event.clientX;
    }, { passive: true });
    lb.addEventListener("pointerup", function (event) {
      if (swipeX === null) return;
      var delta = event.clientX - swipeX;
      swipeX = null;
      if (Math.abs(delta) > 48) stepSlide(delta > 0 ? -1 : 1);
    }, { passive: true });

    /* Возврат фокуса внутрь диалога */
    lb.addEventListener("keydown", function (event) {
      if (event.key !== "Tab") return;
      var focusable = [lbClose, lbPrev, lbNext].filter(function (el) {
        return el && el.style.display !== "none" && !el.disabled;
      });
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && doc.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && doc.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });
  }

  if (lbImage) {
    lbImage.addEventListener("load", function () {
      lbImage.classList.add("is-loaded");
    });
  }

  /* ================= КЛАВИАТУРА ================= */
  doc.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      if (lbOpen) {
        closeLightbox();
      } else if (menuOpen) {
        setMenu(false, true);
      }
      return;
    }
    if (!lbOpen) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      stepSlide(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      stepSlide(1);
    }
  });

  /* ================= ГОД В ПОДВАЛЕ ================= */
  var year = $("#year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
