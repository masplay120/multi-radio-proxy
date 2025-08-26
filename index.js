const express = require("express");
const request = require("request");

const app = express();
const PORT = process.env.PORT || 8080;

// 🎵 Lista de streams
const STREAMS = {
  radio10856355: {
    url: "http://streamlive2.hearthis.at:8000/10856355.ogg",
    status: "http://streamlive2.hearthis.at:8000/status-json.xsl",
    mount: "10856355.ogg"
  },
  radio10778826: {
    url: "http://streamlive2.hearthis.at:8000/10778826.ogg",
    status: "http://streamlive2.hearthis.at:8000/status-json.xsl",
    mount: "10778826.ogg"
  },
  radio3: {
    url: "http://tu-servidor3:puerto/mountpoint3",
    status: "http://tu-servidor3:puerto/status-json.xsl",
    mount: "mountpoint3"
  }
};

// 🎶 Proxy de audio
app.get("/:radio", (req, res) => {
  const radio = req.params.radio;
  const stream = STREAMS[radio];

  if (!stream) {
    return res.status(404).send("Stream no encontrado");
  }

  res.setHeader("Content-Type", "audio/mpeg");
  request(stream.url)
    .on("error", (err) => {
      console.error(`Error con stream ${radio}:`, err.message);
      res.status(500).send("Error al conectar con el stream");
    })
    .pipe(res);
});

// 📊 Proxy de metadatos
app.get("/:radio/meta", (req, res) => {
  const radio = req.params.radio;
  const stream = STREAMS[radio];

  if (!stream) {
    return res.status(404).json({ error: "Stream no encontrado" });
  }

  request(stream.status, (err, _, body) => {
    if (err) {
      console.error(`Error con metadata ${radio}:`, err.message);
      return res.status(500).json({ error: "Error obteniendo metadata" });
    }

    try {
      const data = JSON.parse(body);

      // Buscar el mount correcto
      let source = null;
      if (Array.isArray(data.icestats.source)) {
        source = data.icestats.source.find(
          (s) => s.listenurl && s.listenurl.includes(stream.mount)
        );
      } else if (data.icestats.source.listenurl.includes(stream.mount)) {
        source = data.icestats.source;
      }

      if (!source) {
        return res.json({ listeners: 0, title: null });
      }

      res.json({
        listeners: source.listeners || 0,
        title: source.title || source.server_description || "Sin título",
        artwork: source.artwork_url || null
      });
    } catch (e) {
      console.error("Error parseando metadata:", e.message);
      res.status(500).json({ error: "Error procesando metadata" });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Proxy corriendo en http://localhost:${PORT}`);
});
