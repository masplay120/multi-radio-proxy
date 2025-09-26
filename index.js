// 📂 Ruta para leer todas las radios
app.get("/admin-api/radios", (req, res) => {
  const radios = loadRadios();
  res.json(radios);
});

// ➕ Agregar/editar radio
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

// ❌ Eliminar radio
app.delete("/admin-api/radios/:id", (req, res) => {
  const radios = loadRadios();
  if (!radios[req.params.id]) {
    return res.status(404).json({ error: "Radio no encontrada" });
  }
  delete radios[req.params.id];
  fs.writeFileSync(radiosFile, JSON.stringify(radios, null, 2));
  res.json({ success: true, radios });
});
