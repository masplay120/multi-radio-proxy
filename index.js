const express = require("express");
const request = require("request");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

const radiosFile = path.join(__dirname, "radios.json");

function loadRadios() {
  try { return JSON.parse(fs.readFileSync(radiosFile, "utf-8")); }
  catch (err) { return {}; }
}

// Middleware CORS
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

// Proxy de audio
app.get("/:radio", (req, res) => {
  const radios = loadRadios();
  const stream = radios[req.params.radio];
  if (!stream) return res.status(404).send("Stream no encontrado");

  res.setHeader("Content-Type", "audio/mpeg");
  request(stream.url).on("error", err => {
    console.error(`Error con stream ${req.params.radio}:`, err.message);
    res.status(500).send("Error al conectar con el stream");
  }).pipe(res);
});

// Proxy de metadata
app.get("/:radio/meta", (req, res) => {
  const radios = loadRadios();
  const stream = radios[req.params.radio];
  if (!stream) return res.status(404).json({ error: "Stream no encontrado" });

  const STATUS_URL = "http://streamlive2.hearthis.at:8000/status-json.xsl";
  request(STATUS_URL, (err, _, body) => {
    if (err) return res.status(500).json({ error: "Error obteniendo metadata" });

    try {
      const data = JSON.parse(body);
      let sources = data.icestats.source;
      if (!sources) return res.json({ listeners: 0, title: null, artwork: null });
      if (!Array.isArray(sources)) sources = [sources];

      const source = sources.find(s => s.listenurl && s.listenurl.includes(stream.mount));
      if (!source) return res.json({ listeners: 0, title: null, artwork: null });

      res.json({
        listeners: source.listeners ?? 0,
        title: source.title || source.server_name || source.server_description || "Sin título",
        artwork: source.artwork_url || source.track_image_url || null
      });
    } catch (e) {
      res.status(500).json({ error: "Error procesando metadata" });
    }
  });
});

// Middleware admin
app.use("/admin-api", (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${process.env.ADMIN_PASS}`) {
    return res.status(401).json({ error: "No autorizado" });
  }
  next();
});

// API admin
app.get("/admin-api/radios", (req, res) => res.json(loadRadios()));
app.post("/admin-api/radios", express.json(), (req, res) => {
  const { id, url, mount } = req.body;
  if (!id || !url || !mount) return res.status(400).json({ error: "Faltan campos" });
  const radios = loadRadios();
  radios[id] = { url, mount };
  fs.writeFileSync(radiosFile, JSON.stringify(radios, null, 2));
  res.json({ success: true, radios });
});
app.delete("/admin-api/radios/:id", (req, res) => {
  const radios = loadRadios();
  if (!radios[req.params.id]) return res.status(404).json({ error: "Radio no encontrada" });
  delete radios[req.params.id];
  fs.writeFileSync(radiosFile, JSON.stringify(radios, null, 2));
  res.json({ success: true, radios });
});

// Servir panel
app.use(express.static(__dirname));

app.listen(PORT, () => console.log(`Proxy corriendo en http://localhost:${PORT}`));
