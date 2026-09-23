(function () {
  'use strict';

  function createTextEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    el.textContent = text;
    return el;
  }

  function isSafeUrl(url) {
    return typeof url === 'string' && url.startsWith('https://');
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function createCourse(course, position) {
    const isDone = course.status === 'done';

    const card = document.createElement('article');
    card.className = 'course';

    // Running number and code tag. The number is where you are in the
    // list, which a screen reader already knows, so it is hidden.
    const top = document.createElement('p');
    top.className = 'course-top';
    const no = createTextEl('span', 'course-no', pad(position + 1));
    no.setAttribute('aria-hidden', 'true');
    top.append(no, createTextEl('span', 'course-code', course.id));
    card.appendChild(top);

    card.appendChild(createTextEl('h3', 'course-name', course.name));

    // The box repeats the status word; the word carries the meaning.
    const meta = createTextEl('p', 'course-meta', '');
    const box = createTextEl('i', isDone ? 'box box-on' : 'box', '');
    box.setAttribute('aria-hidden', 'true');
    meta.append(`${course.institution} · `, box, isDone ? 'Completed' : 'In progress');
    card.appendChild(meta);

    card.appendChild(createTextEl('p', 'course-desc', course.description));

    if (isSafeUrl(course.url)) {
      const link = document.createElement('a');
      link.className = 'link course-link';
      link.href = course.url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.setAttribute('aria-label', `Course outline for ${course.name} (opens in a new tab)`);
      const arrow = createTextEl('span', 'arrow', '→');
      arrow.setAttribute('aria-hidden', 'true');
      link.append('Outline ', arrow);
      card.appendChild(link);
    } else {
      const note = createTextEl('span', 'link course-link course-link-disabled', 'No outline');
      note.setAttribute('aria-disabled', 'true');
      card.appendChild(note);
    }

    return card;
  }

  function showCourseMessage(grid, className, text) {
    grid.replaceChildren(createTextEl('p', className, text));
  }

  async function renderCourses() {
    const grid = document.querySelector('.course-grid');
    if (!grid) return;

    grid.setAttribute('aria-busy', 'true');
    showCourseMessage(grid, 'course-loading', 'Loading courses…');

    try {
      const response = await fetch('courses.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const courses = await response.json();
      grid.replaceChildren(...courses.map(createCourse));

      const count = document.querySelector('[data-count]');
      if (count) count.textContent = `/ 01—${pad(courses.length)}`;
    } catch (err) {
      console.error('Failed to load courses:', err);
      showCourseMessage(grid, 'course-error', 'Couldn’t load courses.');
    } finally {
      grid.removeAttribute('aria-busy');
    }
  }

  renderCourses();
})();
