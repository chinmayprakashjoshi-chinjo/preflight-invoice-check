import app from "./app";

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`[PreFlight Backend] Server is running on http://localhost:${PORT}`);
  console.log(`[PreFlight Backend] Healthcheck available at http://localhost:${PORT}/api/health`);
});
