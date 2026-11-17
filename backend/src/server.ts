import { createApp } from "./app.js";
import { config } from "./config.js";
import { InMemoryKeyValueStore, InMemoryStorageAdapter } from "./storage.js";

async function startServer() {
  try {
    const store = new InMemoryKeyValueStore();
    const storageAdapter = new InMemoryStorageAdapter(store);
    const app = createApp(store, storageAdapter);

    app.listen(config.port, () => {
      console.log(`🚀 Angelos Auth Backend listening on http://localhost:${config.port}`);
      console.log(`💾 Storage Mode: In-House Memory (No Redis required)`);
      console.log(`📱 WhatsApp Business Number: ${config.whatsappBusinessNumber || "Not configured"}`);
      console.log(`🌐 Allowed Client URL: ${config.clientUrl}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
