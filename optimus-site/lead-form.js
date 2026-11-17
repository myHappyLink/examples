/* Отправка заявки в обработчик WordPress. Никаких ключей или адресов получателя в браузере. */
(() => {
  "use strict";
  window.DetailingLeadForm = {
    mount({ data, getContext = () => ({}) }) {
      const form = document.querySelector("#booking-form");
      if (!form || form.dataset.senderReady) return;
      form.dataset.senderReady = "true";
      const field = id => document.getElementById(id);
      const status = field("form-status");
      const submit = form.querySelector('[type="submit"]');
      const initialLabel = submit.innerHTML;
      let busy = false;
      let lastPayload = "";
      let requestId = "";
      const uuid = () => crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(20)), n => n.toString(16).padStart(2, "0")).join("");
      const showStatus = (state, message) => {
        form.dataset.submitState = state;
        status.hidden = false;
        status.dataset.state = state;
        status.textContent = message;
      };
      const resetStatus = () => {
        if (busy) return;
        form.dataset.submitState = "idle";
        status.hidden = true;
        submit.disabled = false;
        submit.innerHTML = initialLabel;
        field("client-phone").setCustomValidity("");
      };
      form.addEventListener("input", resetStatus);
      form.addEventListener("change", resetStatus);
      form.addEventListener("submit", async event => {
        event.preventDefault();
        if (busy || form.dataset.submitState === "success") return;
        const phone = field("client-phone");
        const phoneDigits = phone.value.replace(/\D/g, "");
        phone.setCustomValidity(phoneDigits.length >= 10 && phoneDigits.length <= 15 ? "" : "Укажите телефон с кодом города или оператора.");
        const car = field("car");
        car.setCustomValidity(car.value.trim() ? "" : "Укажите марку и модель автомобиля.");
        car.addEventListener("input", () => car.setCustomValidity(""), { once: true });
        if (!form.reportValidity()) return;
        const business = data.business || data;
        const service = data.services.find(item => item.id === field("booking-service").value);
        const context = getContext();
        const payload = {
          studio: business.name,
          studioId: data.id || "pixar",
          name: field("client-name").value.trim(),
          phone: phone.value.trim(),
          car: car.value.trim(),
          service: service ? `${service.title} · ${service.price}` : "Помогите подобрать услугу",
          branch: context.branch || business.address || "",
          scenario: context.scenario || "",
          zones: context.zones || [],
          notes: field("request-notes").value.trim(),
          consent: field("client-consent").checked,
          website: field("lead-website").value,
          page: location.protocol.startsWith("http") ? location.origin + location.pathname : ""
        };
        const signature = JSON.stringify(payload);
        if (signature !== lastPayload) { requestId = uuid(); lastPayload = signature; }
        payload.requestId = requestId;
        const controls = [...form.querySelectorAll("input,select,textarea,button")].map(node => [node, node.disabled]);
        controls.forEach(([node]) => { node.disabled = true; });
        busy = true;
        form.setAttribute("aria-busy", "true");
        showStatus("sending", "Отправляем заявку…");
        submit.textContent = "Отправляем…";
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);
        try {
          const endpoint = window.DETAILING_LEAD_FORM?.endpoint || data.form?.endpoint || "/wp-json/detailing/v1/leads";
          const target = new URL(endpoint, location.href);
          if (!/^https?:$/.test(target.protocol) || target.origin !== location.origin) throw new Error("unavailable");
          const response = await fetch(target, {
            method: "POST", credentials: "same-origin", signal: controller.signal,
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify(payload)
          });
          let result;
          try { result = await response.json(); } catch { throw new Error("unavailable"); }
          if (!response.ok || result?.success !== true) {
            if (response.status === 429) throw new Error("rate-limit");
            throw new Error("unavailable");
          }
          showStatus("success", "Заявка отправлена. Студия свяжется с вами, чтобы уточнить детали и время визита.");
          submit.textContent = "Заявка отправлена";
        } catch (error) {
          showStatus("error", error.message === "rate-limit"
            ? "Слишком много попыток. Попробуйте позже или позвоните в студию."
            : "Не удалось подтвердить отправку. Данные сохранены в форме — попробуйте ещё раз или свяжитесь со студией по телефону.");
          submit.innerHTML = initialLabel;
        } finally {
          clearTimeout(timeout);
          busy = false;
          form.removeAttribute("aria-busy");
          controls.forEach(([node, disabled]) => { node.disabled = disabled; });
          submit.disabled = form.dataset.submitState === "success";
          status.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      });
    }
  };
})();
