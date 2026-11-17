/* Обычный JavaScript. Данные бизнеса находятся в site-data.js. */
(() => {
  "use strict";
  const data = window.SITE_DATA || {};
  const business = data.business || {};
  const services = Array.isArray(data.services) ? data.services : [];
  const categories = Array.isArray(data.categories) ? data.categories : [];
  const photos = Array.isArray(data.photos) ? data.photos : [];
  const $ = (selector) => document.querySelector(selector);
  const all = (selector) => [...document.querySelectorAll(selector)];
  const text = (selector, value) => { const node = $(selector); if (node) node.textContent = value || ""; };
  const arrow = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg>';
  const pad = (number) => String(number).padStart(2, "0");
  const shortName = business.shortName || (business.name || "").replace(/\s+Detailing/i, "");

  all("[data-site]").forEach((node) => {
    const key = node.dataset.site;
    node.textContent = key === "shortName" ? shortName : (business[key] || "");
  });
  all("[data-link]").forEach((node) => {
    const key = node.dataset.link;
    const value = business[key] || data[key];
    if (value) node.href = value;
    else { node.removeAttribute("href"); node.hidden = true; }
  });
  const galleryGrid = $(".work-gallery");
  if (galleryGrid && Array.isArray(data.galleryIndices)) {
    galleryGrid.replaceChildren();
    const indices = data.galleryIndices.map(Number).filter(index => photos[index]);
    galleryGrid.classList.toggle("is-expanded", indices.length > 2);
    indices.forEach((photoIndex, order) => {
      const photo = photos[photoIndex];
      const card = document.createElement("button");
      card.type = "button";
      card.className = `work-photo work-photo-${order}`;
      card.dataset.gallery = String(photoIndex);
      card.setAttribute("aria-label", `Увеличить: ${photo.alt || "фотография студии"}`);
      card.innerHTML = '<img loading="lazy" decoding="async"><span class="work-photo-overlay"></span><span class="photo-caption"><span class="photo-label"></span><span class="photo-expand">' + arrow + '</span></span>';
      const image = card.querySelector("img");
      image.dataset.image = String(photoIndex);
      card.querySelector(".photo-label").textContent = photo.caption || `${shortName} / ${business.city || ""}`;
      galleryGrid.append(card);
    });
  }
  all("[data-image]").forEach((node) => {
    const photo = photos[Number(node.dataset.image)];
    if (photo) {
      node.src = photo.src;
      node.alt = photo.alt || "";
      if (photo.position) node.style.setProperty("--photo-position", photo.position);
      if (photo.mobilePosition) node.style.setProperty("--photo-position-mobile", photo.mobilePosition);
    }
  });
  all("[data-value]").forEach((node) => {
    const value = node.dataset.value === "priceDate" ? data.priceSource?.dateLabel : data[node.dataset.value];
    node.textContent = value == null ? "" : String(value);
  });
  text("#copyright-year", new Date().getFullYear());

  const header = $("#site-header");
  const menuToggle = $("#menu-toggle");
  const nav = $("#site-nav");
  function toggleMenu(open) {
    nav?.classList.toggle("is-open", open);
    document.body.classList.toggle("menu-open", open);
    menuToggle?.setAttribute("aria-expanded", String(open));
    menuToggle?.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
  }
  menuToggle?.addEventListener("click", () => toggleMenu(menuToggle.getAttribute("aria-expanded") !== "true"));
  nav?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => toggleMenu(false)));
  const updateHeader = () => header?.classList.toggle("is-scrolled", window.scrollY > 25);
  window.addEventListener("scroll", updateHeader, { passive: true });
  updateHeader();

  const booking = $("#booking-dialog");
  const serviceSelect = $("#booking-service");
  if (serviceSelect) {
    serviceSelect.replaceChildren(new Option("Помогите подобрать услугу", ""));
    services.forEach((service) => serviceSelect.add(new Option(`${service.title} · ${service.price}`, service.id)));
  }
  function openBooking(id = "") {
    toggleMenu(false);
    if (serviceSelect) {
      const previous = serviceSelect.value;
      serviceSelect.value = services.some((service) => service.id === id) ? id : "";
      if (previous !== serviceSelect.value) serviceSelect.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (booking && !booking.open) booking.showModal();
  }
  all("[data-book]").forEach((button) => button.addEventListener("click", () => openBooking(button.dataset.book)));
  all("[data-close]").forEach((button) => button.addEventListener("click", () => button.closest("dialog")?.close()));
  all("dialog").forEach((dialog) => dialog.addEventListener("click", (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  }));
  window.DetailingLeadForm.mount({ data });

  const tablist = $("#service-tabs");
  let activeCategory = categories.find((item) => item.id === "protection")?.id || categories[0]?.id;
  function renderServices(categoryId, focus = false) {
    activeCategory = categoryId;
    const category = categories.find((item) => item.id === categoryId);
    if (!category) return;
    tablist?.querySelectorAll("button").forEach((button) => {
      const active = button.dataset.category === categoryId;
      button.classList.toggle("active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
      if (active && focus) button.focus();
    });
    $("#service-panel")?.setAttribute("aria-labelledby", `tab-${categoryId}`);
    text("#service-visual-tag", category.tag);
    text("#service-visual-title", category.title);
    text("#service-visual-text", category.text);
    const list = $("#service-list");
    if (list) {
      list.replaceChildren();
      services.filter((service) => service.category === categoryId).forEach((service, index) => {
        const row = document.createElement("button");
        row.className = "service-row";
        row.type = "button";
        row.innerHTML = `<span class="service-index">${pad(index + 1)}</span><span class="service-information"><span class="service-title"></span><span class="service-description"></span></span><span class="service-price"></span><span class="service-arrow">${arrow}</span>`;
        row.querySelector(".service-title").textContent = service.title;
        row.querySelector(".service-description").textContent = service.description;
        row.querySelector(".service-price").textContent = service.price;
        row.setAttribute("aria-label", `${service.title}, ${service.price}. Обсудить услугу`);
        row.addEventListener("click", () => openBooking(service.id));
        list.append(row);
      });
    }
    const source = $("#price-source");
    if (source && data.priceSource?.url) source.href = categoryId === "care" ? data.priceSource.url.replace("/tab/prices", "/tab/info") : data.priceSource.url;
  }
  if (tablist) {
    tablist.replaceChildren();
    categories.forEach((category) => {
      const button = document.createElement("button");
      button.className = "service-tab";
      button.type = "button";
      button.id = `tab-${category.id}`;
      button.dataset.category = category.id;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-controls", "service-panel");
      button.textContent = category.label;
      const count = document.createElement("span");
      count.textContent = pad(services.filter((service) => service.category === category.id).length);
      button.append(count);
      button.addEventListener("click", () => renderServices(category.id));
      tablist.append(button);
    });
    tablist.addEventListener("keydown", (event) => {
      if (!categories.length) return;
      const index = categories.findIndex((item) => item.id === activeCategory);
      let next;
      if (event.key === "ArrowRight") next = (index + 1) % categories.length;
      if (event.key === "ArrowLeft") next = (index - 1 + categories.length) % categories.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = categories.length - 1;
      if (next != null) { event.preventDefault(); renderServices(categories[next].id, true); }
    });
    renderServices(activeCategory);
  }

  const gallery = $("#gallery-dialog");
  let photoIndex = 0;
  function renderPhoto(index) {
    if (!photos.length) return;
    photoIndex = (index + photos.length) % photos.length;
    const photo = photos[photoIndex];
    const image = $("#gallery-image");
    if (image) { image.src = photo.src; image.alt = photo.alt || ""; }
    text("#gallery-counter", `${pad(photoIndex + 1)} / ${pad(photos.length)}`);
  }
  all("[data-gallery]").forEach((button) => button.addEventListener("click", () => {
    if (!photos.length || !gallery) return;
    renderPhoto(Number(button.dataset.gallery) || 0);
    if (!gallery.open) gallery.showModal();
  }));
  $("[data-open-gallery]")?.addEventListener("click", () => {
    if (!photos.length || !gallery) return;
    renderPhoto(data.galleryIndices?.[0] || 0);
    if (!gallery.open) gallery.showModal();
  });
  $("#gallery-prev")?.addEventListener("click", () => renderPhoto(photoIndex - 1));
  $("#gallery-next")?.addEventListener("click", () => renderPhoto(photoIndex + 1));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") toggleMenu(false);
    if (gallery?.open && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      renderPhoto(photoIndex + (event.key === "ArrowRight" ? 1 : -1));
    }
  });
  const map = $("#map-embed");
  if (map && business.mapEmbedUrl) map.src = business.mapEmbedUrl;
  const route = $("#route-link");
  if (route && (business.routeUrl || business.mapUrl)) route.href = business.routeUrl || business.mapUrl;
})();
