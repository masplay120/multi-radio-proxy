const express = require("express");
const request = require("request");

const app = express();
const PORT = process.env.PORT || 8080;

// 🎵 Lista de streams (puedes agregar los que quieras)
const STREAMS = {
  radio10856355: "http://streamlive2.hearthis.at:8000/10856355.ogg",
  radio10778826: "http://streamlive2.hearthis.at:8000/10778826.ogg",
  radio3: "http://tu-servidor3:puerto/mountpoint3"
};

// Ruta dinámica: https://tu-app.fly.dev/radio10856355
app.get("/:radio", (req, res) => {
  const radio = req.params.radio;
  const url = STREAMS[radio];

  if (!url) {
    return res.status(404).send("Stream no encontrado");
  }

  res.setHeader("Content-Type", "audio/mpeg");
  request(url)
    .on("error", (err) => {
      console.error(`Error con stream ${radio}:`, err.message);
      res.status(500).send("Error al conectar con el stream");
    })
    .pipe(res);
});

app.listen(PORT, () => {
  console.log(`Proxy corriendo en http://localhost:${PORT}/radio10856355, /radio10778826, /radio3`);
});
