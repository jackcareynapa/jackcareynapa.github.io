(function () {
  'use strict';

  const navLinks = document.querySelectorAll('.nav-links a[data-nav]');
  const sections = [...navLinks]
    .map((link) => ({
      id: link.dataset.nav,
      el: document.getElementById(link.dataset.nav),
    }))
    .filter((item) => item.el);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function getHeaderOffset() {
    const header = document.querySelector('.site-header');
    return (header ? header.offsetHeight : 52) + 8;
  }

  function setActiveNav(id) {
    navLinks.forEach((link) => {
      const isActive = link.dataset.nav === id;
      link.classList.toggle('active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function updateScrollSpy() {
    const scrollY = window.scrollY + getHeaderOffset();
    let current = sections[0]?.id || 'home';

    for (const section of sections) {
      if (scrollY >= section.el.offsetTop) {
        current = section.id;
      }
    }

    // The last section is too short to reach the header line, so at the
    // foot of the page it is the one being read.
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    if (atBottom && sections.length) {
      current = sections[sections.length - 1].id;
    }

    setActiveNav(current);
  }

  function createTextEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    el.textContent = text;
    return el;
  }

  function isSafeUrl(url) {
    return typeof url === 'string' && url.startsWith('https://');
  }

  function createCourseRow(course, position) {
    const isDone = course.status === 'done';
    const statusLabel = isDone ? 'Completed' : 'In progress';

    const row = document.createElement('article');
    row.className = 'course-row';

    row.appendChild(createTextEl('p', 'course-code', course.id));

    // Where you are in the index. Decorative for a screen reader — the
    // list already conveys order — so it is hidden from the a11y tree.
    const no = createTextEl('p', 'course-no', String(position + 1).padStart(2, '0'));
    no.setAttribute('aria-hidden', 'true');
    row.appendChild(no);

    row.appendChild(createTextEl('h3', 'course-name', course.name));

    if (isSafeUrl(course.url)) {
      const link = document.createElement('a');
      link.className = 'course-link';
      link.href = course.url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Outline ↗';
      link.setAttribute('aria-label', `Course outline for ${course.name} (opens in a new tab)`);
      row.appendChild(link);
    } else {
      const note = createTextEl('span', 'course-link course-link-disabled', 'No outline');
      note.setAttribute('aria-disabled', 'true');
      row.appendChild(note);
    }

    // The lamp repeats the status word; the word carries the meaning.
    const meta = createTextEl('p', 'course-meta', `${course.institution} · `);
    const lamp = createTextEl('span', isDone ? 'status-lamp' : 'status-lamp is-wip', '');
    lamp.setAttribute('aria-hidden', 'true');
    meta.append(lamp, statusLabel);
    row.appendChild(meta);
    row.appendChild(createTextEl('p', 'course-desc', course.description));

    return row;
  }

  function showCourseMessage(index, className, text) {
    index.replaceChildren(createTextEl('p', className, text));
  }

  async function renderCourses() {
    const index = document.querySelector('.course-index');
    if (!index) return;

    index.setAttribute('aria-busy', 'true');
    showCourseMessage(index, 'course-loading', 'Loading courses…');

    try {
      const response = await fetch('courses.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const courses = await response.json();
      index.replaceChildren(...courses.map(createCourseRow));
      index.removeAttribute('aria-busy');
    } catch (err) {
      console.error('Failed to load courses:', err);
      showCourseMessage(index, 'course-error', 'Couldn’t load courses.');
      index.removeAttribute('aria-busy');
    }
  }

  // The planet settles from a rough screen onto its finished one the
  // first time it is on screen, then the observer lets go. Nothing else
  // on the page moves on scroll.
  function initHalftoneResolve() {
    const art = document.querySelector('.plate-art');
    if (!art) return;

    if (reducedMotion || !('IntersectionObserver' in window)) {
      art.classList.add('resolved');
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        art.classList.add('resolved');
        observer.disconnect();
      },
      { threshold: 0.4 }
    );
    observer.observe(art);
  }

  let scrollTicking = false;
  window.addEventListener('scroll', () => {
    if (!scrollTicking) {
      scrollTicking = true;
      requestAnimationFrame(() => {
        updateScrollSpy();
        scrollTicking = false;
      });
    }
  }, { passive: true });

  navLinks.forEach((link) => {
    link.addEventListener('click', () => setActiveNav(link.dataset.nav));
  });

  window.addEventListener('hashchange', () => {
    setActiveNav(location.hash.replace('#', '') || 'home');
  });

  async function init() {
    initHalftoneResolve();
    await renderCourses();
    updateScrollSpy();
  }

  init();
})();
