'use strict';

// 네이티브 button 요소의 클릭, Enter, Space 동작을 그대로 사용합니다.
const toggle = document.querySelector('#evidence-toggle');
const details = document.querySelector('#more-evidence');
const label = toggle?.querySelector('.toggle-label');
const icon = toggle?.querySelector('.toggle-icon');

if (toggle && details && label && icon) {
  toggle.addEventListener('click', () => {
    const willOpen = toggle.getAttribute('aria-expanded') !== 'true';
    details.hidden = !willOpen;
    toggle.setAttribute('aria-expanded', String(willOpen));
    label.textContent = willOpen ? '학습 목표 접기' : '학습 목표 자세히 보기';
    icon.textContent = willOpen ? '−' : '＋';
  });
}
