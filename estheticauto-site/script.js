/* Меню, услуги, галерея и подключение отправки заявки. */
(() => {
  "use strict";
  const data = window.SITE_DATA;
  if (!data) return;
  const $ = selector => document.querySelector(selector);
  const all = selector => [...document.querySelectorAll(selector)];
  const dialog = $("#booking-dialog");
  const galleryDialog = $("#gallery-dialog");
  const branches = data.branches || [];
  let selectedBranch = 0;
  let chosenScenario = "";
  const chosenZones = new Set();
  const setMenu = open => {
    $("#site-nav")?.classList.toggle("is-open", open);
    $("#menu-toggle")?.setAttribute("aria-expanded", String(open));
    $("#menu-toggle")?.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
    document.body.classList.toggle("menu-open", open);
  };
  $("#menu-toggle")?.addEventListener("click", () => setMenu($("#menu-toggle").getAttribute("aria-expanded") !== "true"));
  all("#site-nav a").forEach(link => link.addEventListener("click", () => setMenu(false)));
  const updateHeader = () => $("#site-header")?.classList.toggle("is-scrolled", window.scrollY > 25);
  window.addEventListener("scroll", updateHeader, { passive: true });
  updateHeader();
  function updateBranch(index) {
    selectedBranch = Number(index) || 0;
    const branch = branches[selectedBranch] || branches[0];
    if (!branch) return;
    all("[data-branch-select]").forEach(select => { select.value = String(selectedBranch); });
    all("[data-choose-branch]").forEach(button => button.closest(".branch-card")?.classList.toggle("selected", Number(button.dataset.chooseBranch) === selectedBranch));
    all("[data-current-address]").forEach(node => { node.textContent = branch.address; });
    all("[data-current-phone]").forEach(node => { node.textContent = branch.phoneLabel; node.href = branch.phoneHref; });
    all("[data-current-hours]").forEach(node => { node.textContent = branch.hours; });
    all("[data-current-note]").forEach(node => { node.textContent = branch.note || "Уточните детали визита перед записью."; });
    const map = $("#contact-map");
    if (map && branch.mapEmbed && map.src !== branch.mapEmbed) map.src = branch.mapEmbed;
    const route = $("#contact-route");
    if (route) route.href = branch.route;
    const whatsapp = $("#contact-whatsapp");
    if (whatsapp) { whatsapp.hidden = !branch.whatsapp; if (branch.whatsapp) whatsapp.href = branch.whatsapp; }
  }
  all("[data-branch-select]").forEach(select => select.addEventListener("change", () => updateBranch(select.value)));
  all("[data-choose-branch]").forEach(button => button.addEventListener("click", () => { updateBranch(button.dataset.chooseBranch); openBooking(); }));
  function openBooking(serviceId = "") {
    setMenu(false);
    const select = $("#booking-service");
    if (select) {
      const previous = select.value;
      select.value = data.services.some(service => service.id === serviceId) ? serviceId : "";
      if (previous !== select.value) select.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (chosenScenario && $("#request-notes") && !$("#request-notes").value.trim()) $("#request-notes").value = chosenScenario;
    if (dialog && !dialog.open) dialog.showModal();
  }
  all("[data-book]").forEach(button => button.addEventListener("click", () => openBooking(button.dataset.book)));
  all("[data-close]").forEach(button => button.addEventListener("click", () => button.closest("dialog")?.close()));
  all("dialog").forEach(node => node.addEventListener("click", event => {
    if (event.target !== node) return;
    const rect = node.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) node.close();
  }));
  all("[data-filter]").forEach(button => button.addEventListener("click", () => {
    const category = button.dataset.filter;
    all("[data-filter]").forEach(item => item.classList.toggle("active", item === button));
    all(".service-row").forEach(row => { row.hidden = category !== "all" && row.dataset.category !== category; });
  }));
  all("[data-scenario]").forEach(button => button.addEventListener("click", () => {
    chosenScenario = button.dataset.scenario;
    all("[data-scenario]").forEach(item => { const active = item === button; item.classList.toggle("selected", active); item.setAttribute("aria-pressed", String(active)); });
    const summary = $("#scenario-summary");
    if (summary) summary.textContent = "Ваш запрос: " + chosenScenario;
  }));
  const toggleZone = id => {
    chosenZones.has(id) ? chosenZones.delete(id) : chosenZones.add(id);
    all("[data-zone]").forEach(button => { const active = chosenZones.has(button.dataset.zone); button.classList.toggle("active", active); button.setAttribute("aria-pressed", String(active)); });
    all("[data-zone-shape]").forEach(shape => shape.classList.toggle("active", chosenZones.has(shape.dataset.zoneShape)));
    const names = [...chosenZones].map(id => data.zones.find(zone => zone.id === id)?.label).filter(Boolean);
    const summary = $("#zone-summary");
    if (summary) summary.textContent = names.length ? "Выбрано: " + names.join(", ") : "Выберите интересующие зоны на кнопках выше.";
  };
  all("[data-zone]").forEach(button => button.addEventListener("click", () => toggleZone(button.dataset.zone)));
  $("#compare-range")?.addEventListener("input", event => $("#compare").style.setProperty("--split", event.target.value + "%"));
  window.DetailingLeadForm.mount({ data, getContext: () => ({
    branch: (branches[selectedBranch] || branches[0])?.address || "",
    scenario: chosenScenario,
    zones: [...chosenZones].map(id => data.zones?.find(zone => zone.id === id)?.label).filter(Boolean)
  }) });
  let photoIndex = 0;
  function showPhoto(index) {
    photoIndex = (index + data.gallery.length) % data.gallery.length;
    const photo = data.gallery[photoIndex];
    $("#gallery-image").src = photo.src;
    $("#gallery-image").alt = photo.alt;
    $("#gallery-counter").textContent = `${String(photoIndex + 1).padStart(2, "0")} / ${String(data.gallery.length).padStart(2, "0")}`;
  }
  all("[data-gallery]").forEach(button => button.addEventListener("click", () => { showPhoto(Number(button.dataset.gallery)); if (!galleryDialog.open) galleryDialog.showModal(); }));
  $("#gallery-prev")?.addEventListener("click", () => showPhoto(photoIndex - 1));
  $("#gallery-next")?.addEventListener("click", () => showPhoto(photoIndex + 1));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") setMenu(false);
    if (galleryDialog?.open && ["ArrowLeft", "ArrowRight"].includes(event.key)) { event.preventDefault(); showPhoto(photoIndex + (event.key === "ArrowRight" ? 1 : -1)); }
  });
  updateBranch(0);
})();
