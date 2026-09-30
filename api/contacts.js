const crypto = require("node:crypto");
const { createClient } = require("@supabase/supabase-js");

const PHONE_PATTERN = /^[0-9+()\s-]{6,20}$/;

function json(res, statusCode, payload) {
  res.status(statusCode).json(payload);
}

function safeCompare(secretA, secretB) {
  const a = Buffer.from(secretA || "", "utf8");
  const b = Buffer.from(secretB || "", "utf8");
  if (a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function normalize(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validatePayload(body) {
  const name = normalize(body.name);
  const phone = normalize(body.phone);
  const address = normalize(body.address);

  if (!name || name.length > 100) {
    return "Nombre invalido.";
  }

  if (!PHONE_PATTERN.test(phone)) {
    return "Telefono invalido.";
  }

  if (!address || address.length > 200) {
    return "Direccion invalida.";
  }

  return null;
}

function getContactId(req) {
  const id = req.query && req.query.id;
  if (Array.isArray(id)) {
    return id[0] || "";
  }
  return typeof id === "string" ? id : "";
}

function parseBody(req) {
  if (!req.body) {
    return {};
  }

  if (typeof req.body === "object") {
    return req.body;
  }

  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

module.exports = async (req, res) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ACCESS_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ACCESS_KEY) {
    return json(res, 500, { error: "Configuracion incompleta." });
  }

  const requestKey = req.headers["x-access-key"];
  if (!safeCompare(requestKey, ACCESS_KEY)) {
    return json(res, 401, { error: "No autorizado." });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("contacts")
        .select("id,name,phone,address,created_at")
        .order("created_at", { ascending: false });

      if (error) {
        return json(res, 500, { error: "No se pudo leer la lista." });
      }

      return json(res, 200, { contacts: data || [] });
    }

    if (req.method === "POST") {
      const body = parseBody(req);
      const validationError = validatePayload(body);
      if (validationError) {
        return json(res, 400, { error: validationError });
      }

      const { data, error } = await supabase
        .from("contacts")
        .insert({
          name: normalize(body.name),
          phone: normalize(body.phone),
          address: normalize(body.address),
        })
        .select("id,name,phone,address,created_at")
        .single();

      if (error) {
        return json(res, 500, { error: "No se pudo crear el contacto." });
      }

      return json(res, 201, { contact: data });
    }

    if (req.method === "PUT") {
      const id = getContactId(req);
      if (!id) {
        return json(res, 400, { error: "Falta el id." });
      }

      const body = parseBody(req);
      const validationError = validatePayload(body);
      if (validationError) {
        return json(res, 400, { error: validationError });
      }

      const { data, error } = await supabase
        .from("contacts")
        .update({
          name: normalize(body.name),
          phone: normalize(body.phone),
          address: normalize(body.address),
        })
        .eq("id", id)
        .select("id,name,phone,address,created_at")
        .single();

      if (error) {
        return json(res, 500, { error: "No se pudo actualizar el contacto." });
      }

      return json(res, 200, { contact: data });
    }

    if (req.method === "DELETE") {
      const id = getContactId(req);
      if (!id) {
        return json(res, 400, { error: "Falta el id." });
      }

      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) {
        return json(res, 500, { error: "No se pudo eliminar el contacto." });
      }

      return json(res, 200, { ok: true });
    }

    return json(res, 405, { error: "Metodo no permitido." });
  } catch {
    return json(res, 500, { error: "Error interno." });
  }
};