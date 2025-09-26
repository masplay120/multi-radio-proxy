const express = require("express");
const request = require("request");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

// 📂 archivo JSON con radios
const radiosFile = path.join(__dirname, "radios.json");

function loadRadios() {
  try {
    return JSON.parse(fs.readFileSync(radiosFile, "utf-8"));
  } catch (err) {
    console.error("Error leyendo radios.json:", err.message);
    return {};
  }
}

// URL global de metadata (Icecast)
const STATUS_URL = "http://streamlive2.hearthis.at:8000/status-json.xsl";

// Middleware global para habilitar CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

// 🎶 Proxy de audio
app.get("/:radio", (req, res) => {
  const radios = loadRadios();
  const stream = radios[req.params.radio];

  if (!stream) {
    return res.status(404).send("Stream no encontrado");
  }

  res.setHeader("Content-Type", "audio/mpeg");

  request(stream.url)
    .on("error", (err) => {
      console.error(`Error con stream ${req.params.radio}:`, err.message);
      res.status(500).send("Error al conectar con el stream");
    })
    .pipe(res);
});

// 📊 Proxy de metadatos
app.get("/:radio/meta", (req, res) => {
  const radios = loadRadios();
  const stream = radios[req.params.radio];

  if (!stream) {
    return res.status(404).json({ error: "Stream no encontrado" });
  }

  request(STATUS_URL, (err, _, body) => {
    if (err) {
      console.error(`Error con metadata ${req.params.radio}:`, err.message);
      return res.status(500).json({ error: "Error obteniendo metadata" });
    }

    try {
      const data = JSON.parse(body);

      let sources = data.icestats.source;
      if (!sources) {
        return res.json({ listeners: 0, title: null, artwork: null });
      }

      if (!Array.isArray(sources)) {
        sources = [sources];
      }

      const source = sources.find(
        (s) => s.listenurl && s.listenurl.includes(stream.mount)
      );

      if (!source) {
        return res.json({ listeners: 0, title: null, artwork: null });
      }

      res.json({
        listeners: source.listeners ?? 0,
        title:
          source.title ||
          source.server_name ||
          source.server_description ||
          "Sin título",
        artwork: source.artwork_url || source.track_image_url || null
      });
    } catch (e) {
      console.error("Error parseando metadata:", e.message);
      res.status(500).json({ error: "Error procesando metadata" });
    }
  });
});

// 🔑 Middleware de autenticación
app.use("/admin-api", (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${process.env.ADMIN_PASS}`) {
    return res.status(401).json({ error: "No autorizado" });
  }
  next();
});

// 📂 API de administración
app.get("/admin-api/radios", (req, res) => {
  res.json(loadRadios());
});

app.post("/admin-api/radios", express.json(), (req, res) => {
  const { id, url, mount } = req.body;
  if (!id || !url || !mount) {
    return res.status(400).json({ error: "Faltan campos" });
  }
  const radios = loadRadios();
  radios[id] = { url, mount };
  fs.writeFileSync(radiosFile, JSON.stringify(radios, null, 2));
  res.json({ success: true, radios });
});

app.delete("/admin-api/radios/:id", (req, res) => {
  const radios = loadRadios();
  if (!radios[req.params.id]) {
    return res.status(404).json({ error: "Radio no encontrada" });
  }
  delete radios[req.params.id];
  fs.writeFileSync(radiosFile, JSON.stringify(radios, null, 2));
  res.json({ success: true, radios });
});

// 📄 Servir panel admin.html
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`Proxy corriendo en http://localhost:${PORT}`);
});
