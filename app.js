const accessKeyInput = document.querySelector("#accessKey");
const connectBtn = document.querySelector("#connectBtn");
const contactForm = document.querySelector("#contactForm");
const nameInput = document.querySelector("#name");
const phoneInput = document.querySelector("#phone");
const addressInput = document.querySelector("#address");
const formTitle = document.querySelector("#formTitle");
const cancelEditBtn = document.querySelector("#cancelEditBtn");
const searchInput = document.querySelector("#search");
const contactsList = document.querySelector("#contactsList");
const statusText = document.querySelector("#status");

const phonePattern = /^[0-9+()\s-]{6,20}$/;

let contacts = [];
let editingId = null;

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.classList.toggle("error", isError);
}

function getAccessKey() {
  return accessKeyInput.value.trim();
}

function saveAccessKey() {
  const key = getAccessKey();
  sessionStorage.setItem("accessKey", key);
}

async function apiRequest(path, options = {}) {
  const key = getAccessKey();
  if (!key) {
    throw new Error("Ingresa la clave compartida.");
  }

  const headers = {
    "x-access-key": key,
    ...options.headers,
  };

  if (options.body) {
    headers["content-type"] = "application/json";
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.error || "No se pudo completar la operacion.");
  }

  return data;
}

function clearForm() {
  contactForm.reset();
  editingId = null;
  formTitle.textContent = "Nuevo contacto";
  cancelEditBtn.classList.add("hidden");
}

function setEditing(contact) {
  editingId = contact.id;
  nameInput.value = contact.name;
  phoneInput.value = contact.phone;
  addressInput.value = contact.address;
  formTitle.textContent = "Editar contacto";
  cancelEditBtn.classList.remove("hidden");
  nameInput.focus();
}

function getFilteredContacts() {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) {
    return contacts;
  }

  return contacts.filter((contact) => {
    return (
      contact.name.toLowerCase().includes(query) ||
      contact.phone.toLowerCase().includes(query) ||
      contact.address.toLowerCase().includes(query)
    );
  });
}

function renderContacts() {
  contactsList.textContent = "";

  const filtered = getFilteredContacts();
  if (filtered.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No hay contactos para mostrar.";
    contactsList.appendChild(empty);
    return;
  }

  for (const contact of filtered) {
    const item = document.createElement("li");
    item.className = "item";

    const text = document.createElement("p");
    text.className = "contact-text";
    text.textContent = `${contact.name} | ${contact.phone} | ${contact.address}`;

    const actions = document.createElement("div");
    actions.className = "row";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "secondary";
    editBtn.textContent = "Editar";
    editBtn.addEventListener("click", () => setEditing(contact));

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "danger";
    deleteBtn.textContent = "Eliminar";
    deleteBtn.addEventListener("click", async () => {
      const accepted = window.confirm("¿Eliminar este contacto?");
      if (!accepted) {
        return;
      }

      try {
        await apiRequest(`/api/contacts?id=${encodeURIComponent(contact.id)}`, {
          method: "DELETE",
        });
        contacts = contacts.filter((entry) => entry.id !== contact.id);
        renderContacts();
        setStatus("Contacto eliminado.");
      } catch (error) {
        setStatus(error.message, true);
      }
    });

    actions.append(editBtn, deleteBtn);
    item.append(text, actions);
    contactsList.appendChild(item);
  }
}

function getPayload() {
  const payload = {
    name: nameInput.value.trim(),
    phone: phoneInput.value.trim(),
    address: addressInput.value.trim(),
  };

  if (!payload.name || !payload.address) {
    throw new Error("Nombre y direccion son obligatorios.");
  }

  if (!phonePattern.test(payload.phone)) {
    throw new Error("El telefono no tiene un formato valido.");
  }

  return payload;
}

async function loadContacts() {
  setStatus("Cargando contactos...");
  try {
    const data = await apiRequest("/api/contacts");
    contacts = Array.isArray(data.contacts) ? data.contacts : [];
    renderContacts();
    setStatus("Contactos actualizados.");
  } catch (error) {
    setStatus(error.message, true);
  }
}

connectBtn.addEventListener("click", async () => {
  saveAccessKey();
  await loadContacts();
});

contactForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  let payload;
  try {
    payload = getPayload();
  } catch (error) {
    setStatus(error.message, true);
    return;
  }

  try {
    if (editingId) {
      await apiRequest(`/api/contacts?id=${encodeURIComponent(editingId)}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setStatus("Contacto actualizado.");
    } else {
      await apiRequest("/api/contacts", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setStatus("Contacto creado.");
    }

    clearForm();
    await loadContacts();
  } catch (error) {
    setStatus(error.message, true);
  }
});

cancelEditBtn.addEventListener("click", () => {
  clearForm();
  setStatus("Edicion cancelada.");
});

searchInput.addEventListener("input", renderContacts);

const savedAccessKey = sessionStorage.getItem("accessKey");
if (savedAccessKey) {
  accessKeyInput.value = savedAccessKey;
  loadContacts();
}