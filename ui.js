(function () {
  'use strict';

  // Arm the reveal styles. Without JS the content stays visible in CSS.
  document.documentElement.classList.add('js');

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

  function createCourseRow(course) {
    const isDone = course.status === 'done';
    const statusLabel = isDone ? 'Completed' : 'In progress';

    const row = document.createElement('article');
    row.className = 'course-row reveal-item';

    row.appendChild(createTextEl('p', 'course-code', course.id));
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

    row.appendChild(
      createTextEl('p', 'course-meta', `${course.institution} · ${statusLabel}`)
    );
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

  function revealAll() {
    document.querySelectorAll('.reveal-section, .reveal-item').forEach((el) => {
      el.classList.add('visible');
    });
  }

  function initScrollReveal() {
    if (reducedMotion || !('IntersectionObserver' in window)) {
      revealAll();
      return;
    }

    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('visible');
          entry.target.querySelectorAll('.reveal-item').forEach((item) => {
            item.classList.add('visible');
          });
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );

    document.querySelectorAll('.reveal-section').forEach((section) => {
      if (section.id === 'home') {
        section.classList.add('visible');
        section.querySelectorAll('.reveal-item').forEach((item) => item.classList.add('visible'));
      } else {
        observer.observe(section);
      }
    });
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
    await renderCourses();
    initScrollReveal();
    updateScrollSpy();
  }

  init();
})();
