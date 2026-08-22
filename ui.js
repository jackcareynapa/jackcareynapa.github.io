(function () {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Running order ─────────────────────────────────────────────────── */

  const navLinks = document.querySelectorAll('.running-order a[data-nav]');
  const sections = [...navLinks]
    .map((link) => ({ id: link.dataset.nav, el: document.getElementById(link.dataset.nav) }))
    .filter((item) => item.el);

  /* Has to agree with scroll-padding-top, which is what actually decides where
     an anchor click lands. They disagreed by 8px, which was enough that every
     click on the running order left it one entry behind: clicking "education"
     landed at the top of Education with "work" still lit. Reading the computed
     value keeps the two from drifting apart again; the extra pixel absorbs
     subpixel rounding so the landing position counts as having arrived. */
  function getHeaderOffset() {
    const pad = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop);
    if (Number.isFinite(pad)) return pad + 1;
    return parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--mast-h') || '54',
      10
    ) + 16;
  }

  function atDocumentEnd() {
    const doc = document.documentElement;
    return window.scrollY + window.innerHeight >= doc.scrollHeight - 2;
  }

  function setActiveNav(id) {
    navLinks.forEach((link) => {
      const isActive = link.dataset.nav === id;
      link.classList.toggle('active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'true');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function updateScrollSpy() {
    // The closing section sits too near the foot of the page for its top edge
    // ever to travel up to the header line — there is nothing underneath it
    // left to scroll. Reaching the bottom of the document *is* arriving at it,
    // and without this the running order reads a section behind for the whole
    // last screenful.
    if (sections.length && atDocumentEnd()) {
      setActiveNav(sections[sections.length - 1].id);
      return;
    }

    const scrollY = window.scrollY + getHeaderOffset();
    // The opening has no entry in the running order, so nothing is marked
    // until the reader has actually reached the first act.
    let current = null;

    for (const section of sections) {
      if (scrollY >= section.el.offsetTop) {
        current = section.id;
      }
    }

    setActiveNav(current);
  }

  /* ── Registration drift ────────────────────────────────────────────────
     The hero's plates slide with the pointer. Everything else registers
     on :hover in CSS. */

  const opening = document.getElementById('top');
  let driftTicking = false;

  function applyDrift(e) {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    const x = (e.clientX / w - 0.5) * 2;   // -1 … 1
    const y = (e.clientY / h - 0.5) * 2;
    // em, not px, so the slip stays proportional to whatever it's printed at.
    opening.style.setProperty('--rx', (0.012 + x * 0.038).toFixed(4) + 'em');
    opening.style.setProperty('--ry', (0.012 + y * 0.028).toFixed(4) + 'em');
  }

  function initDrift() {
    if (reducedMotion || !opening) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    window.addEventListener('pointermove', (e) => {
      if (driftTicking) return;
      driftTicking = true;
      requestAnimationFrame(() => {
        applyDrift(e);
        driftTicking = false;
      });
    }, { passive: true });
  }

  /* ── Education index ────────────────────────────────────────────────── */

  function createTextEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    el.textContent = text;
    return el;
  }

  function isSafeUrl(url) {
    return typeof url === 'string' && url.startsWith('https://');
  }

  function createCourseRow(course) {
    const row = document.createElement('li');
    row.className = 'index-row occludes';

    const head = document.createElement('div');
    head.className = 'index-head';
    head.appendChild(createTextEl('span', 'index-code', course.id));

    // The syllabus link is the whole point of a course title, so the title
    // is the link when there is one — no separate "Outline ↗" affordance.
    if (isSafeUrl(course.url)) {
      const link = createTextEl('a', 'index-name', course.name);
      link.href = course.url;
      link.target = '_blank';
      link.rel = 'noopener';
      head.appendChild(link);
    } else {
      head.appendChild(createTextEl('span', 'index-name', course.name));
    }

    if (course.status === 'wip') {
      head.appendChild(createTextEl('span', 'index-wip', 'In progress'));
    }

    row.appendChild(head);

    if (course.description) {
      row.appendChild(createTextEl('p', 'index-desc', course.description));
    }

    return row;
  }

  function createGroup(institution, courses) {
    const group = document.createElement('div');
    group.className = 'index-group';
    group.appendChild(createTextEl('h3', 'index-school occludes', institution));

    const list = document.createElement('ul');
    list.className = 'index-list';
    list.append(...courses.map(createCourseRow));
    group.appendChild(list);

    return group;
  }

  function groupByInstitution(courses) {
    const groups = new Map();
    for (const course of courses) {
      const key = course.institution || 'Elsewhere';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(course);
    }
    return groups;
  }

  function showIndexMessage(root, className, text) {
    root.replaceChildren(createTextEl('p', className, text));
  }

  async function renderCourses() {
    const root = document.querySelector('.index');
    if (!root) return;

    root.setAttribute('aria-busy', 'true');
    showIndexMessage(root, 'index-note', 'Loading…');

    try {
      const response = await fetch('courses.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const courses = await response.json();
      const groups = groupByInstitution(courses);
      root.replaceChildren(
        ...[...groups].map(([institution, list]) => createGroup(institution, list))
      );
    } catch (err) {
      console.error('Failed to load courses:', err);
      showIndexMessage(root, 'index-note is-error', 'Couldn’t load courses.');
    } finally {
      root.removeAttribute('aria-busy');
    }
  }

  /* ── Wiring ────────────────────────────────────────────────────────── */

  let scrollTicking = false;
  window.addEventListener('scroll', () => {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      updateScrollSpy();
      if (window.CubeFloor) window.CubeFloor.onScroll();
      scrollTicking = false;
    });
  }, { passive: true });

  navLinks.forEach((link) => {
    link.addEventListener('click', () => setActiveNav(link.dataset.nav));
  });

  window.addEventListener('hashchange', () => {
    setActiveNav(location.hash.replace('#', '') || null);
  });

  async function init() {
    initDrift();
    await renderCourses();
    updateScrollSpy();

    // The index only exists after the fetch resolves, so the floor has to be
    // told where the new type sits before it can knock ink out from under it.
    if (window.CubeFloor) window.CubeFloor.refreshFootprints();
  }

  init();
})();
