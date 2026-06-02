const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".nav");
const cookieBanner = document.querySelector("#cookie-banner");
const cookieButtons = document.querySelectorAll("[data-cookie-action]");
const revealTargets = document.querySelectorAll(
  ".hero-copy, .hero-visual, .section-intro, .step-card, .feature-card, .module-card, .cta-card, .footer-brand, .footer-links"
);

if (menuToggle && nav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });
}

const storedCookieChoice = localStorage.getItem("visiongrade-cookie-choice");
if (storedCookieChoice && cookieBanner) {
  cookieBanner.classList.add("is-hidden");
}

cookieButtons.forEach((button) => {
  button.addEventListener("click", () => {
    localStorage.setItem("visiongrade-cookie-choice", button.dataset.cookieAction || "dismissed");
    cookieBanner?.classList.add("is-hidden");
  });
});

revealTargets.forEach((target, index) => {
  target.classList.add("reveal");
  target.style.transitionDelay = `${Math.min(index * 40, 220)}ms`;
});

requestAnimationFrame(() => {
  revealTargets.forEach((target) => {
    target.classList.add("is-visible");
  });
});
