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
    return parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--header-h') || '56',
      10
    ) + 8;
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

  function createCourseCard(course, index) {
    const isDone = course.status === 'done';
    const statusClass = isDone ? 'done' : 'wip';
    const statusLabel = isDone ? '✓ Completed' : '↻ In Progress';

    const article = document.createElement('article');
    article.className = 'course-card surface-hover reveal-item lightning-card';
    if (!reducedMotion) {
      article.style.transitionDelay = `${0.04 + index * 0.03}s`;
    }

    article.appendChild(createTextEl('div', 'course-number', course.id));
    article.appendChild(createTextEl('h3', 'course-name', course.name));
    article.appendChild(createTextEl('div', 'course-inst', course.institution));
    article.appendChild(createTextEl('p', 'course-desc', course.description));

    const footer = document.createElement('div');
    footer.className = 'course-footer';

    const status = createTextEl('span', `status ${statusClass}`, statusLabel);
    footer.appendChild(status);

    if (isSafeUrl(course.url)) {
      const link = document.createElement('a');
      link.className = 'course-link';
      link.href = course.url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.textContent = 'Outline ↗';
      footer.appendChild(link);
    } else {
      const link = document.createElement('span');
      link.className = 'course-link course-link-disabled';
      link.setAttribute('aria-disabled', 'true');
      link.textContent = 'Outline unavailable';
      footer.appendChild(link);
    }

    article.appendChild(footer);
    return article;
  }

  function showCourseMessage(grid, className, text) {
    grid.replaceChildren(createTextEl('p', className, text));
  }

  async function renderCourses() {
    const grid = document.querySelector('.coursework-grid');
    if (!grid) return;

    grid.setAttribute('aria-busy', 'true');
    showCourseMessage(grid, 'course-loading', 'Loading courses…');

    try {
      const response = await fetch('courses.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const courses = await response.json();
      grid.replaceChildren(...courses.map(createCourseCard));
      grid.removeAttribute('aria-busy');
    } catch (err) {
      console.error('Failed to load courses:', err);
      showCourseMessage(grid, 'course-error', 'Couldn\u2019t load courses.');
      grid.removeAttribute('aria-busy');
    }
  }

  function initScrollReveal() {
    if (reducedMotion) {
      document.querySelectorAll('.reveal-section, .reveal-item').forEach((el) => {
        el.classList.add('visible');
      });
      return;
    }

    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            entry.target.querySelectorAll('.reveal-item').forEach((item) => {
              item.classList.add('visible');
            });
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    document.querySelectorAll('.reveal-section').forEach((section) => {
      if (section.id === 'home') {
        section.classList.add('visible');
        section.querySelectorAll('.reveal-item').forEach((item) => item.classList.add('visible'));
      } else {
        sectionObserver.observe(section);
      }
    });
  }

  let scrollTicking = false;
  window.addEventListener('scroll', () => {
    if (!scrollTicking) {
      scrollTicking = true;
      requestAnimationFrame(() => {
        updateScrollSpy();
        if (window.CubeFloor) {
          window.CubeFloor.onScroll();
        }
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

    if (window.CubeFloor) {
      window.CubeFloor.bindSurfacePulse();
      window.CubeFloor.refreshFootprints();
    }
  }

  init();
})();
